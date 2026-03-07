import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, errorResponse, jsonResponse,
  verifyAndGetContext, callAI, saveDeliverable
} from "../_shared/helpers.ts";
import { normalizeDiagnostic } from "../_shared/normalizers.ts";

// ── Helpers locaux ──────────────────────────────────────────────────────────

/** Extrait les données essentielles d'un livrable pour limiter la taille du prompt */
function summarize(data: any): any {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
  const d = data as Record<string, any>;
  return {
    score: d.score || d.score_global,
    // BMC
    canvas: d.canvas ? {
      proposition_valeur: d.canvas.proposition_valeur?.enonce || d.canvas.proposition_valeur,
      segments_clients: d.canvas.segments_clients?.principal || d.canvas.segments_clients,
      flux_revenus: d.canvas.flux_revenus?.produit_principal || d.canvas.flux_revenus?.sources_revenus,
      structure_couts: d.canvas.structure_couts?.postes?.slice(0, 5),
    } : undefined,
    // SIC
    mission_sociale: d.mission_sociale,
    odd_alignment: Array.isArray(d.odd_alignment) ? d.odd_alignment.slice(0, 5) : undefined,
    // Framework / Inputs
    kpis: d.kpis,
    compte_resultat: d.compte_resultat,
    sante_financiere: d.sante_financiere ? { forces: d.sante_financiere.forces, faiblesses: d.sante_financiere.faiblesses } : undefined,
    projection_5ans: d.projection_5ans ? { verdict: d.projection_5ans.verdict } : undefined,
    analyse_marge: d.analyse_marge ? { activites: d.analyse_marge.activites?.slice(0, 5), verdict: d.analyse_marge.verdict } : undefined,
    // Plan OVO
    revenue: d.revenue,
    ebitda: d.ebitda,
    net_profit: d.net_profit,
    funding_need: d.funding_need,
    scenarios: d.scenarios ? {
      realiste: { revenue_year5: d.scenarios.realiste?.revenue_year5, tri: d.scenarios.realiste?.tri },
      pessimiste: { revenue_year5: d.scenarios.pessimiste?.revenue_year5 },
    } : undefined,
    // Business Plan
    resume_executif: d.resume_executif ? {
      accroche: d.resume_executif.accroche,
      probleme: d.resume_executif.probleme,
      solution: d.resume_executif.solution,
      besoin_financement: d.resume_executif.besoin_financement,
    } : undefined,
    analyse_marche: d.analyse_marche ? { taille_marche: d.analyse_marche.taille_marche, positionnement: d.analyse_marche.positionnement } : undefined,
    // ODD
    evaluation_cibles_odd: d.evaluation_cibles_odd ? {
      resume_par_odd: d.evaluation_cibles_odd.resume_par_odd,
    } : undefined,
    synthese: typeof d.synthese === 'string' ? d.synthese : d.synthese?.contribution_globale,
    // Champs communs
    recommandations: Array.isArray(d.recommandations) ? d.recommandations.slice(0, 3) : undefined,
    verdict: d.verdict,
    synthese_executive: d.synthese_executive,
  };
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un coach expert en Investment Readiness pour PME en Afrique de l'Ouest (UEMOA). Tu es bienveillant, pédagogique et constructif. Ton rôle est d'accompagner l'entrepreneur dans son apprentissage, pas de le juger.

MISSION : Analyser TOUS les livrables fournis et produire un DIAGNOSTIC GLOBAL EXPERT complet.

TON & LANGAGE :
- Utilise un langage bienveillant et encourageant
- Évite les mots alarmistes : "critique", "échec", "dangereux", "grave", "catastrophique"
- Remplace par : "à améliorer", "opportunité d'optimisation", "point d'attention", "suggestion"
- Formule les points faibles comme des opportunités d'amélioration
- Utilise le "nous" : "Nous pouvons améliorer...", "Ensemble, nous allons..."
- Félicite les points forts avec chaleur
- Le score est un indicateur discret, pas LA métrique centrale

IMPORTANT: Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks.`;

function buildUserPrompt(
  name: string, sector: string, country: string,
  docs: string, livrables: Record<string, any | null>,
  kb: any
): string {
  const today = new Date().toISOString().split('T')[0];
  const livrablesPresents = Object.entries(livrables)
    .filter(([, v]) => v !== null)
    .map(([k]) => k);

  return `Réalise un DIAGNOSTIC GLOBAL EXPERT de "${name}" (Secteur: ${sector}, Pays: ${country}).
Date: ${today}. Livrables analysés: ${livrablesPresents.join(', ')}.

LIVRABLES (données résumées) :
${JSON.stringify(livrables, null, 1)}

CONTEXTE RÉGLEMENTAIRE & BENCHMARKS (${country}) :
${JSON.stringify(kb, null, 1)}

${docs ? `DOCUMENTS UPLOADÉS:\n${docs.slice(0, 2000)}` : ""}

Génère le JSON suivant (respecte EXACTEMENT cette structure) :

{
  "metadata": {
    "nom_entreprise": "${name}",
    "pays": "${country}",
    "secteur": "${sector}",
    "date_generation": "${today}",
    "livrables_analyses": ${JSON.stringify(livrablesPresents)},
    "donnees_completes": ${livrablesPresents.length >= 3},
    "kb_utilisee": true
  },
  "score_global": <nombre 0-100>,
  "palier": "<en_construction|a_renforcer|potentiel|bien_avance|excellent>",
  "label": "<En construction|À renforcer|Potentiel|Bien avancé|Excellent>",
  "couleur": "<🟠|🟡|🟢|💚|✅>",
  "resume_executif": "<texte 4-6 paragraphes, bienveillant, cite les livrables analysés>",
  "scores_dimensions": {
    "coherence": {
      "score": <0-100>, "label": "Cohérence entre livrables", "poids": 25,
      "commentaire": "<2-3 phrases>",
      "incoherences_detectees": [{"type": "bmc_framework|etc", "champ": "", "valeur_livrable_1": "", "valeur_livrable_2": "", "ecart": "", "explication": ""}],
      "analyse_detaillee": "<3-4 phrases>"
    },
    "viabilite": {
      "score": <0-100>, "label": "Viabilité économique", "poids": 25,
      "commentaire": "<2-3 phrases>",
      "seuil_rentabilite_mois": <nombre ou null>,
      "dscr": <nombre ou null>,
      "cash_flow_positif_mois": <nombre ou null>,
      "analyse_detaillee": "<3-4 phrases>"
    },
    "realisme": {
      "score": <0-100>, "label": "Réalisme des projections", "poids": 20,
      "commentaire": "<2-3 phrases>",
      "red_flags": ["<flag 1>", "<flag 2>"],
      "analyse_detaillee": "<3-4 phrases>"
    },
    "completude_couts": {
      "score": <0-100>, "label": "Complétude des coûts", "poids": 15,
      "commentaire": "<2-3 phrases>",
      "postes_manquants": ["<poste>"],
      "postes_presents": ["<poste>"],
      "analyse_detaillee": "<2-3 phrases>"
    },
    "capacite_remboursement": {
      "score": <0-100>, "label": "Capacité de remboursement", "poids": 15,
      "commentaire": "<2-3 phrases>",
      "dscr": <nombre ou null>,
      "duree_remboursement_ans": <nombre ou null>,
      "taux_endettement": <nombre ou null>,
      "analyse_detaillee": "<2-3 phrases>"
    }
  },
  "forces": [
    {"titre": "", "justification": "<2 phrases>", "livrable_source": "", "impact": ""}
  ],
  "opportunites_amelioration": [
    {"titre": "", "justification": "<2 phrases>", "priorite": "elevee|moyenne|faible", "livrable_concerne": "", "impact_viabilite": ""}
  ],
  "points_vigilance": [
    {"categorie": "financier|operationnel|strategique|esg|contextuel", "niveau": "eleve|moyen|faible", "titre": "", "description": "", "impact_financier": "", "action_recommandee": "", "livrable_concerne": ""}
  ],
  "incoherences": [
    {"type": "bmc_framework|bmc_sic|framework_plan_ovo|sic_odd|framework_business_plan", "champ": "", "valeur_livrable_1": "", "valeur_livrable_2": "", "ecart": "", "explication": "", "action_corrective": ""}
  ],
  "recommandations": [
    {"priorite": 1, "titre": "", "detail": "<2-3 phrases>", "impact_viabilite": "", "urgence": "elevee|moyenne|faible", "action_concrete": "", "message_encourageant": "", "livrable_a_modifier": ""}
  ],
  "benchmarks": {
    "marge_brute": {"entreprise": <nombre ou null>, "secteur_min": <nombre>, "secteur_max": <nombre>, "verdict": "ok|moyen|bas", "ecart": "", "source": ""},
    "marge_nette": {"entreprise": <nombre ou null>, "secteur_min": <nombre>, "secteur_max": <nombre>, "verdict": "ok|moyen|bas", "ecart": "", "source": ""},
    "charges_fixes_ca": {"entreprise": <nombre ou null>, "secteur_min": <nombre>, "secteur_max": <nombre>, "verdict": "ok|moyen|bas", "ecart": "", "source": ""},
    "masse_salariale_ca": {"entreprise": <nombre ou null>, "secteur_min": <nombre>, "secteur_max": <nombre>, "verdict": "ok|moyen|bas", "ecart": "", "source": ""},
    "dscr": {"entreprise": <nombre ou null>, "secteur_min": 1.2, "secteur_max": 2.5, "verdict": "ok|moyen|bas", "ecart": "", "source": ""}
  },
  "avis_par_livrable": {
    ${livrablesPresents.map(l => `"${l}": {"present": true, "qualite": "excellent|bon|moyen|a_ameliorer", "points_forts": ["", ""], "points_amelioration": ["", ""], "avis_global": "<3-5 phrases>", "recommandations_specifiques": ["", ""]}`).join(',\n    ')}
  },
  "synthese_globale": {
    "avis_ensemble": "<5-8 paragraphes bienveillants sur l'ensemble du projet>",
    "points_cles_a_retenir": ["<point 1>", "<point 2>", "<point 3>", "<point 4>", "<point 5>"],
    "demarche_recommandee": [
      {"etape": 1, "action": "", "livrable_concerne": "", "raison": ""}
    ],
    "prochaines_etapes": ["<étape 1>", "<étape 2>", "<étape 3>"]
  },
  "points_attention_prioritaires": ["<point 1>", "<point 2>", "<point 3>"],
  "message_incomplet": "<message si données insuffisantes, sinon vide>"
}

RÈGLES CRITIQUES :
1. Analyser UNIQUEMENT les livrables présents (ne pas inventer de données manquantes)
2. Pour chaque livrable présent → avis complet dans "avis_par_livrable"
3. Détecter incohérences réelles entre livrables (BMC ↔ Framework CA, SIC ↔ ODD alignement, etc.)
4. Ton TOUJOURS bienveillant — faiblesses = opportunités d'amélioration
5. benchmarks PAR PAYS (utiliser le kbContext fourni)
6. JSON valide UNIQUEMENT, pas de texte avant ou après`;
}

// ── Serve ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // Collecter TOUS les livrables disponibles (via deliverableMap uniquement)
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
        "Au moins 2 livrables sont requis pour le diagnostic (ex: BMC + Framework). Complétez d'abord vos modules.",
        400
      );
    }

    // Résumer les livrables pour ne pas dépasser la fenêtre de contexte
    const livrables: Record<string, any | null> = {};
    for (const [k, v] of Object.entries(rawLivrables)) {
      livrables[k] = (v && typeof v === 'object' && Object.keys(v).length > 0)
        ? summarize(v)
        : null;
    }

    // Pays et secteur
    const pays = ent.country || "Côte d'Ivoire";
    const secteur = ent.sector || "Non spécifié";

    // Base de connaissances par pays (valeurs par défaut UEMOA)
    const kbContext = {
      pays,
      secteur,
      reglementation_fiscale: {
        tva: 18,
        is: pays === "Sénégal" ? 30 : pays === "Burkina Faso" ? 27.5 : pays === "Mali" ? 30 : pays === "Togo" ? 27 : 25,
        charges_sociales_employeur: pays === "Sénégal" ? 20 : pays === "Togo" ? 20.5 : 25,
        smig_mensuel: pays === "Sénégal" ? 60000 : pays === "Burkina Faso" ? 35000 : pays === "Mali" ? 40000 : pays === "Togo" ? 35000 : 75000,
        unite: "XOF"
      },
      benchmarks_sectoriels: {
        agroalimentaire:  { marge_brute: [35, 55], marge_nette: [5, 18], dscr_min: 1.2 },
        commerce:         { marge_brute: [15, 35], marge_nette: [2, 10], dscr_min: 1.2 },
        services:         { marge_brute: [50, 75], marge_nette: [10, 25], dscr_min: 1.3 },
        technologie:      { marge_brute: [60, 80], marge_nette: [15, 35], dscr_min: 1.5 },
        artisanat:        { marge_brute: [40, 60], marge_nette: [8, 20], dscr_min: 1.2 },
        construction:     { marge_brute: [20, 40], marge_nette: [5, 15], dscr_min: 1.3 },
      },
      bailleurs_uemoa: ["BOA", "Ecobank", "BCEAO PME", "BNDA", "BRVM", "Oikocredit", "Grameen Crédit Agricole"],
      source: "Données BCEAO / OHADA / secteur privé UEMOA 2024"
    };

    const rawData = await callAI(
      SYSTEM_PROMPT,
      buildUserPrompt(ent.name, secteur, pays, ctx.documentContent, livrables, kbContext)
    );

    const data = normalizeDiagnostic(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "diagnostic_data", data, "diagnostic");

    return jsonResponse({ success: true, data, score: data.score_global || data.score });
  } catch (e: any) {
    console.error("generate-diagnostic error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
