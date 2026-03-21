// v6 — Bilan de progression 2026-03-21
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, errorResponse, jsonResponse,
  verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  getFiscalParams, getDocumentContentForAgent, getCoachingContext
} from "../_shared/helpers_v5.ts";
import { normalizeDiagnostic, getFinancialTruth } from "../_shared/normalizers.ts";
import { getValidationRulesPrompt, getSectorKnowledgePrompt } from "../_shared/financial-knowledge.ts";

// ── Helpers locaux ──────────────────────────────────────────────────────────

/** Extrait les données essentielles d'un livrable pour limiter la taille du prompt */
function summarize(data: any): any {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
  const d = data as Record<string, any>;
  return {
    score: d.score || d.score_global,
    canvas: d.canvas ? {
      proposition_valeur: d.canvas.proposition_valeur?.enonce || d.canvas.proposition_valeur,
      segments_clients: d.canvas.segments_clients?.principal || d.canvas.segments_clients,
      flux_revenus: d.canvas.flux_revenus?.produit_principal || d.canvas.flux_revenus?.sources_revenus,
      structure_couts: d.canvas.structure_couts?.postes?.slice(0, 5),
    } : undefined,
    mission_sociale: d.mission_sociale,
    odd_alignment: Array.isArray(d.odd_alignment) ? d.odd_alignment.slice(0, 5) : undefined,
    kpis: d.kpis,
    compte_resultat: d.compte_resultat,
    sante_financiere: d.sante_financiere ? { forces: d.sante_financiere.forces, faiblesses: d.sante_financiere.faiblesses } : undefined,
    projection_5ans: d.projection_5ans ? { verdict: d.projection_5ans.verdict } : undefined,
    analyse_marge: d.analyse_marge ? { activites: d.analyse_marge.activites?.slice(0, 5), verdict: d.analyse_marge.verdict } : undefined,
    revenue: d.revenue,
    ebitda: d.ebitda,
    net_profit: d.net_profit,
    funding_need: d.funding_need,
    scenarios: d.scenarios ? {
      realiste: { revenue_year5: d.scenarios.realiste?.revenue_year5, tri: d.scenarios.realiste?.tri },
      pessimiste: { revenue_year5: d.scenarios.pessimiste?.revenue_year5 },
    } : undefined,
    resume_executif: d.resume_executif ? {
      accroche: d.resume_executif.accroche,
      probleme: d.resume_executif.probleme,
      solution: d.resume_executif.solution,
      besoin_financement: d.resume_executif.besoin_financement,
    } : undefined,
    analyse_marche: d.analyse_marche ? { taille_marche: d.analyse_marche.taille_marche, positionnement: d.analyse_marche.positionnement } : undefined,
    evaluation_cibles_odd: d.evaluation_cibles_odd ? {
      resume_par_odd: d.evaluation_cibles_odd.resume_par_odd,
    } : undefined,
    synthese: typeof d.synthese === 'string' ? d.synthese : d.synthese?.contribution_globale,
    recommandations: Array.isArray(d.recommandations) ? d.recommandations.slice(0, 3) : undefined,
    verdict: d.verdict,
    synthese_executive: d.synthese_executive,
  };
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un consultant senior en stratégie et finance d'entreprise, spécialisé dans l'accompagnement de PME africaines vers l'investment readiness. 15 ans d'expérience en Afrique de l'Ouest (UEMOA).

Tu as analysé tous les livrables du pipeline. Le coach connaît déjà l'entreprise. Tu produis un BILAN DE PROGRESSION qui répond à : "Si on présente ce dossier demain à un bailleur, qu'est-ce qui va coincer ?"

TON APPROCHE :
- Direct, factuel, chiffré
- Compare l'état actuel au diagnostic initial (progression)
- Identifie les problèmes concrets qui vont bloquer devant un bailleur
- Chaque problème a une piste d'action (correction technique, question à poser, ou réflexion)
- Identifie aussi les points forts avec un argument utilisable devant le bailleur
- Compare aux benchmarks sectoriels

TON & LANGAGE :
- Modéré et professionnel
- Chaque constat cite des chiffres et des sources (quel livrable, quelle valeur)
- Pas de scores arbitraires ni d'axes théoriques — des constats concrets

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const BILAN_SCHEMA = `{
  "metadata": {
    "nom_entreprise": "string",
    "pays": "string",
    "secteur": "string",
    "date_generation": "string",
    "livrables_analyses": ["string"]
  },

  "verdict_readiness": {
    "score": <number 0-100>,
    "palier": "en_construction | a_renforcer | potentiel | bien_avance | excellent",
    "label": "En construction | À renforcer | Potentiel | Bien avancé | Excellent",
    "pret_pour_bailleur": true|false,
    "resume": "string — 2-3 phrases. Si pas prêt, combien de problèmes bloquants restent."
  },

  "progression": {
    "score_initial": <number ou null>,
    "score_actuel": <number>,
    "bloquants_leves": ["string — bloquant résolu"],
    "bloquants_restants": ["string — bloquant encore à traiter"],
    "commentaire": "string — 2-3 phrases sur la progression"
  },

  "problemes": [
    {
      "urgence": "bloquant | important | mineur",
      "titre": "string — court et factuel",
      "constat": "string — 2-3 phrases chiffrées avec source (quel livrable, quelle valeur, quel écart)",
      "piste": "string — action concrète : correction technique, question à poser à l'entrepreneur, ou réflexion"
    }
  ],

  "questions_entrepreneur": [
    "string — question simple et directe découlant des problèmes identifiés"
  ],

  "points_forts": [
    {
      "titre": "string",
      "constat": "string — 2-3 phrases chiffrées",
      "argument_bailleur": "string — phrase réutilisable par le coach devant le bailleur"
    }
  ],

  "benchmarks": {
    "marge_brute": { "entreprise": <number>, "secteur_min": <number>, "secteur_max": <number>, "verdict": "au_dessus | dans_norme | en_dessous" },
    "marge_ebitda": { "entreprise": <number>, "secteur_min": <number>, "secteur_max": <number>, "verdict": "au_dessus | dans_norme | en_dessous" },
    "marge_nette": { "entreprise": <number>, "secteur_min": <number>, "secteur_max": <number>, "verdict": "au_dessus | dans_norme | en_dessous" },
    "charges_fixes_ca": { "entreprise": <number>, "secteur_min": <number>, "secteur_max": <number>, "verdict": "au_dessus | dans_norme | en_dessous" },
    "masse_salariale_ca": { "entreprise": <number>, "secteur_min": <number>, "secteur_max": <number>, "verdict": "au_dessus | dans_norme | en_dessous" }
  },

  "verdict_final": {
    "synthese": "string — 3-5 phrases. Bilan global, prêt ou pas et pourquoi.",
    "delai_estime": "string — 'Prêt immédiatement' ou '2-3 semaines de corrections' ou '2-3 mois'",
    "prochaines_etapes": ["string — numérotées"]
  }
}`;

function buildUserPrompt(
  name: string, sector: string, country: string,
  docs: string, livrables: Record<string, any | null>,
  truthBlock: string, progressionBlock: string,
): string {
  const today = new Date().toISOString().split('T')[0];
  const livrablesPresents = Object.entries(livrables)
    .filter(([, v]) => v !== null)
    .map(([k]) => k);

  return `Réalise un BILAN DE PROGRESSION de "${name}" (Secteur: ${sector}, Pays: ${country}).
Date: ${today}. Livrables analysés: ${livrablesPresents.join(', ')}.

LIVRABLES (données résumées) :
${JSON.stringify(livrables, null, 1)}

${truthBlock}
${progressionBlock}

${docs ? `DOCUMENTS UPLOADÉS:\n${docs.slice(0, 2000)}` : ""}

RÈGLES :

1. PROBLÈMES : classe par urgence. "bloquant" = le bailleur rejette le dossier. "important" = le bailleur pose des questions. "mineur" = perfectionnement. Bloquants en PREMIER.
   Chaque problème a un constat chiffré (citer le livrable et la valeur) et une piste concrète.

2. QUESTIONS ENTREPRENEUR : 3-6 questions simples qui découlent des problèmes. Le coach les utilise pour son prochain RDV. Pas de questions génériques — chaque question pointe un chiffre ou une incohérence spécifique des livrables.

3. POINTS FORTS : inclure un "argument_bailleur" — une phrase que le coach peut réutiliser mot pour mot. Ex: "La marge brute de 68.8% témoigne d'un avantage concurrentiel structurel lié à l'intégration verticale."

4. INCOHÉRENCES ENTRE LIVRABLES : chaque incohérence est un problème. Citer les 2 valeurs et l'écart.

5. BENCHMARKS : comparer aux médianes du secteur et du pays.

Réponds en JSON selon ce schéma :
${BILAN_SCHEMA}`;
}

// ── Serve ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // Collecter TOUS les livrables disponibles
    const rawLivrables = {
      bmc:           ctx.deliverableMap["bmc_analysis"]   || null,
      sic:           ctx.deliverableMap["sic_analysis"]   || null,
      inputs:        ctx.deliverableMap["inputs_data"]    || null,
      framework:     ctx.deliverableMap["framework_data"] || null,
      plan_ovo:      ctx.deliverableMap["plan_ovo"]       || null,
      business_plan: ctx.deliverableMap["business_plan"]  || null,
      odd:           ctx.deliverableMap["odd_analysis"]   || null,
    };

    // Vérifier qu'au moins 2 livrables ont des données
    const availableCount = Object.values(rawLivrables)
      .filter(d => d && typeof d === 'object' && Object.keys(d).length > 0).length;
    if (availableCount < 2) {
      return errorResponse(
        "Au moins 2 livrables sont requis pour le bilan de progression. Complétez d'abord vos modules.",
        400
      );
    }

    // Résumer les livrables
    const livrables: Record<string, any | null> = {};
    for (const [k, v] of Object.entries(rawLivrables)) {
      livrables[k] = (v && typeof v === 'object' && Object.keys(v).length > 0)
        ? summarize(v)
        : null;
    }

    const pays = ent.country || "Côte d'Ivoire";
    const secteur = ent.sector || "Non spécifié";

    // Financial Truth Anchor
    const inputsRaw = rawLivrables.inputs;
    const truth = getFinancialTruth(inputsRaw);
    let truthBlock = "";
    if (truth) {
      truthBlock = `
══════ DONNÉES FINANCIÈRES RÉELLES ══════
CA N (${truth.annee_n}) : ${truth.ca_n.toLocaleString('fr-FR')} FCFA
CA N-1 : ${truth.ca_n_minus_1.toLocaleString('fr-FR')} FCFA
Marge brute : ${truth.marge_brute_pct}%
EBITDA : ${truth.ebitda.toLocaleString('fr-FR')} FCFA (${truth.ebitda_pct}%)
Trésorerie nette : ${truth.tresorerie_nette.toLocaleString('fr-FR')} FCFA
Toute déviation > 5% dans un livrable = problème "bloquant".
══════ FIN ══════
`;
    }

    // Diagnostic initial pour la progression
    const { data: preScreeningDeliv } = await ctx.supabase
      .from("deliverables").select("data")
      .eq("enterprise_id", ctx.enterprise_id).eq("type", "pre_screening").maybeSingle();

    const initialScore = (preScreeningDeliv?.data as any)?.pre_screening_score || null;
    let progressionBlock = "";
    if (initialScore) {
      const bloquants = (preScreeningDeliv?.data as any)?.guide_coach?.points_bloquants_pipeline || [];
      progressionBlock = `
══════ DIAGNOSTIC INITIAL ══════
Score initial : ${initialScore}/100
Bloquants : ${bloquants.map((b: any) => b.blocage || b).join(' | ')}
Indique lesquels sont levés et lesquels persistent.
══════ FIN ══════
`;
    }

    // RAG context
    const ragContext = await buildRAGContext(ctx.supabase, pays, secteur, ["benchmarks", "fiscal", "bailleurs", "reglementation"], "diagnostic_data");
    const validationRules = getValidationRulesPrompt();
    const sectorBenchmarks = getSectorKnowledgePrompt(secteur);

    const agentDocs = getDocumentContentForAgent(ent, "diagnostic", 80_000);
    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);
    const rawData = await callAI(
      SYSTEM_PROMPT,
      buildUserPrompt(ent.name, secteur, pays, agentDocs, livrables, truthBlock, progressionBlock) + coachingContext
        + `\n\n══════ RÈGLES DE VALIDATION CROISÉE ══════\n${validationRules}`
        + `\n\n══════ BENCHMARKS SECTORIELS ══════\n${sectorBenchmarks}`
        + ragContext
    );

    const data = normalizeDiagnostic(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "diagnostic_data", data, "diagnostic");

    return jsonResponse({ success: true, data, score: data.score_global || data.score || data.verdict_readiness?.score });
  } catch (e: any) {
    console.error("generate-diagnostic error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
