// v5 — diagnostic business expert 2026-03-20
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, errorResponse, jsonResponse,
  verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  getFiscalParams, getDocumentContentForAgent
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

const SYSTEM_PROMPT = `Tu es un consultant senior en stratégie et finance d'entreprise, spécialisé dans l'accompagnement de PME africaines vers l'investment readiness. Tu as 15 ans d'expérience avec des entreprises en Afrique de l'Ouest (UEMOA).

Tu as analysé l'ensemble des livrables du pipeline (BMC, SIC, Framework financier, Plan OVO, Business Plan, ODD, Valorisation) et tu produis un DIAGNOSTIC BUSINESS complet.

TON APPROCHE :
- Tu t'adresses au coach et à l'entrepreneur. Ton diagnostic doit les aider à COMPRENDRE où en est l'entreprise et QUOI FAIRE pour progresser
- Tu es direct et honnête sans être alarmiste. Si un point est faible, tu le dis clairement avec les chiffres, puis tu proposes une piste d'amélioration
- Tu donnes des PISTES DE RÉFLEXION, pas des ordres. L'entrepreneur connaît son business mieux que toi — tu apportes un regard extérieur structuré
- Chaque observation est CHIFFRÉE et COMPARÉE aux benchmarks du secteur

LES 6 AXES DE TON DIAGNOSTIC :

1. MODÈLE ÉCONOMIQUE & POSITIONNEMENT
   - Le business model est-il clair et cohérent ? (Proposition de valeur ↔ Segments ↔ Revenus)
   - Les sources de revenus sont-elles diversifiées ou concentrées ?
   - Le positionnement prix est-il adapté au marché ?
   - Piste de réflexion : comment renforcer l'avantage concurrentiel ?

2. SANTÉ FINANCIÈRE ACTUELLE
   - Les ratios clés sont-ils dans les normes sectorielles ? (Marge brute, EBITDA, endettement, trésorerie)
   - La structure de coûts est-elle maîtrisée ? (Charges fixes vs variables, masse salariale/CA)
   - Y a-t-il des signaux de fragilité ? (Volatilité CA, dépendance client, BFR tendu)
   - Piste de réflexion : quels leviers pour améliorer la rentabilité ?

3. CRÉDIBILITÉ DES PROJECTIONS
   - Les hypothèses de croissance sont-elles réalistes pour le secteur et le pays ?
   - Les marges projetées sont-elles soutenables ?
   - Le besoin de financement est-il correctement dimensionné ?
   - Piste de réflexion : quel scénario conservateur serait plus crédible pour un investisseur ?

4. IMPACT & DURABILITÉ
   - L'impact social est-il mesurable et documenté ? (Emplois, inclusion, formation)
   - L'alignement ODD est-il crédible ou superficiel ?
   - Les risques ESG sont-ils identifiés et gérés ?
   - Piste de réflexion : comment renforcer la proposition d'impact ?

5. GOUVERNANCE & CAPACITÉ D'EXÉCUTION
   - L'équipe a-t-elle les compétences pour exécuter le plan ?
   - La gouvernance est-elle structurée (CA, reporting, contrôle) ?
   - Les risques opérationnels clés sont-ils mitigés ?
   - Piste de réflexion : quels recrutements ou structurations prioritaires ?

6. INVESTMENT READINESS — OÙ EN EST-ON ?
   - L'entreprise est-elle prête à recevoir un investisseur aujourd'hui ?
   - Quels sont les 3-5 éléments bloquants à résoudre en priorité ?
   - Quel type de financement est le plus adapté au stade actuel ?
   - Piste de réflexion : quel parcours sur 3-6 mois pour être prêt ?

TON & LANGAGE :
- Modéré et professionnel — ni enthousiaste ni alarmiste
- Utilise le nom de l'entreprise, pas "vous" ni "nous"
- Formule les faiblesses comme des constats objectifs suivis de pistes : "La marge EBITDA de 10.2% est en dessous de la médiane sectorielle (15-20%). Cela s'explique par des charges fixes élevées (46% du CA). Une réduction de 10% des services extérieurs permettrait de gagner 2 points de marge"
- Les forces sont des constats positifs : "La marge brute de 68.8% se situe dans le quartile supérieur du secteur, ce qui traduit un bon pricing power"
- Les recommandations sont des pistes de réflexion numérotées par priorité, pas des injonctions

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

    // Base de connaissances par pays — use centralized fiscal params
    const fp = getFiscalParams(pays);
    const kbContext = {
      pays,
      secteur,
      reglementation_fiscale: {
        tva: fp.tva,
        is: fp.is,
        charges_sociales_employeur: fp.cotisations_sociales,
        smig_mensuel: fp.smig,
        unite: fp.devise
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

    // RAG: enrichir avec données de la base de connaissances
    const ragContext = await buildRAGContext(ctx.supabase, pays, secteur, ["benchmarks", "fiscal", "bailleurs", "reglementation"], "diagnostic_data");

    const validationRules = getValidationRulesPrompt();
    const sectorBenchmarks = getSectorKnowledgePrompt(secteur);

    // Financial Truth Anchor
    const inputsRaw = rawLivrables.inputs;
    const truth = getFinancialTruth(inputsRaw);
    let truthBlock = "";
    if (truth) {
      truthBlock = `

══════ DONNÉES FINANCIÈRES RÉELLES (ÉTATS FINANCIERS) ══════
⚠ CES CHIFFRES SONT LA VÉRITÉ — base ton diagnostic financier sur ces données
CA N (${truth.annee_n}) : ${truth.ca_n.toLocaleString('fr-FR')} FCFA
CA N-1 : ${truth.ca_n_minus_1.toLocaleString('fr-FR')} FCFA
CA N-2 : ${truth.ca_n_minus_2.toLocaleString('fr-FR')} FCFA
Marge brute : ${truth.marge_brute.toLocaleString('fr-FR')} FCFA (${truth.marge_brute_pct}%)
EBITDA : ${truth.ebitda.toLocaleString('fr-FR')} FCFA (${truth.ebitda_pct}%)
Résultat net : ${truth.resultat_net.toLocaleString('fr-FR')} FCFA
Trésorerie nette : ${truth.tresorerie_nette.toLocaleString('fr-FR')} FCFA
Charges personnel : ${truth.charges_personnel.toLocaleString('fr-FR')} FCFA
Endettement : ${truth.endettement.toLocaleString('fr-FR')} FCFA

Utilise ces chiffres comme référence pour ton diagnostic financier. Compare aux benchmarks sectoriels.
══════ FIN DONNÉES ══════
`;
    }

    const agentDocs = getDocumentContentForAgent(ent, "diagnostic", 80_000);
    const rawData = await callAI(
      SYSTEM_PROMPT,
      buildUserPrompt(ent.name, secteur, pays, agentDocs, livrables, kbContext)
        + truthBlock
        + `\n\n══════ RÈGLES DE VALIDATION CROISÉE ══════\n${validationRules}`
        + `\n\n══════ BENCHMARKS SECTORIELS ══════\n${sectorBenchmarks}`
        + ragContext
    );

    const data = normalizeDiagnostic(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "diagnostic_data", data, "diagnostic");

    return jsonResponse({ success: true, data, score: data.score_global || data.score });
  } catch (e: any) {
    console.error("generate-diagnostic error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
