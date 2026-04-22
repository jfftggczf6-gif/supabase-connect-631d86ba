// v5 — 2-pass checkpoint + Sonnet model 2026-03-20
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getCoachingContext,
} from "../_shared/helpers_v5.ts";
import { getFinancialKnowledgePrompt, getValuationBenchmarksPrompt, getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SONNET_MODEL = "claude-sonnet-4-6";

const MEMO_SYSTEM_PROMPT = `Tu es un analyste senior en Private Equity / Impact Investing avec 15+ ans d'expérience en Afrique subsaharienne.
Tu rédiges des Investment Memorandums professionnels pour des comités d'investissement de fonds (BAD, IFC, Proparco, I&P, Partech Africa, BII).

TU CONNAIS :
- Les normes SYSCOHADA révisé 2017 et la fiscalité UEMOA/CEMAC
- Les critères ESG des DFI (IFC Performance Standards 1-8, Principes Equateur)
- Le processus d'investissement : screening → due diligence → investment memo → comité → closing
- Les spécificités PME Afrique : informalité partielle, gouvernance familiale, saisonnalité
- Les multiples de valorisation réels en Afrique (PAS les multiples occidentaux)

EXIGENCES QUALITÉ :
- Chaque affirmation s'appuie sur des données (entreprise, benchmark sectoriel, ou estimation explicite)
- La section valorisation utilise les résultats de l'agent Valuation — ne PAS recalculer, citer et commenter
- La thèse d'investissement doit être HONNÊTE
- Les projections financières citent le scénario réaliste du Plan OVO
- La recommandation finale doit être COHÉRENTE avec le score et les risques
- Minimum 200 mots par section narrative

RÈGLE ABSOLUE — CITATIONS DE SOURCES :
- INTERDIT d'écrire "(source: AFD 2024)", "(d'après BCEAO)", "(réf: ...)", "selon le rapport X" DANS LE CORPS DES TEXTES.
- Toutes les sources externes vont UNIQUEMENT dans le champ dédié "sources_consultees" (array d'objets {source, used_for, section}).
- Les textes restent FLUIDES sans parenthèses bibliographiques. Le lecteur du memo trouvera la bibliographie en annexe.

STYLE DE RÉDACTION :
- Rédige comme un VRAI ANALYSTE qui écrit un RAPPORT — pas comme une IA qui liste des faits
- Chaque section doit être un TEXTE FLUIDE avec des phrases qui s'enchaînent logiquement
- PAS de listes de bullet points entassées — des PARAGRAPHES rédigés avec transitions
- Structure narrative : contexte → constat → analyse → implication pour l'investisseur
- Les chiffres sont INTÉGRÉS dans le raisonnement, pas empilés : "La marge brute de 54% témoigne d'un positionnement premium, supérieur à la médiane sectorielle de 35-45%"
- Chaque section doit pouvoir se lire INDÉPENDAMMENT comme un paragraphe cohérent

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const MEMO_SCHEMA_PART1 = `{
  "page_de_garde": {
    "titre": "string — Investment Memorandum — [Nom Entreprise]",
    "sous_titre": "string — Confidentiel — Préparé par ESONO",
    "date": "string",
    "version": "string — v1.0"
  },
  "resume_executif": {
    "synthese": "string — 500+ mots, résumé complet du dossier",
    "points_cles": ["string — 5-8 points clés"],
    "recommandation_preliminaire": "INVESTIR | APPROFONDIR | DECLINER",
    "score_ir": <0-100>
  },
  "presentation_entreprise": {
    "historique": "string — 200+ mots",
    "activites": "string — description détaillée des activités",
    "positionnement": "string — positionnement marché",
    "gouvernance": "string — structure de gouvernance, actionnariat",
    "effectifs": "string — organisation et RH"
  },
  "analyse_marche": {
    "contexte_macro": "string — environnement économique du pays",
    "taille_marche": "string — TAM/SAM/SOM avec sources",
    "dynamiques": "string — tendances, croissance, réglementation",
    "concurrence": "string — paysage concurrentiel",
    "positionnement": "string — avantages compétitifs"
  },
  "modele_economique": {
    "proposition_valeur": "string",
    "sources_revenus": "string — détail des flux de revenus",
    "structure_couts": "string",
    "avantages_competitifs": ["string"],
    "scalabilite": "string — potentiel de croissance"
  },
  "analyse_financiere": {
    "historique": "string — analyse des 2-3 dernières années",
    "projections": "string — résumé des projections 5 ans",
    "ratios_cles": "string — marge, EBITDA, ROE, DSCR",
    "besoins_financement": "string — BFR, CAPEX, dette",
    "qualite_donnees": "string — fiabilité des données disponibles"
  },
  "valorisation": {
    "methodes_utilisees": ["DCF", "Multiples EBITDA", "Multiples CA"],
    "fourchette_valorisation": "string",
    "valeur_mediane": "string",
    "wacc_utilise": "string",
    "multiple_ebitda_retenu": "string",
    "decotes_appliquees": "string",
    "note_valorisation": "string — 200-300 mots",
    "sensitivity_summary": "string"
  }
}`;

const MEMO_SCHEMA_PART2 = `{
  "besoins_financement": {
    "montant_recherche": "string",
    "utilisation_fonds": [{"poste": "string", "montant": "string", "pourcentage": "string", "source": "string"}],
    "calendrier_deploiement": "string",
    "retour_attendu": "string"
  },
  "equipe_et_gouvernance": {
    "fondateurs": "string — profils détaillés",
    "management": "string — équipe de direction",
    "conseil_administration": "string",
    "points_forts_equipe": ["string"],
    "gaps_identifies": ["string"]
  },
  "esg_impact": {
    "odd_alignement": ["string — ODD avec description"],
    "impact_social": "string — emplois, inclusion, formation",
    "impact_environnemental": "string — empreinte carbone, pratiques",
    "conformite_ifc_ps": "string — Performance Standards 1-8",
    "plan_esg": "string — actions prévues"
  },
  "analyse_risques": {
    "risques_identifies": [
      {
        "categorie": "string",
        "description": "string",
        "probabilite": "faible | moyenne | elevee",
        "impact": "faible | moyen | fort",
        "mitigation": "string",
        "source": "string"
      }
    ],
    "matrice_risque_synthese": "string — résumé global"
  },
  "these_investissement": {
    "these_positive": "string — 300+ mots, pourquoi investir",
    "these_negative": "string — 200+ mots, pourquoi ne pas investir",
    "facteurs_cles_succes": ["string"],
    "catalyseurs": ["string — événements qui déclencheraient la croissance"],
    "scenarios_sortie": "string — options de sortie à 5-7 ans"
  },
  "structure_proposee": {
    "instrument": "string — equity, dette mezzanine, convertible, etc.",
    "montant": "string",
    "dilution_estimee": "string",
    "droits_investisseur": ["string — gouvernance, anti-dilution, etc."],
    "conditions_precedentes": ["string — conditions avant closing"]
  },
  "recommandation_finale": {
    "verdict": "INVESTIR | APPROFONDIR | DECLINER",
    "justification": "string — 300+ mots",
    "conditions": ["string — conditions pour que le verdict soit valide"],
    "prochaines_etapes": ["string — actions immédiates recommandées"]
  },
  "annexes": {
    "sources_donnees": ["string — liste des documents analysés"],
    "hypotheses_cles": ["string — hypothèses de projection"],
    "glossaire": ["string — termes techniques utilisés"]
  },
  "sources_consultees": [
    {
      "source": "string — ex: 'IFC PS5 — Land Acquisition guidelines 2024'",
      "used_for": "string — ex: 'Évaluation conformité ESG section esg_impact'",
      "section": "string — ex: 'esg_impact.conformite_ifc_ps'"
    }
  ]
}`;

/** Upsert the enterprise_modules row for investment_memo with checkpoint data */
async function updateMemoModuleState(
  enterpriseId: string,
  moduleData: Record<string, any>,
  progress: number,
  status: string,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const mappedStatus = status === "completed" ? "completed"
    : status === "not_started" ? "not_started" : "in_progress";

  await svc.from("enterprise_modules").upsert({
    enterprise_id: enterpriseId,
    module: "investment_memo",
    data: moduleData,
    progress,
    status: mappedStatus,
  }, { onConflict: "enterprise_id,module" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[generate-investment-memo] v5 loaded — 2-pass checkpoint");
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const requestId = crypto.randomUUID();
    const startedAt = new Date().toISOString();


    // Check for existing checkpoint in enterprise_modules
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);
    const { data: moduleRow } = await svc.from("enterprise_modules")
      .select("data, status")
      .eq("enterprise_id", ctx.enterprise_id)
      .eq("module", "investment_memo")
      .single();

    const moduleData = moduleRow?.data as Record<string, any> | null;
    const hasCheckpoint = moduleData?.phase === "part1_completed" && moduleData?.part1;

    let part1: any = null;

    // ═══════ Fetch deliverables & build context (needed for both passes) ═══════
    const { data: existingDeliverables } = await ctx.supabase
      .from("deliverables")
      .select("type, data")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDelivData = (type: string) => {
      const d = existingDeliverables?.find((del: any) => del.type === type);
      return d?.data && typeof d.data === "object" ? d.data : null;
    };

    const bmcData = getDelivData("bmc_analysis");
    const sicData = getDelivData("sic_analysis");
    const inputsData = getDelivData("inputs_data");
    const frameworkData = getDelivData("framework_data");
    const planOvoData = getDelivData("plan_ovo");
    const valuationData = getDelivData("valuation");
    const oddData = getDelivData("odd_analysis");
    const diagnosticData = getDelivData("diagnostic_data");

    const knowledgeBase = getFinancialKnowledgePrompt((ent.country || "") as any, (ent.sector || "services_b2b") as any, true);
    const valuationBenchmarks = getValuationBenchmarksPrompt();
    const donorCriteria = getDonorCriteriaPrompt();
    const ragContext = await buildRAGContext(
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "investment_memo", ctx.enterprise_id
    );

    const delivSummary: string[] = [];
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 2000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 1500)}`);
    if (inputsData) delivSummary.push(`INPUTS:\n${JSON.stringify(inputsData).substring(0, 3000)}`);
    if (frameworkData) delivSummary.push(`FRAMEWORK:\n${JSON.stringify(frameworkData).substring(0, 2000)}`);
    if (planOvoData) delivSummary.push(`PLAN OVO:\n${JSON.stringify(planOvoData).substring(0, 3000)}`);
    if (valuationData) delivSummary.push(`VALORISATION:\n${JSON.stringify(valuationData).substring(0, 3000)}`);
    if (oddData) delivSummary.push(`ODD:\n${JSON.stringify(oddData).substring(0, 1500)}`);
    if (diagnosticData) delivSummary.push(`DIAGNOSTIC:\n${JSON.stringify(diagnosticData).substring(0, 1500)}`);

    const contextBlock = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || ''}
EFFECTIFS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DESCRIPTION : ${ent.description || ""}

══════ LIVRABLES ══════
${delivSummary.join("\n\n")}

══════ CONNAISSANCES FINANCIÈRES ══════
${knowledgeBase}

══════ MULTIPLES VALORISATION ══════
${valuationBenchmarks}

══════ CRITÈRES BAILLEURS ══════
${donorCriteria}

${ragContext}`;

    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);

    if (hasCheckpoint) {
      // ═══════ CAS A: Resume from checkpoint — run Pass 2 in background ═══════
      console.log("Investment Memo — Resuming from checkpoint, launching Pass 2/2 in background...");
      part1 = moduleData!.part1;

      await updateMemoModuleState(ctx.enterprise_id, {
        ...moduleData,
        phase: "part2",
        request_id: requestId,
        started_at: startedAt,
        last_update_at: new Date().toISOString(),
      }, 60, "in_progress");

      const asyncWork2 = async () => {
        try {
          const part1Summary = JSON.stringify({
            recommandation: part1.resume_executif?.recommandation_preliminaire,
            score: part1.resume_executif?.score_ir,
            valorisation: part1.valorisation?.fourchette_valorisation,
          });

          const prompt2 = `${contextBlock}

══════ RÉSUMÉ PASSE 1 ══════
${part1Summary}

══════ INSTRUCTIONS — PASSE 2/2 ══════
Rédige les sections 8 à 15 (besoins de financement → annexes).
La recommandation finale doit être COHÉRENTE avec le score IR (${part1.resume_executif?.score_ir || '?'}/100) et les risques identifiés.
Minimum 200 mots pour la thèse d'investissement et la recommandation finale.

Réponds en JSON selon ce schéma :
${MEMO_SCHEMA_PART2}`;

          const part2 = await callAI(injectGuardrails(MEMO_SYSTEM_PROMPT, ent.country), prompt2 + coachingContext, 16384, SONNET_MODEL, 0.15, { functionName: "generate-investment-memo", enterpriseId: ctx.enterprise_id });

          const mergedMemo = { ...part1, ...part2 };
          mergedMemo.score = part1.resume_executif?.score_ir || 0;

          // Sanitize: strip inline source citations and aggregate them in sources_consultees.
          // The model sometimes ignores the "no inline source" rule — defensive cleanup.
          const SOURCE_PATTERNS = [
            /\(\s*(?:source|réf|ref|cf\.?|d['\u2019]après|selon|d'apr\u00E8s)\s*[:\-]?\s*([^)]+)\)/gi,
            /\s+(?:source|réf|ref)\s*[:\-]\s*([^.,;\n]+)/gi,
          ];
          const collectedSources: { source: string; used_for: string; section: string }[] = [];
          const stripInlineSources = (text: string, sectionPath: string): string => {
            let out = text;
            for (const re of SOURCE_PATTERNS) {
              out = out.replace(re, (_m, captured) => {
                const src = String(captured || '').trim().replace(/^[:\-\s]+|[:\-\s]+$/g, '');
                if (src && src.length > 2 && src.length < 200) {
                  collectedSources.push({ source: src, used_for: 'Citation inline extraite', section: sectionPath });
                }
                return '';
              });
            }
            return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
          };
          const walkAndStrip = (obj: any, path = ''): void => {
            if (!obj || typeof obj !== 'object') return;
            for (const key of Object.keys(obj)) {
              const childPath = path ? `${path}.${key}` : key;
              const v = obj[key];
              if (key === 'sources_consultees' || key === 'source' || key === 'sources_donnees') continue;
              if (typeof v === 'string') obj[key] = stripInlineSources(v, childPath);
              else if (Array.isArray(v)) {
                v.forEach((item, i) => {
                  if (typeof item === 'string') v[i] = stripInlineSources(item, `${childPath}[${i}]`);
                  else walkAndStrip(item, `${childPath}[${i}]`);
                });
              } else if (typeof v === 'object') walkAndStrip(v, childPath);
            }
          };
          walkAndStrip(mergedMemo);
          if (collectedSources.length > 0) {
            const existing = Array.isArray(mergedMemo.sources_consultees) ? mergedMemo.sources_consultees : [];
            const seen = new Set(existing.map((s: any) => (s.source || '').toLowerCase()));
            for (const s of collectedSources) {
              if (!seen.has(s.source.toLowerCase())) { existing.push(s); seen.add(s.source.toLowerCase()); }
            }
            mergedMemo.sources_consultees = existing;
          }

          await saveDeliverable(ctx.supabase, ctx.enterprise_id, "investment_memo", mergedMemo, "investment_memo");

          await updateMemoModuleState(ctx.enterprise_id, {
            phase: "completed",
            completed_at: new Date().toISOString(),
          }, 100, "completed");
          console.log("Investment Memo — Pass 2 done, deliverable saved.");
        } catch (e: any) {
          console.error("Investment Memo — Pass 2 failed:", e.message);
          await updateMemoModuleState(ctx.enterprise_id, {
            phase: "failed",
            error: e.message || "Pass 2 failed",
            failed_at: new Date().toISOString(),
          }, 0, "not_started");
        }
      };

      // @ts-ignore
      EdgeRuntime.waitUntil(asyncWork2());

      return new Response(JSON.stringify({
        accepted: true,
        processing: true,
        phase: "part2",
        request_id: requestId,
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      // ═══════ CAS B: First call — run Pass 1, checkpoint, return 202 ═══════
      console.log("Investment Memo — Pass 1/2...");

      await updateMemoModuleState(ctx.enterprise_id, {
        phase: "part1",
        request_id: requestId,
        started_at: startedAt,
      }, 10, "in_progress");

      // Run Pass 1 in background via EdgeRuntime.waitUntil (avoids 150s proxy timeout)
      const asyncWork = async () => {
        try {
          const prompt1 = `${contextBlock}

══════ INSTRUCTIONS — PASSE 1/2 ══════
Rédige les sections 1 à 7 du mémo d'investissement (page de garde → valorisation).
La section valorisation doit CITER les résultats de l'agent Valuation, pas recalculer.
Chaque section narrative doit faire au minimum 200 mots.

Réponds en JSON selon ce schéma :
${MEMO_SCHEMA_PART1}`;

          const part1Result = await callAI(injectGuardrails(MEMO_SYSTEM_PROMPT, ent.country), prompt1 + coachingContext, 16384, SONNET_MODEL, 0.15, { functionName: "generate-investment-memo", enterpriseId: ctx.enterprise_id });
          const score = part1Result.resume_executif?.score_ir || 0;

          console.log("Investment Memo — Pass 1 done, saving checkpoint...");
          await updateMemoModuleState(ctx.enterprise_id, {
            phase: "part1_completed",
            part1: part1Result,
            score,
            part1_completed_at: new Date().toISOString(),
            request_id: requestId,
          }, 50, "in_progress");
          console.log("Investment Memo — Checkpoint saved.");
        } catch (e: any) {
          console.error("Investment Memo — Pass 1 failed:", e.message);
          await updateMemoModuleState(ctx.enterprise_id, {
            phase: "failed",
            error: e.message || "Pass 1 failed",
            failed_at: new Date().toISOString(),
          }, 0, "not_started");
        }
      };

      // @ts-ignore
      EdgeRuntime.waitUntil(asyncWork());

      return new Response(JSON.stringify({
        accepted: true,
        processing: true,
        phase: "part1",
        request_id: requestId,
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (e: any) {
    console.error("generate-investment-memo error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
