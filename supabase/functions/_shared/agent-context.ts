// ===========================================================================
// _shared/agent-context.ts
// Wrapper unifié qui compose le contexte complet à injecter dans le prompt
// d'un agent IA : tone d'identité + benchmarks figés + RAG/KB + guardrails.
//
// Avant : chaque fn dupliquait 5-10 lignes d'imports + glue code, et certaines
// fns oubliaient une couche (ex: pre-screening sans benchmarks).
// Après : 1 appel `buildAgentContext(...)` renvoie un bloc prêt à concaténer.
//
// La fn s'adapte selon `options.deliverableType` :
//   - pre_screening : tone + financial-knowledge + RAG (categories ciblées)
//   - investment_memo / ic1_memo / regenerate_section : tout (full stack)
//   - valuation : tone + financial-knowledge + valuation-benchmarks + RAG
//   - dd_report : tone + financial-knowledge + RAG (compliance/fiscal)
//   - apply_dd_findings : tone + financial-knowledge + valuation-benchs + RAG
// ===========================================================================

import { buildToneForAgent } from './agent-tone.ts';
import { injectGuardrails } from './guardrails.ts';
import { buildRAGContext } from './helpers_v5.ts';
import {
  getFinancialKnowledgePrompt,
  getValuationBenchmarksPrompt,
  getDonorCriteriaPrompt,
} from './financial-knowledge.ts';

export type DeliverableType =
  | 'pre_screening'
  | 'investment_memo'
  | 'ic1_memo'
  | 'valuation'
  | 'dd_report'
  | 'apply_dd_findings'
  | 'regenerate_section';

export interface AgentContextOptions {
  /** Type de livrable que l'agent va produire — pilote la sélection des sources. */
  deliverableType: DeliverableType;
  /** Pays de la cible (entreprise/deal) — utilisé pour benchmarks + guardrails + devise. */
  country?: string | null;
  /** Secteur de la cible — utilisé pour benchmarks sectoriels. */
  sector?: string | null;
  /** ID entreprise — utilisé pour scoper les corrections historiques (feedback loop). */
  enterpriseId?: string | null;
  /** Si true, inclut les exemples d'entreprises dans getFinancialKnowledgePrompt. Défaut true. */
  includeFinancialExamples?: boolean;
  /**
   * Override des catégories RAG. Par défaut, dépend de deliverableType.
   * Categories typiques : 'benchmarks', 'fiscal', 'secteur', 'macro', 'multiples',
   * 'wacc', 'compliance', 'donor', 'deal_learning'.
   */
  ragCategories?: string[];
}

export interface AgentContext {
  /** Bloc tone d'identité (TONE_PE/PROGRAMME/BA/BANQUE + fund_segment + devise). */
  tone: string;
  /** Bloc benchmarks financiers + ratios sectoriels (toujours présent). */
  financialKnowledge: string;
  /** Bloc multiples valuation (présent pour valuation/memo/regenerate). */
  valuationBenchmarks: string;
  /** Bloc critères bailleurs (présent pour memo/regenerate sections ESG). */
  donorCriteria: string;
  /** Bloc RAG (KB ESONO + KB org + corrections historiques). */
  rag: string;
  /**
   * Préfixe complet à concaténer avant le prompt-tâche : tone + benchmarks +
   * valuation + donor + RAG. PAS encore wrappé par injectGuardrails — utiliser
   * `wrapWithGuardrails` après concat avec le prompt-tâche.
   */
  prefix: string;
  /** Pays de la cible (utilisé pour injectGuardrails). */
  country: string;
  /** Wrappe un prompt complet avec injectGuardrails(prompt, country). */
  wrapWithGuardrails: (fullPrompt: string) => string;
  /** Compose tous les blocs en un seul system prompt prêt à utiliser. */
  composeSystemPrompt: (taskPrompt: string) => string;
}

/**
 * Renvoie les catégories RAG par défaut selon le type de livrable.
 * Permet de cibler la recherche sémantique sans noyer le contexte de bruit.
 */
function defaultRAGCategories(deliverableType: DeliverableType): string[] {
  switch (deliverableType) {
    case 'pre_screening':
      return ['benchmarks', 'secteur', 'macro', 'fiscal', 'deal_learning'];
    case 'investment_memo':
    case 'ic1_memo':
    case 'regenerate_section':
      return ['benchmarks', 'fiscal', 'secteur', 'macro', 'multiples', 'wacc', 'donor', 'compliance', 'deal_learning'];
    case 'valuation':
      return ['multiples', 'wacc', 'fiscal', 'secteur', 'macro', 'deal_learning'];
    case 'dd_report':
      return ['compliance', 'fiscal', 'secteur', 'benchmarks', 'deal_learning'];
    case 'apply_dd_findings':
      return ['benchmarks', 'fiscal', 'secteur', 'multiples', 'compliance', 'deal_learning'];
    default:
      return ['benchmarks', 'fiscal', 'secteur'];
  }
}

/**
 * Indique si un livrable doit inclure les benchmarks valuation.
 * Tous les livrables PE qui touchent aux chiffres valuation/multiples.
 */
function needsValuationBenchmarks(deliverableType: DeliverableType): boolean {
  return ['investment_memo', 'ic1_memo', 'valuation', 'regenerate_section', 'apply_dd_findings'].includes(deliverableType);
}

/**
 * Indique si un livrable doit inclure les critères bailleurs.
 * Pertinent uniquement pour le memo (sections ESG/risques + accompagnement).
 */
function needsDonorCriteria(deliverableType: DeliverableType): boolean {
  return ['investment_memo', 'ic1_memo', 'regenerate_section'].includes(deliverableType);
}

/**
 * Construit le contexte complet pour un agent IA.
 *
 * Usage type :
 *
 *   const ctx = await buildAgentContext(supabase, organizationId, {
 *     deliverableType: 'pre_screening',
 *     country: ent.country,
 *     sector: ent.sector,
 *     enterpriseId: ent.id,
 *   });
 *   const systemPrompt = ctx.composeSystemPrompt(SYSTEM_PROMPT_TACHE);
 *   const result = await callAI(systemPrompt, userPrompt, ...);
 */
export async function buildAgentContext(
  supabase: any,
  organizationId: string | null | undefined,
  options: AgentContextOptions,
): Promise<AgentContext> {
  const {
    deliverableType,
    country = null,
    sector = null,
    enterpriseId = null,
    includeFinancialExamples = true,
    ragCategories,
  } = options;

  const safeCountry = country || '';
  const safeSector = sector || 'services_b2b';
  const categories = ragCategories ?? defaultRAGCategories(deliverableType);

  // Lance les calls en parallèle pour minimiser la latence cumulée.
  // tone + RAG sont async (DB), les autres sont sync (lookup tables).
  const [tone, rag] = await Promise.all([
    buildToneForAgent(supabase, organizationId),
    buildRAGContext(supabase, safeCountry, safeSector, categories, deliverableType, enterpriseId ?? undefined),
  ]);

  const financialKnowledge = getFinancialKnowledgePrompt(safeCountry as any, safeSector as any, includeFinancialExamples);
  const valuationBenchmarks = needsValuationBenchmarks(deliverableType) ? getValuationBenchmarksPrompt() : '';
  const donorCriteria = needsDonorCriteria(deliverableType) ? getDonorCriteriaPrompt() : '';

  // Préfixe canonique : tone d'abord, puis knowledge figé, puis RAG dynamique.
  // Le prompt-tâche est inséré APRÈS ce préfixe, et injectGuardrails wrappe le tout.
  const prefixBlocks: string[] = [tone, financialKnowledge];
  if (valuationBenchmarks) prefixBlocks.push(valuationBenchmarks);
  if (donorCriteria) prefixBlocks.push(donorCriteria);
  if (rag) prefixBlocks.push(rag);
  const prefix = prefixBlocks.filter(Boolean).join('\n\n');

  const wrapWithGuardrails = (fullPrompt: string): string => injectGuardrails(fullPrompt, safeCountry);

  /**
   * Compose un system prompt complet en suivant cet ordre canonique :
   *   1. Tone d'identité (qui tu es)
   *   2. Knowledge figé (benchmarks + valuation + donor)
   *   3. RAG dynamique (KB + corrections historiques)
   *   4. Task prompt (ce que tu dois faire)
   *   5. Guardrails par pays (devise, langue, fiscalité — APRÈS tout)
   */
  const composeSystemPrompt = (taskPrompt: string): string => {
    return wrapWithGuardrails(`${prefix}\n\n${taskPrompt}`);
  };

  return {
    tone,
    financialKnowledge,
    valuationBenchmarks,
    donorCriteria,
    rag,
    prefix,
    country: safeCountry,
    wrapWithGuardrails,
    composeSystemPrompt,
  };
}
