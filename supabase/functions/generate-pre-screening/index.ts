// v5 — fix timeout: reduce context, parallelize queries 2026-03-23
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getDocumentContentForAgent, getCoachingContext, getKnowledgeForAgent,
} from "../_shared/helpers_v5.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt, getValidationRulesPrompt } from "../_shared/financial-knowledge.ts";
import { normalizePreScreening } from "../_shared/normalizers.ts";
import { validateAndEnrich } from "../_shared/post-validator.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { detectRisks, buildRiskBlock } from "../_shared/risk-detector.ts";

const SYSTEM_PROMPT = `Tu es un consultant senior en accompagnement PME en Afrique subsaharienne (15 ans, UEMOA/CEMAC). Tu travailles pour un programme d'accélération et tu prépares le DIAGNOSTIC INITIAL d'une entreprise — le premier bilan que le coach lira avant de rencontrer l'entrepreneur.

═══ OBJECTIF ═══
Ce diagnostic répond à 3 questions :
1. Qui est cette entreprise ? (contexte, histoire, activité)
2. Où en est-elle ? (constats factuels par domaine)
3. Comment l'accompagner ? (guide pratique pour le coach)

═══ TON APPROCHE ═══

1. LIRE CHAQUE DOCUMENT EN PROFONDEUR
   - Extrais les chiffres EXACTS — pas des approximations
   - Si un document contient un bilan, un CR, un BMC, des infos RH, légales → extrais TOUT
   - Le coach veut savoir que TU AS TOUT LU

2. ANALYSER EN CONSULTANT, PAS EN COMPTABLE
   - "Le CA passe de 462M à 759M (+64%) puis chute à 460M (-39%)" c'est comptable
   - "L'entreprise a connu une année exceptionnelle (+64%) probablement liée à un contrat ponctuel, mais n'a pas su capitaliser : la chute de 39% suggère une dépendance client" c'est consultant
   - TOUJOURS expliquer le POURQUOI, pas juste le QUOI

3. REGROUPER LES CONSTATS PAR SCOPE
   Chaque constat (force, faiblesse, anomalie, risque) va dans UN des 5 scopes :
   - financier : rentabilité, trésorerie, structure de coûts, CA, marges, endettement
   - commercial : marché, clients, produits, positionnement prix, concentration client
   - operationnel : production, logistique, fournisseurs, risques opérationnels
   - equipe_rh : effectifs, compétences, organisation, masse salariale, risque homme-clé
   - legal_conformite : gouvernance, statuts, conformité réglementaire, reporting

4. PRÉPARER LE GUIDE DU COACH
   Le coach qui lit ce diagnostic doit pouvoir préparer sa première session en 15 minutes.

═══ RÈGLES ABSOLUES ═══
- CHIFFRES PRÉCIS : pas "le CA est élevé" mais "CA 460M FCFA en 2024, en baisse de 39% vs 759M en 2023"
- HONNÊTETÉ : un dossier faible est un dossier faible
- EXHAUSTIVITÉ : si une info est dans les documents, elle DOIT être dans ton analyse
- FORMAT : Réponds UNIQUEMENT en JSON valide selon le schéma fourni

GUIDE DU COACH (section guide_coach) :
Tu t'adresses au coach qui va accompagner cet entrepreneur. Donne-lui les outils pour sa prochaine session.
- questions_entrepreneur : 5-8 questions PRÉCISES liées aux problèmes détectés. Pas "comment va votre entreprise" mais "le CA a baissé de 39%, quelle en est la cause ?". Chaque question cite un chiffre ou une anomalie du dossier.
- documents_a_demander : classés par urgence. "bloquant" = sans ce document le pipeline ne peut pas avancer. "important" = améliore significativement la qualité. "utile" = complément.
- actions_coach_semaine : 3-5 actions concrètes pour CETTE SEMAINE, avec durée estimée.
- points_bloquants_pipeline : ce qui empêche les livrables d'être fiables.
- axes_coaching : vision 3-6 mois de l'accompagnement.
- alertes_coach : signaux inhabituels à investiguer.

CONTEXTE ENTREPRISE (section contexte_entreprise) :
Décris l'entreprise en 3 blocs courts (histoire, marché, activité) pour qu'un coach qui ne connaît pas la boîte comprenne le business en 1 minute.
- histoire : trajectoire factuelle avec chiffres (CA 3 ans, dates clés). Pas "l'entreprise a été fondée avec la vision de..." mais "créée en 2018, CA passé de 462M à 759M (+64%) puis 460M (-39%)".
- marche : taille, croissance, concurrence, positionnement. Données chiffrées si disponibles.
- activite : description concrète des produits/services et du modèle de revenu. Si plusieurs activités, indiquer le poids estimé de chacune.

CONSTATS PAR SCOPE (section constats_par_scope) :
Regroupe TOUS tes constats (forces, faiblesses, anomalies, risques) par domaine.
Chaque constat est classé : "urgent" (rouge — à traiter immédiatement), "attention" (orange — à surveiller), "positif" (vert — point fort à valoriser).
DANS CHAQUE SCOPE, classe les constats par sévérité : urgent d'abord, puis attention, puis positif.
Chaque constat DOIT citer des chiffres précis. Pas "les charges sont élevées" mais "les charges fixes représentent 46% du CA (111M FCFA) contre 25-35% en médiane sectorielle".
La piste est soit une action concrète (sévérité urgent/attention), soit un argument investisseur (sévérité positif).

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const PRE_SCREENING_SCHEMA = `{
  "pre_screening_score": <0-100>,
  "classification": "AVANCER_DIRECTEMENT | ACCOMPAGNER | COMPLETER_DABORD | REJETER",
  "classification_label": "string — label court lisible",
  "classification_detail": "string — 3-5 phrases argumentées justifiant la classification",

  "resume_executif": {
    "synthese": "string — 5-8 lignes, résumé complet du dossier pour un coach",
    "points_forts": ["string — 3-5 forces identifiées avec données chiffrées"],
    "points_faibles": ["string — 3-5 faiblesses avec données chiffrées"],
    "potentiel_estime": "string — 2-3 phrases sur le potentiel de l'entreprise"
  },

  "kpis_bandeau": {
    "ca_n": <number ou null — CA année N en FCFA>,
    "annee_n": "string — ex: 2024",
    "ca_growth_pct": <number ou null — évolution % vs N-1>,
    "marge_brute_pct": <number ou null>,
    "marge_brute_benchmark": "string — ex: top quartile | dans la norme | en dessous",
    "ebitda": <number ou null>,
    "tresorerie_nette": <number ou null>,
    "ca_nm1": <number ou null>,
    "ca_nm2": <number ou null>,
    "resultat_net": <number ou null>,
    "resultat_net_pct": <number ou null>,
    "nb_activites": <number ou null>,
    "liste_activites": "string ou null"
  },

  "contexte_entreprise": {
    "histoire": "string — 3-5 phrases. Quand a été créée l'entreprise, par qui, quelle trajectoire. Citer les chiffres clés (CA 3 ans, moments charnières). Des faits, pas de blabla.",
    "marche": "string — 3-5 phrases. Quel marché, quelle taille, quelle dynamique, quelle concurrence. Positionnement.",
    "activite": "string — 3-5 phrases. Quels produits/services, comment ça fonctionne, quel modèle de revenu. Si plusieurs activités, les décrire et estimer leur poids relatif."
  },

  "guide_coach": {
    "questions_entrepreneur": [
      "string — question précise liée à un problème détecté. Chaque question cite un chiffre. Ex: 'Le CA a chuté de 39% entre 2023 (759M) et 2024 (460M). Quelle en est la cause ?'"
    ],
    "documents_a_demander": [
      {
        "document": "string",
        "raison": "string",
        "urgence": "bloquant | important | utile",
        "impact": "string"
      }
    ],
    "actions_coach_semaine": [
      {
        "priorite": <number 1-5>,
        "action": "string",
        "objectif": "string",
        "duree_estimee": "string — 30min | 1h | demi-journée"
      }
    ],
    "points_bloquants_pipeline": [
      {
        "blocage": "string",
        "consequence": "string",
        "resolution": "string"
      }
    ],
    "axes_coaching": [
      {
        "axe": "string — thématique",
        "diagnostic_rapide": "string — 2-3 phrases",
        "objectif_accompagnement": "string — où l'amener en 3-6 mois",
        "premieres_actions": ["string"]
      }
    ],
    "alertes_coach": [
      "string — signaux à investiguer"
    ]
  },

  "constats_par_scope": {
    "financier": [
      {
        "titre": "string",
        "severite": "urgent | attention | positif",
        "constat": "string — factuel, chiffré, 2-3 phrases",
        "piste": "string — action concrète ou argument investisseur"
      }
    ],
    "commercial": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string" }],
    "operationnel": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string" }],
    "equipe_rh": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string" }],
    "legal_conformite": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string" }]
  },

  "qualite_dossier": {
    "score_qualite": <0-100>,
    "total_documents": <number>,
    "documents_exploitables": <number>,
    "documents_illisibles": <number>,
    "niveau_preuve": "N0 Declaratif | N1 Faible | N2 Intermediaire | N3 Solide",
    "couverture": {
      "finance": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] },
      "legal": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] },
      "commercial": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] },
      "rh": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] }
    },
    "note_qualite": "string — paragraphe d'évaluation de la qualité documentaire"
  },

  "sante_financiere": {
    "ca_estime": <number ou null>,
    "marge_brute_pct": <number ou null>,
    "marge_nette_pct": <number ou null>,
    "ratio_endettement_pct": <number ou null>,
    "tresorerie_nette": <number ou null>,
    "benchmark_comparison": [
      {
        "indicateur": "string",
        "valeur_entreprise": "string",
        "benchmark_secteur": "string",
        "verdict": "conforme | optimiste | alerte | critique"
      }
    ],
    "health_label": "Saine | Fragile | Critique | Non evaluable",
    "health_detail": "string"
  },

  "cross_validation": {
    "ca_coherent": true|false,
    "ca_declared": <number ou null>,
    "ca_from_documents": <number ou null>,
    "ca_ecart_pct": <number ou null>,
    "ca_detail": "string",
    "bilan_equilibre": true|false,
    "bilan_detail": "string",
    "charges_vs_effectifs": true|false,
    "charges_vs_effectifs_detail": "string",
    "tresorerie_coherent": true|false,
    "tresorerie_detail": "string",
    "dates_coherentes": true|false,
    "dates_detail": "string"
  },

  "analyse_narrative": {
    "comparaison_sectorielle": {
      "positionnement_global": "string — 2-3 phrases",
      "benchmark_detail": [
        {
          "indicateur": "string",
          "valeur_entreprise": "string",
          "mediane_secteur": "string",
          "top_quartile": "string",
          "bottom_quartile": "string",
          "position": "top | above_median | median | below_median | bottom",
          "commentaire": "string"
        }
      ]
    },
    "scenarios_prospectifs": {
      "scenario_pessimiste": { "description": "string", "ca_estime": "string", "ebitda_estime": "string", "probabilite": "string" },
      "scenario_base": { "description": "string", "ca_estime": "string", "ebitda_estime": "string", "probabilite": "string" },
      "scenario_optimiste": { "description": "string", "ca_estime": "string", "ebitda_estime": "string", "probabilite": "string" }
    },
    "verdict_analyste": {
      "synthese_pour_comite": "string — 3-5 phrases de verdict final",
      "deal_breakers": ["string"],
      "conditions_sine_qua_non": ["string"],
      "quick_wins": ["string"]
    }
  },

  "programme_match": null | {
    "programme_name": "string",
    "match_score": <0-100>,
    "criteres_ok": [{ "critere": "string", "detail": "string" }],
    "criteres_ko": [{ "critere": "string", "detail": "string", "comment_corriger": "string" }],
    "criteres_partiels": [{ "critere": "string", "detail": "string", "manque": "string" }],
    "recommandation": "string"
  }
}`;

serve(async (req) => {
  console.log("[generate-pre-screening] v5 loaded");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Clone BEFORE verifyAndGetContext consumes req.json()
    let programmeCriteria: any = null;
    let programmeCriteriaId: string | null = null;
    try {
      const bodyClone = await req.clone().json().catch(() => ({}));
      programmeCriteria = bodyClone.programme_criteria || null;
      programmeCriteriaId = bodyClone.programme_criteria_id || null;
    } catch (_) {}

    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    const sectorBenchmarks = getSectorKnowledgePrompt(ent.sector || "services_b2b");
    const donorCriteria = getDonorCriteriaPrompt();
    const validationRules = getValidationRulesPrompt();

    // Parallel block 1: inputs, RAG, programme criteria
    const [inputsRes, ragContext, pcRes] = await Promise.all([
      ctx.supabase.from("deliverables").select("data, score")
        .eq("enterprise_id", ctx.enterprise_id).eq("type", "inputs_data").maybeSingle(),
      buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "pre_screening"),
      programmeCriteriaId && !programmeCriteria
        ? ctx.supabase.from("programme_criteria").select("*").eq("id", programmeCriteriaId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const inputsData = inputsRes?.data?.data || null;

    // Resolve programme criteria
    let rawCriteriaText: string | null = null;
    if (pcRes?.data && !programmeCriteria) {
      programmeCriteria = pcRes.data;
      rawCriteriaText = (pcRes.data as any).raw_criteria_text || null;
    } else if (programmeCriteria?.raw_criteria_text) {
      rawCriteriaText = programmeCriteria.raw_criteria_text;
    }

    let programmeSection: string;
    if (programmeCriteria) {
      const structuredPart = JSON.stringify(programmeCriteria, null, 2);
      const rawPart = rawCriteriaText
        ? `\n\n══════ DOCUMENT SOURCE DU PROGRAMME (TEXTE COMPLET) ══════\n${rawCriteriaText.substring(0, 15000)}\n══════ FIN DOCUMENT SOURCE ══════`
        : "";
      programmeSection = `\n══════ CRITÈRES DU PROGRAMME ══════\n${structuredPart}${rawPart}\nCompare le dossier à ces critères et remplis programme_match. Utilise le document source pour les détails qualitatifs.`;
    } else {
      programmeSection = `\nAucun critère programme — laisse programme_match à null.`;
    }

    // Financial Truth Anchor
    const { getFinancialTruth } = await import("../_shared/normalizers.ts");
    const truth = getFinancialTruth(inputsData);
    let truthBlock = "";
    if (truth) {
      truthBlock = `
══════ VÉRITÉ FINANCIÈRE (ÉTATS FINANCIERS) ══════
CA = ${truth.ca_n.toLocaleString('fr-FR')} FCFA (année ${truth.annee_n})
Trésorerie nette = ${truth.tresorerie_nette.toLocaleString('fr-FR')} FCFA
EBITDA = ${truth.ebitda.toLocaleString('fr-FR')} FCFA
Marge brute = ${truth.marge_brute_pct}%
Endettement = ${truth.endettement.toLocaleString('fr-FR')} FCFA
Résultat net = ${truth.resultat_net.toLocaleString('fr-FR')} FCFA
⚠ UTILISER CES CHIFFRES — ils viennent des états financiers certifiés
══════ FIN ══════
`;
    }

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS DÉCLARÉS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
DESCRIPTION : ${ent.description || "Non spécifié"}

${truthBlock}

══════ DOCUMENTS UPLOADÉS (MATIÈRE BRUTE) ══════
${getDocumentContentForAgent(ent, "pre_screening", 250_000) || "(Aucun document uploadé)"}

══════ DONNÉES RECONSTITUÉES PAR L'IA ══════
${inputsData ? JSON.stringify(inputsData).substring(0, 8000) : "(Pas encore de reconstruction — analyse uniquement les documents bruts)"}

══════ BENCHMARKS SECTORIELS ══════
${sectorBenchmarks}

══════ RÈGLES DE VALIDATION ══════
${validationRules}

══════ CRITÈRES BAILLEURS ══════
${donorCriteria}

${ragContext}
${programmeSection}

══════ INSTRUCTIONS ══════
Fais un DIAGNOSTIC INITIAL complet de ce dossier. C'est le premier bilan que le coach lira.
Remplis les 3 blocs clés : contexte_entreprise (histoire/marché/activité), constats_par_scope (tous les constats regroupés par domaine), guide_coach (questions, documents, actions).
Compare CHAQUE ratio financier aux benchmarks du secteur.
Remplis kpis_bandeau avec les chiffres financiers clés.
Classe le dossier : AVANCER_DIRECTEMENT / ACCOMPAGNER / COMPLETER_DABORD / REJETER.

Réponds en JSON selon ce schéma :
${PRE_SCREENING_SCHEMA}`;

    // Parallel block 2: KB context, risk factors, coaching context
    const [kbContext, riskRes, coachingContext] = await Promise.all([
      getKnowledgeForAgent(ctx.supabase, ent.country || "", ent.sector || "", "pre_screening"),
      ctx.supabase.from('knowledge_risk_factors').select('*').eq('is_active', true),
      getCoachingContext(ctx.supabase, ctx.enterprise_id),
    ]);

    let riskBlock = "";
    try {
      const riskFactors = riskRes?.data;
      if (riskFactors?.length && inputsData) {
        const id = inputsData as any;
        const financialData = {
          salaire_dirigeant: id.salaire_dirigeant,
          ebitda: id.ebitda || id.resultat_exploitation, ca: id.ca || id.chiffre_affaires,
          tresorerie: id.tresorerie_nette || id.tresorerie,
          capitaux_propres: id.capitaux_propres,
          capital_social: id.capital_social,
        };
        const flags = detectRisks(financialData, riskFactors);
        riskBlock = buildRiskBlock(flags);
      }
    } catch (e) { console.warn("[pre-screening] risk detection non-blocking:", e); }
    const rawData = await callAI(injectGuardrails(SYSTEM_PROMPT), prompt + coachingContext + kbContext + riskBlock, 32768);
    const normalizedData = normalizePreScreening(rawData);
    const validatedData = validateAndEnrich(normalizedData, ent.country, ent.sector);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "pre_screening", validatedData, "diagnostic");

    if (normalizedData.pre_screening_score) {
      await ctx.supabase.from("enterprises").update({
        score_ir: normalizedData.pre_screening_score,
        last_activity: new Date().toISOString(),
      }).eq("id", ctx.enterprise_id);
    }

    return jsonResponse({ success: true, data: normalizedData });
  } catch (e: any) {
    console.error("generate-pre-screening error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
