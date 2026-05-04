// ===========================================================================
// _shared/agent-tone.ts
// Compose le bloc d'identité (tone_block) à prépendre au SYSTEM_PROMPT
// spécifique de chaque agent IA, en fonction du segment de l'organisation
// et de ses presets.
//
// La langue de sortie reste pilotée par injectGuardrails(country) côté agent
// (FR pour pays francophones, EN pour Ghana/Nigeria/Kenya/etc.).
// La devise des chiffres reste pilotée par getFiscalParams(country) côté agent.
// Ce fichier ne touche ni à la langue ni à la devise des chiffres — seulement
// à l'IDENTITÉ et au STYLE de l'agent.
// ===========================================================================

import {
  detectSegment,
  getSegmentConfig,
  getPresets,
  type SegmentType,
} from './segment-config.ts';
import { getFiscalParams } from './helpers_v5.ts';

// ═══════════════════════════════════════════════════════════════════════════
// FUND_SEGMENT_BLOCKS — adaptations du tone PE selon la taille du fonds
// (lue dans organization_presets.fund_segment).
// ═══════════════════════════════════════════════════════════════════════════

const FUND_SEGMENT_BLOCKS: Record<string, string> = {
  amorcage: `
SEGMENT AMORÇAGE (tickets 1-5M EUR) : données souvent partielles, EBITDA peu fiable, focus impact + croissance + adéquation thèse. Tolérance plus haute sur la qualité des données. Le scoring privilégie le potentiel et l'impact ESG sur la solidité financière.`,

  mid_market: `
SEGMENT MID-MARKET (tickets 3-8M EUR) : données 3 ans minimum, EBITDA retraité obligatoire, focus solidité financière + gouvernance + potentiel de croissance. Standards de DD professionnels. Le scoring équilibre solidité, gouvernance et croissance.`,

  gros_tickets: `
SEGMENT GROS TICKETS (tickets 8M+ EUR) : données auditées requises, scoring strict, gouvernance institutionnelle attendue, tolérance zéro sur red flags non documentés. Le scoring privilégie solidité et gouvernance.`,
};

// ═══════════════════════════════════════════════════════════════════════════
// buildToneForAgent
// Fonction principale appelée par chaque agent IA en début de handler.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit le bloc d'identité (tone_block) à prépendre au SYSTEM_PROMPT
 * spécifique d'un agent.
 *
 * Lecture :
 *   1. Détecte le segment de l'org (detectSegment)
 *   2. Charge le SegmentConfig par défaut
 *   3. Charge les presets de l'org (peut être null)
 *   4. Compose le tone d'identité, enrichi selon le segment :
 *      - Programme : tone simple, multi-devise via le contexte
 *      - PE : ajoute le bloc fund_segment selon la taille du fonds
 *      - Banque d'affaires : tone simple
 *      - Banque/IMF : ajoute la grille des critères de conformité
 *      de cette banque (DSCR, endettement, etc.)
 *   5. Ajoute la devise par défaut de l'org en signal contextuel
 *
 * Contrat de rétrocompatibilité :
 *   Pour les 7 orgs Programme existantes (pas de preset défini), le tone
 *   produit est strictement équivalent à l'identité actuelle des agents
 *   ("consultant senior UEMOA/CEMAC..."). Voir TONE_PROGRAMME dans
 *   segment-config.ts.
 *
 * Usage type dans un agent (Phase 2+) :
 *
 *   import { buildToneForAgent } from '../_shared/agent-tone.ts';
 *
 *   const toneBlock = await buildToneForAgent(supabase, ctx.organization_id);
 *   const finalSystemPrompt = `${toneBlock}\n\n${SYSTEM_PROMPT_TACHE}`;
 *   const result = await callAI(injectGuardrails(finalSystemPrompt, ent.country), ...);
 */
export async function buildToneForAgent(
  supabase: any,
  organizationId: string | null | undefined,
): Promise<string> {
  // Si pas d'organizationId (cas edge où l'agent est invoqué sans contexte org),
  // on tombe gracieusement sur le segment 'programme' avec ses défauts.
  const safeOrgId = organizationId ?? '';
  const segment = await detectSegment(supabase, safeOrgId);
  const config = getSegmentConfig(segment);
  const presets = safeOrgId ? await getPresets(supabase, safeOrgId) : null;

  // Charge le pays de l'org pour résoudre dynamiquement la devise par défaut.
  // Évite que les fonds PE basés en zone FCFA héritent d'EUR par défaut.
  let orgCountry: string | null = null;
  if (safeOrgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('country')
      .eq('id', safeOrgId)
      .maybeSingle();
    orgCountry = org?.country ?? null;
  }

  let tone = config.tone.system_prompt_block;

  // PE : ajouter le bloc segment de fonds selon la taille (amorcage/mid_market/gros_tickets)
  if (segment === 'pe') {
    const fundSeg = presets?.fund_segment || 'mid_market';
    const block = FUND_SEGMENT_BLOCKS[fundSeg] || FUND_SEGMENT_BLOCKS.mid_market;
    tone += '\n' + block;
  }

  // Banque : ajouter les critères de conformité spécifiques à cette banque
  // Si l'org a configuré ses propres seuils (presets.criteres_conformite),
  // ils écrasent les défauts du segment banque.
  if (segment === 'banque') {
    const criteres = presets?.criteres_conformite || config.scoring.criteres_defaut || [];
    if (criteres.length) {
      tone += '\n\nCRITÈRES DE CONFORMITÉ DE CETTE BANQUE :';
      for (const c of criteres) {
        const op =
          c.operateur === 'gte' ? '≥' :
          c.operateur === 'lte' ? '≤' :
          c.operateur === 'eq' ? '=' :
          c.operateur;
        const valDisplay = typeof c.seuil === 'boolean' ? (c.seuil ? 'oui' : 'non') : c.seuil;
        tone += `\n- ${c.label} : ${op} ${valDisplay} (${c.obligatoire ? 'obligatoire' : 'indicatif'})`;
      }
    }
  }

  // Devise par défaut de l'org — signal contextuel uniquement.
  // Résolution dynamique avec priorité :
  //   1. presets.devise si l'org l'a explicitement défini
  //   2. devise locale du pays de l'org (via getFiscalParams) — évite qu'un fonds
  //      PE basé en Côte d'Ivoire hérite d'EUR à cause du défaut segment
  //   3. devise_defaut du segment en dernier recours (org sans pays connu)
  // Les chiffres réels dans les livrables restent calculés via getFiscalParams(country).
  // Formulation explicite pour éviter que l'IA mélange devise org et devise entreprise
  // (cas typique : org en FCFA, entreprise au Ghana qui doit produire des chiffres en GHS).
  const orgCountryDevise = orgCountry ? getFiscalParams(orgCountry).devise : '';
  const devise = presets?.devise || orgCountryDevise || config.tone.devise_defaut;
  tone += `\n\nCONTEXTE DEVISE :
- Devise par défaut de l'organisation : ${devise} (utilisée uniquement pour les vues agrégées multi-entreprises et les paramètres org).
- Pour les chiffres d'une entreprise spécifique : utilise TOUJOURS la devise locale réelle de son pays (FCFA-XOF en UEMOA, FCFA-XAF en CEMAC, USD pour la RDC, GHS au Ghana, NGN au Nigeria, KES au Kenya, MAD au Maroc, TND en Tunisie, GNF en Guinée, etc.). La devise de l'org NE s'applique JAMAIS aux livrables individuels d'entreprise.`;

  return tone;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE RÉTROCOMPATIBILITÉ
// Si certains agents/scripts utilisaient déjà les noms detectPreset /
// detectFundSegment dans une version antérieure, ces alias garantissent
// que les imports continuent de marcher.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alias de detectSegment pour rétrocompat éventuelle.
 */
export async function detectPreset(supabase: any, organizationId: string): Promise<SegmentType> {
  return detectSegment(supabase, organizationId);
}

/**
 * Renvoie la taille de fonds ('amorcage' | 'mid_market' | 'gros_tickets')
 * pour les orgs PE. Utile pour les agents qui veulent adapter directement
 * leur seuil de tolérance ou leur scoring sans repasser par buildToneForAgent.
 *
 * Pour les orgs non-PE, renvoie 'mid_market' par défaut (valeur sans effet
 * dans les autres contextes).
 */
export async function detectFundSegment(supabase: any, organizationId: string): Promise<string> {
  const presets = await getPresets(supabase, organizationId);
  return presets?.fund_segment || 'mid_market';
}
