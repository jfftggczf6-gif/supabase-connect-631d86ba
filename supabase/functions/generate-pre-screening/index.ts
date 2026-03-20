// v3 — force redeploy 2026-03-19
// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getDocumentContentForAgent,
} from "../_shared/helpers_v5.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt, getValidationRulesPrompt } from "../_shared/financial-knowledge.ts";
import { normalizePreScreening } from "../_shared/normalizers.ts";
import { validateAndEnrich } from "../_shared/post-validator.ts";

const SYSTEM_PROMPT = `Tu es un analyste financier senior avec 15 ans d'expérience dans l'investissement PME en Afrique subsaharienne (fonds PE, DFI, bailleurs). Tu as analysé plus de 500 dossiers et siégé dans des comités d'investissement chez I&P, Proparco, et la BAD.

Tu reçois un dossier brut d'entreprise africaine et tu dois produire un PRE-SCREENING COMPLET — le document que tu présenterais à ton directeur pour qu'il décide en 5 minutes si le dossier mérite 2 jours de due diligence.

═══ TON APPROCHE ═══

1. LIRE CHAQUE DOCUMENT EN PROFONDEUR
   - Ne survole pas. Lis chaque tableau, chaque ligne de bilan, chaque poste du compte de résultat
   - Extrais les chiffres EXACTS des documents — pas des approximations
   - Si un document contient un Business Model Canvas, un plan commercial, une liste de produits/clients → extrais TOUT
   - Si un document contient des informations RH (effectifs, organigramme, salaires) → extrais TOUT
   - Si un document contient des infos légales (statuts, RCCM, forme juridique) → extrais TOUT
   - Le bailleur veut savoir que TU AS TOUT LU, pas juste les 3 premières pages

2. ANALYSER COMME UN ANALYSTE PE, PAS COMME UN COMPTABLE
   - Un comptable vérifie les chiffres. Un analyste PE raconte une HISTOIRE avec les chiffres
   - "Le CA passe de 462M à 759M (+64%) puis chute à 460M (-39%)" c'est comptable
   - "L'entreprise a connu une année exceptionnelle (+64%) probablement liée à un contrat ponctuel, mais n'a pas su capitaliser : la chute de 39% suggère une dépendance à un client unique ou un problème de récurrence" c'est analyste PE
   - TOUJOURS expliquer le POURQUOI, pas juste le QUOI

3. COMPARER SYSTÉMATIQUEMENT
   - Chaque ratio → comparaison avec la médiane sectorielle du pays
   - Chaque tendance → est-ce normal dans ce secteur ? exceptionnel ? préoccupant ?
   - Chaque anomalie → est-ce un red flag ou une spécificité sectorielle ?

4. ÉVALUER CHAQUE DIMENSION DU DOSSIER
   Tu dois couvrir ces 8 dimensions EXHAUSTIVEMENT (pas juste la finance) :
   
   a) FINANCE — États financiers, rentabilité, trésorerie, endettement, tendances 3 ans
   b) COMMERCIAL — Produits/services détaillés, tarifs, clients identifiés, canaux, récurrence, saisonnalité
   c) MARCHÉ — Secteur, taille marché, concurrence, positionnement, avantages compétitifs
   d) OPÉRATIONNEL — Chaîne de valeur, processus, capacité de production, fournisseurs clés
   e) ÉQUIPE & RH — Dirigeant, effectifs, compétences clés, gaps, masse salariale vs CA
   f) LÉGAL & CONFORMITÉ — Forme juridique, statuts, registre commerce, conformité fiscale/sociale
   g) ESG & IMPACT — Impact social, environnemental, ODD alignés, genre, emploi jeunes
   h) GOUVERNANCE — Structure décisionnelle, conseil d'administration, transparence, reporting

5. PRODUIRE DES NARRATIFS RICHES
   - Le résumé exécutif : 3-4 paragraphes qui racontent l'histoire complète du dossier
   - L'analyse de tendance : un paragraphe par indicateur clé avec causes et perspectives
   - Le verdict : argumenté comme une note à un comité d'investissement
   - Les scénarios : chiffrés et réalistes, pas vagues

6. SCORING MULTI-DIMENSIONNEL
   - Score global = moyenne pondérée de 8 dimensions
   - Chaque dimension a un score indépendant (0-100) avec justification
   - Les poids : Finance 20%, Commercial 15%, Marché 10%, Opérationnel 10%, Équipe 10%, Légal 10%, ESG 10%, Gouvernance 15%

═══ RÈGLES ABSOLUES ═══
- CHIFFRES PRÉCIS : pas "le CA est élevé" mais "CA 460M FCFA en 2024, en baisse de 39% vs 759M en 2023"
- HONNÊTETÉ : un dossier faible est un dossier faible. Pas de diplomatie qui masque les problèmes
- EXHAUSTIVITÉ : si une info est dans les documents, elle DOIT être dans ton analyse. Ne laisse rien de côté
- SOURCES : pour chaque affirmation chiffrée, indique de quel document vient le chiffre
- FORMAT : Réponds UNIQUEMENT en JSON valide selon le schéma fourni

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const PRE_SCREENING_SCHEMA = `{
  "pre_screening_score": <0-100>,
  "classification": "AVANCER_DIRECTEMENT | ACCOMPAGNER | COMPLETER_DABORD | REJETER",
  "classification_label": "string — label court lisible",
  "classification_detail": "string — 3-5 phrases argumentées justifiant la classification",

  "resume_executif": {
    "synthese": "string — 5-8 lignes, comme un analyste qui présente le dossier à son directeur",
    "points_forts": ["string — 3-5 forces identifiées avec données chiffrées"],
    "points_faibles": ["string — 3-5 faiblesses avec données chiffrées"],
    "potentiel_estime": "string — 2-3 phrases sur le potentiel de l'entreprise"
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

  "anomalies": [
    {
      "severity": "bloquant | attention | note",
      "category": "finance | documents | coherence | completude | gouvernance",
      "title": "string",
      "detail": "string — avec chiffres précis",
      "impact_investisseur": "string — conséquence concrète pour un bailleur",
      "recommendation": "string — action corrective précise",
      "effort": "facile | moyen | difficile",
      "responsable": "entrepreneur | coach | ia"
    }
  ],

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

  "potentiel_et_reconstructibilite": {
    "donnees_fiables": ["string"],
    "donnees_estimables_ia": ["string"],
    "donnees_non_reconstituables": ["string"],
    "fiabilite_pipeline_estimee": <0-100>,
    "fiabilite_detail": "string",
    "signaux_positifs": ["string"],
    "signaux_negatifs": ["string"]
  },

  "profil_risque": {
    "score_risque": <0-100>,
    "risques": [
      {
        "type": "operationnel | financier | marche | legal | gouvernance | pays",
        "description": "string",
        "probabilite": "faible | moyenne | elevee",
        "impact": "faible | moyen | fort",
        "mitigation": "string"
      }
    ]
  },

  "plan_action": [
    {
      "priorite": 1|2|3|4|5,
      "action": "string",
      "responsable": "entrepreneur | coach | ia",
      "delai": "string",
      "effort": "facile | moyen | difficile",
      "impact_score": "string",
      "bloquant_pipeline": true|false
    }
  ],

  "pathway_financement": {
    "type_recommande": "string",
    "bailleurs_potentiels": ["string"],
    "montant_eligible_estime": "string",
    "conditions_prealables": ["string"],
    "timeline_estimee": "string"
  },

  "recommandation_pipeline": {
    "lancer_pipeline": true|false,
    "raison": "string",
    "modules_pertinents": ["string"],
    "modules_inutiles": ["string"],
    "avertissement": "string ou null"
  },

  "programme_match": null | {
    "programme_name": "string",
    "match_score": <0-100>,
    "criteres_ok": [{ "critere": "string", "detail": "string" }],
    "criteres_ko": [{ "critere": "string", "detail": "string", "comment_corriger": "string" }],
    "criteres_partiels": [{ "critere": "string", "detail": "string", "manque": "string" }],
    "recommandation": "string"
  },

  "analyse_narrative": {
    "histoire_entreprise": "string — 4-5 paragraphes racontant l'histoire financière et stratégique complète. Écris comme un analyste PE qui présente à son comité. Inclus : origines, évolution du CA sur 3 ans avec CAUSES, événements marquants, situation actuelle, perspectives. Cite des chiffres précis de chaque document lu.",
    "analyse_tendance": {
      "tendance_ca": "string — 1 paragraphe",
      "tendance_rentabilite": "string — 1 paragraphe",
      "tendance_tresorerie": "string — 1 paragraphe",
      "tendance_endettement": "string — 1 paragraphe"
    },
    "analyse_commerciale": {
      "produits_services_identifies": ["string — chaque produit/service avec détails"],
      "clients_identifies": ["string — chaque client ou segment"],
      "modele_revenus": "string — 1 paragraphe décrivant comment l'entreprise génère ses revenus",
      "avantages_concurrentiels": ["string"],
      "risques_commerciaux": ["string"],
      "donnees_manquantes_commerciales": ["string"]
    },
    "analyse_operationnelle": {
      "chaine_valeur": "string",
      "capacite_production": "string",
      "fournisseurs_cles": ["string"],
      "processus_cles": ["string"],
      "risques_operationnels": ["string"]
    },
    "analyse_equipe": {
      "dirigeant": "string",
      "effectifs_estimes": "string",
      "competences_cles": ["string"],
      "gaps_critiques": ["string"],
      "masse_salariale_analyse": "string",
      "donnees_manquantes_rh": ["string"]
    },
    "analyse_legale": {
      "forme_juridique": "string",
      "immatriculation": "string",
      "conformite_fiscale": "string",
      "conformite_sociale": "string",
      "documents_legaux_presents": ["string"],
      "documents_legaux_manquants": ["string"],
      "risques_juridiques": ["string"]
    },
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
      ],
      "avantages_vs_pairs": ["string"],
      "handicaps_vs_pairs": ["string"]
    },
    "scenarios_prospectifs": {
      "scenario_pessimiste": { "description": "string", "ca_estime": "string", "probabilite": "string", "facteurs_declencheurs": ["string"] },
      "scenario_base": { "description": "string", "ca_estime": "string", "probabilite": "string", "hypotheses": ["string"] },
      "scenario_optimiste": { "description": "string", "ca_estime": "string", "probabilite": "string", "facteurs_declencheurs": ["string"] },
      "facteurs_cles_succes": ["string"]
    },
    "scoring_granulaire": {
      "score_global_calcule": <0-100>,
      "dimensions": [
        { "dimension": "Finance", "score": <0-100>, "poids": 20, "justification": "string" },
        { "dimension": "Commercial", "score": <0-100>, "poids": 15, "justification": "string" },
        { "dimension": "Marché", "score": <0-100>, "poids": 10, "justification": "string" },
        { "dimension": "Opérationnel", "score": <0-100>, "poids": 10, "justification": "string" },
        { "dimension": "Équipe & RH", "score": <0-100>, "poids": 10, "justification": "string" },
        { "dimension": "Légal & Conformité", "score": <0-100>, "poids": 10, "justification": "string" },
        { "dimension": "ESG & Impact", "score": <0-100>, "poids": 10, "justification": "string" },
        { "dimension": "Gouvernance", "score": <0-100>, "poids": 15, "justification": "string" }
      ]
    },
    "timeline_evenements": [
      { "date": "string", "evenement": "string", "impact": "positif | neutre | negatif", "source": "string" }
    ],
    "verdict_analyste": {
      "synthese_pour_comite": "string — 3-4 paragraphes argumentés et chiffrés",
      "niveau_conviction": "fort | modere | faible",
      "deal_breakers": ["string"],
      "conditions_sine_qua_non": ["string"],
      "quick_wins": ["string"],
      "questions_ouvertes": ["string"],
      "prochaines_etapes_recommandees": ["string"]
    }
  },

  "_confidence": {
    "ca_estime": { "level": <0-100>, "source": "string" },
    "marge_brute": { "level": <0-100>, "source": "string" },
    "sante_financiere": { "level": <0-100>, "source": "string" },
    "qualite_dossier": { "level": <0-100>, "source": "string" }
  }
}`;

serve(async (req) => {
  console.log("[generate-pre-screening] v3 loaded");
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

    // Get reconstructed inputs if they exist
    const { data: inputsDeliv } = await ctx.supabase
      .from("deliverables")
      .select("data, score")
      .eq("enterprise_id", ctx.enterprise_id)
      .eq("type", "inputs_data")
      .maybeSingle();

    const inputsData = inputsDeliv?.data || null;

    const sectorBenchmarks = getSectorKnowledgePrompt(ent.sector || "services_b2b");
    const donorCriteria = getDonorCriteriaPrompt();
    const validationRules = getValidationRulesPrompt();

    const ragContext = await buildRAGContext(
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "pre_screening"
    );

    // If a programme_criteria_id is provided, fetch the full record including raw_criteria_text
    let rawCriteriaText: string | null = null;
    if (programmeCriteriaId && !programmeCriteria) {
      const { data: pcRecord } = await ctx.supabase
        .from("programme_criteria")
        .select("*")
        .eq("id", programmeCriteriaId)
        .maybeSingle();
      if (pcRecord) {
        programmeCriteria = pcRecord;
        rawCriteriaText = (pcRecord as any).raw_criteria_text || null;
      }
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
Fais un TRIAGE COMPLET de ce dossier. C'est le premier regard d'un analyste — sois exhaustif et direct.
Compare CHAQUE ratio financier disponible aux benchmarks du secteur.
Évalue ce que l'IA pourrait reconstituer vs ce qui nécessite des documents réels.
Classe le dossier : AVANCER_DIRECTEMENT / ACCOMPAGNER / COMPLETER_DABORD / REJETER.
Le plan d'action doit être concret — pas "améliorer la gouvernance" mais "rédiger un PV d'AG et le faire signer".

Réponds en JSON selon ce schéma :
${PRE_SCREENING_SCHEMA}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 32768);
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
