// v5 — Décision programme 2026-03-21
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getDocumentContentForAgent, getCoachingContext,
} from "../_shared/helpers_v5.ts";
import { normalizeScreeningReport, getFinancialTruth } from "../_shared/normalizers.ts";
import { validateAndEnrich } from "../_shared/post-validator.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt, getValidationRulesPrompt } from "../_shared/financial-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un chargé de programme senior dans une ONG/DFI avec 15 ans d'expérience en Afrique de l'Ouest. Tu évalues si une entreprise est éligible à un programme d'accompagnement et/ou de financement.

Tu as accès à TOUS les livrables du pipeline (BMC, SIC, Framework, Plan OVO, Business Plan, ODD, Valorisation, Diagnostic). Tu produis une DÉCISION PROGRAMME structurée.

TON APPROCHE :
- Tu donnes une décision claire et justifiée
- Tu évalues l'alignement avec les critères du programme (si fournis)
- Tu estimes l'impact attendu et sa mesurabilité
- Tu recommandes un montant et un type de financement adaptés
- Tu listes les conditions concrètes
- Tu identifies les risques pour le programme (pas pour l'entreprise — pour le PROGRAMME)

TON & LANGAGE :
- Formel mais accessible
- Chaque affirmation est chiffrée et sourcée
- La décision est tranchée — pas de "peut-être"

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const DECISION_SCHEMA = `{
  "metadata": {
    "nom_entreprise": "string",
    "pays": "string",
    "secteur": "string",
    "date_generation": "string",
    "programme": "string — nom du programme si connu, sinon 'Programme générique'"
  },

  "decision": {
    "verdict": "ÉLIGIBLE | CONDITIONNEL | HORS CIBLE",
    "justification": "string — 3-5 phrases. Pourquoi cette décision. Factuel et chiffré.",
    "niveau_conviction": <number 0-100>
  },

  "matching_criteres": {
    "score_matching": <number 0-100>,
    "criteres": [
      {
        "critere": "string — nom du critère",
        "statut": "ok | ko | partiel",
        "detail": "string — justification courte"
      }
    ]
  },

  "impact_attendu": {
    "emplois_directs": "string — nombre actuel et projeté",
    "emplois_indirects": "string — estimation",
    "beneficiaires": "string — qui bénéficie et combien",
    "odd_alignes": [
      {
        "odd": "string — ex: ODD 2 — Faim zéro",
        "contribution": "string — contribution concrète et mesurable"
      }
    ],
    "indicateurs_suivi": [
      {
        "indicateur": "string — ex: Nombre d'emplois créés",
        "baseline": "string — valeur actuelle",
        "cible": "string — valeur visée",
        "horizon": "string — à 12 mois, 24 mois..."
      }
    ]
  },

  "dimensionnement": {
    "montant_recommande": "string — montant ou fourchette en FCFA",
    "type_financement": "string — prêt | subvention | mixte (prêt + subvention) | garantie",
    "justification_montant": "string — 2-3 phrases expliquant comment le montant est calculé",
    "utilisation_fonds": [
      "string — poste de dépense. Ex: 'Équipement production : 15M FCFA'"
    ],
    "duree": "string — 12 mois, 24 mois...",
    "jalons": [
      {
        "mois": <number>,
        "jalon": "string — ce qui doit être atteint",
        "indicateur": "string — comment on mesure"
      }
    ]
  },

  "conditions": [
    {
      "condition": "string — ce qui doit être fait",
      "moment": "avant_financement | pendant | a_la_fin",
      "responsable": "entrepreneur | coach | bailleur",
      "detail": "string — précision si nécessaire"
    }
  ],

  "risques_programme": [
    {
      "risque": "string — risque pour le programme (pas pour l'entreprise)",
      "probabilite": "faible | moyenne | élevée",
      "impact": "string — conséquence pour le programme",
      "mitigation": "string — comment réduire le risque"
    }
  ]
}`;

serve(async (req) => {
  console.log("[generate-screening-report] v5 — decision programme");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Clone BEFORE verifyAndGetContext consumes req.json()
    let programmeCriteria: any = null;
    try {
      const bodyClone = await req.clone().json().catch(() => ({}));
      programmeCriteria = bodyClone.programme_criteria || null;
    } catch (_) { /* ignore */ }

    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // Gather existing deliverables for cross-validation
    const { data: existingDeliverables } = await ctx.supabase
      .from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDelivData = (type: string) => {
      const d = existingDeliverables?.find((del: any) => del.type === type);
      return d?.data && typeof d.data === "object" ? d.data : null;
    };

    const inputsData = getDelivData("inputs_data");
    const bmcData = getDelivData("bmc_analysis");
    const sicData = getDelivData("sic_analysis");
    const frameworkData = getDelivData("framework_data");
    const planOvoData = getDelivData("plan_ovo");
    const diagnosticData = getDelivData("diagnostic_data");
    const oddData = getDelivData("odd_analysis");
    const valuationData = getDelivData("valuation");
    const preScreeningData = getDelivData("pre_screening");

    const ragContext = await buildRAGContext(
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur", "bailleurs"], "screening_report"
    );

    // Financial Truth Anchor
    const truth = getFinancialTruth(inputsData);
    let truthBlock = "";
    if (truth) {
      truthBlock = `
══════ DONNÉES FINANCIÈRES RÉELLES ══════
CA N (${truth.annee_n}) : ${truth.ca_n.toLocaleString('fr-FR')} FCFA
CA N-1 : ${truth.ca_n_minus_1.toLocaleString('fr-FR')} FCFA
Marge brute : ${truth.marge_brute_pct}%
EBITDA : ${truth.ebitda.toLocaleString('fr-FR')} FCFA (${truth.ebitda_pct}%)
Trésorerie nette : ${truth.tresorerie_nette.toLocaleString('fr-FR')} FCFA
══════ FIN ══════
`;
    }

    // Build deliverables summary
    const delivSummary = [];
    if (inputsData) delivSummary.push(`DONNÉES FINANCIÈRES:\n${JSON.stringify(inputsData).substring(0, 5000)}`);
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 2000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 2000)}`);
    if (frameworkData) delivSummary.push(`FRAMEWORK FINANCIER:\n${JSON.stringify(frameworkData).substring(0, 3000)}`);
    if (planOvoData) delivSummary.push(`PLAN OVO:\n${JSON.stringify(planOvoData).substring(0, 3000)}`);
    if (diagnosticData) delivSummary.push(`BILAN DE PROGRESSION:\n${JSON.stringify(diagnosticData).substring(0, 2000)}`);
    if (oddData) delivSummary.push(`ODD:\n${JSON.stringify(oddData).substring(0, 2000)}`);
    if (valuationData) delivSummary.push(`VALORISATION:\n${JSON.stringify(valuationData).substring(0, 2000)}`);
    if (preScreeningData) delivSummary.push(`DIAGNOSTIC INITIAL:\n${JSON.stringify(preScreeningData).substring(0, 2000)}`);

    const programmeSection = programmeCriteria
      ? `\n══════ CRITÈRES DU PROGRAMME ══════\n${JSON.stringify(programmeCriteria, null, 2)}\nÉvalue chaque critère du programme et remplis matching_criteres.`
      : `\nAucun critère programme fourni — utilise des critères génériques : secteur, pays, CA minimum, impact social, gouvernance, viabilité financière, dossier complet.`;

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS DÉCLARÉS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
DESCRIPTION : ${ent.description || "Non spécifié"}

${truthBlock}

══════ DOCUMENTS UPLOADÉS ══════
${getDocumentContentForAgent(ent, "screening", 250_000) || "(Aucun document uploadé)"}

══════ LIVRABLES EXISTANTS ══════
${delivSummary.length > 0 ? delivSummary.join("\n\n") : "(Aucun livrable généré)"}

══════ BENCHMARKS SECTORIELS ══════
${getSectorKnowledgePrompt(ent.sector || "services_b2b")}

══════ CRITÈRES BAILLEURS DE RÉFÉRENCE ══════
${getDonorCriteriaPrompt()}

══════ RÈGLES DE VALIDATION CROISÉE ══════
${getValidationRulesPrompt()}

${ragContext}
${programmeSection}

══════ INSTRUCTIONS ══════
Produis une DÉCISION PROGRAMME pour cette entreprise.

RÈGLES :

1. DÉCISION : tranchée. ÉLIGIBLE = on finance. CONDITIONNEL = on finance SI les conditions sont remplies. HORS CIBLE = on ne finance pas. Pas de "peut-être".

2. MATCHING CRITÈRES : si des critères de programme sont fournis, évaluer chaque critère. Sinon, utiliser des critères génériques : secteur, pays, CA minimum, impact social, gouvernance, viabilité financière, dossier complet.

3. IMPACT : chiffrer tout. Pas "création d'emplois" mais "de 89 à 120 emplois directs en 24 mois". Les indicateurs de suivi doivent être SMART (spécifiques, mesurables, avec baseline et cible).

4. DIMENSIONNEMENT : le montant doit être justifié par les besoins identifiés dans les livrables (CAPEX du Plan OVO, besoin de financement du Framework). Le type de financement dépend du profil : subvention si early-stage, prêt si entreprise mature, mixte si entre les deux.

5. CONDITIONS : classer par moment (avant/pendant/fin). Chaque condition a un responsable.

6. RISQUES PROGRAMME : ce sont les risques pour le BAILLEUR, pas pour l'entreprise.

Réponds en JSON selon ce schéma :
${DECISION_SCHEMA}`;

    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);
    const rawData = await callAI(SYSTEM_PROMPT, prompt + coachingContext, 32768);
    const normalizedData = normalizeScreeningReport(rawData);
    const validatedData = validateAndEnrich(normalizedData, ent.country, ent.sector);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "screening_report", validatedData, "diagnostic");

    // Update enterprise score_ir
    const score = normalizedData.decision?.niveau_conviction || normalizedData.screening_score || 0;
    if (score) {
      await ctx.supabase.from("enterprises").update({
        score_ir: score,
        last_activity: new Date().toISOString(),
      }).eq("id", ctx.enterprise_id);
    }

    return jsonResponse({ success: true, data: normalizedData, score });
  } catch (e: any) {
    console.error("generate-screening-report error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
