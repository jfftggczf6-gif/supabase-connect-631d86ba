import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse,
} from "../_shared/helpers.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt, getValidationRulesPrompt } from "../_shared/financial-knowledge.ts";
import { normalizePreScreening } from "../_shared/normalizers.ts";

const SYSTEM_PROMPT = `Tu es un analyste financier senior qui fait le TRIAGE INITIAL de dossiers PME africaines pour des programmes de financement.

Tu reçois des données brutes : documents uploadés (relevés, factures, bilans partiels, photos) + données reconstituées par IA. Tu n'as PAS encore les livrables complets (BMC, Business Plan, etc.) — tu travailles sur la matière première.

TON RÔLE — en UN SEUL passage rapide tu dois :

1. ÉVALUER LA QUALITÉ DU DOSSIER
   - Les documents sont-ils exploitables ? Lisibles ? Pertinents ?
   - Quels domaines sont couverts (finance, légal, commercial) et lesquels sont vides ?
   - Quel est le niveau de preuve global (déclaratif vs documents solides) ?

2. DÉTECTER LES INCOHÉRENCES ET RED FLAGS
   - Bilan déséquilibré, marges irréalistes, CA vs effectifs incohérents
   - Documents contradictoires, dates incohérentes, chiffres ronds suspects
   - Indices de fraude ou de données fictives
   - Comparer chaque ratio aux benchmarks sectoriels fournis

3. ESTIMER LE POTENTIEL DE L'ENTREPRISE
   - Même avec des données partielles, quelle est la situation probable ?
   - Quels sont les signaux positifs (CA en croissance, marges saines, trésorerie positive) ?
   - Quels sont les signaux négatifs (déclin, surendettement, perte de clients) ?
   - L'entreprise a-t-elle un modèle économique viable ?

4. ÉVALUER CE QUE L'IA PEUT RECONSTITUER
   - Quelles données manquent mais pourraient être estimées par l'IA avec une confiance raisonnable ?
   - Quelles données sont irreconstituables (besoin de documents réels) ?
   - Si le pipeline IA était lancé, quel serait le niveau de fiabilité des livrables produits ?

5. CLASSIFIER LE DOSSIER
   - AVANCER DIRECTEMENT : dossier solide, données suffisantes → lancer le pipeline
   - ACCOMPAGNER : dossier prometteur mais incomplet → l'IA peut aider + quelques pièces à ajouter
   - COMPLÉTER D'ABORD : trop de trous → lister précisément ce qui manque avant de continuer
   - REJETER : incohérences fatales, données fictives, activité non viable

6. PRODUIRE UN PLAN D'ACTION CONCRET
   - Actions classées par priorité et par facilité
   - Pour chaque action : qui doit la faire (entrepreneur/coach/IA), combien de temps, quel impact

RÈGLES :
- Sois DIRECT et HONNÊTE — un bailleur préfère "ce dossier est insuffisant car..." plutôt qu'un avis diplomatique qui ne dit rien
- Cite des CHIFFRES PRÉCIS quand tu les as (pas "le CA est correct" mais "le CA de 150M FCFA est cohérent avec les 12 factures totalisant 142M")
- Compare SYSTÉMATIQUEMENT aux benchmarks sectoriels fournis
- Le résumé exécutif doit permettre au bailleur de décider en 30 secondes

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
    "donnees_fiables": ["string — données extraites des documents, utilisables en confiance"],
    "donnees_estimables_ia": ["string — données que l'IA peut estimer avec confiance raisonnable"],
    "donnees_non_reconstituables": ["string — données nécessitant un document réel"],
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
      "action": "string — action concrète et précise",
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
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // Optional: programme criteria
    let programmeCriteria: any = null;
    try {
      const body = await req.clone().json().catch(() => ({}));
      programmeCriteria = body.programme_criteria || null;
    } catch (_) {}

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
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"]
    );

    const programmeSection = programmeCriteria
      ? `\n══════ CRITÈRES DU PROGRAMME ══════\n${JSON.stringify(programmeCriteria, null, 2)}\nCompare le dossier à ces critères et remplis programme_match.`
      : `\nAucun critère programme — laisse programme_match à null.`;

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS DÉCLARÉS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
DESCRIPTION : ${ent.description || "Non spécifié"}

══════ DOCUMENTS UPLOADÉS (MATIÈRE BRUTE) ══════
${ctx.documentContent || "(Aucun document uploadé)"}

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

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 16384);
    const normalizedData = normalizePreScreening(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "pre_screening", normalizedData, "diagnostic");

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
