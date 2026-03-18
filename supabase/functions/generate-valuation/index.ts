import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse,
} from "../_shared/helpers.ts";
import { getFinancialKnowledgePrompt, getValuationBenchmarksPrompt, getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un analyste en Corporate Finance spécialisé dans la valorisation de PME africaines (UEMOA/CEMAC).

Tu maîtrises parfaitement :
- La valorisation par DCF (Discounted Cash Flow) avec WACC adapté au contexte africain
- La valorisation par multiples d'EBITDA et de CA sectoriels
- La valorisation par comparables (transactions similaires en Afrique subsaharienne)
- Les ajustements de décote pour illiquidité, risque pays, taille, et gouvernance

MÉTHODES À APPLIQUER (les 3 obligatoirement) :

1. DCF (Discounted Cash Flow)
   - Projections cashflow sur 5 ans depuis le Plan OVO (scénario réaliste)
   - WACC = Cost of Equity (CAPM ajusté) + Cost of Debt pondéré
   - Cost of Equity = Risk Free Rate (OAT ~3%) + Prime de Risque Marché Afrique (8-12%) + Prime Taille PME (3-5%) + Prime Illiquidité (2-4%)
   - WACC typique PME Afrique = 16-25% selon pays et secteur
   - Valeur terminale : Gordon Growth Model avec g = 3-5%
   - Terminal Value = FCF_n × (1+g) / (WACC - g)
   - Sensitivity analysis sur WACC (±2%) et g (±1%)

2. MULTIPLES SECTORIELS
   - Multiple EBITDA : 4-8× selon secteur PME Afrique
   - Multiple CA : 0.5-2× selon secteur
   - Appliquer sur EBITDA/CA du dernier exercice ou moyenne 3 ans

3. COMPARABLES TRANSACTIONNELS
   - Références : deals I&P, Partech Africa, TLcom, Investisseurs & Partenaires
   - Ajuster par taille (décote 20-40% si CA < 500M FCFA)

DÉCOTES À APPLIQUER :
- Décote d'illiquidité : 20-30%
- Décote de taille : 10-20% si CA < 200M FCFA
- Décote de gouvernance : 5-15% si pas de PV AG, pas d'audit externe
- Prime de croissance : +10-20% si CAGR > 25% sur 3 ans

RÉSULTAT : Fourchette de valorisation (min — médiane — max) avec explication de chaque méthode.

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const VALUATION_SCHEMA = `{
  "score": <0-100>,
  "devise": "FCFA",
  "dcf": {
    "wacc_pct": <number>,
    "wacc_detail": {
      "risk_free_rate": <number>,
      "equity_risk_premium_africa": <number>,
      "size_premium": <number>,
      "illiquidity_premium": <number>,
      "cost_of_equity": <number>,
      "cost_of_debt": <number>,
      "debt_weight": <number>,
      "equity_weight": <number>
    },
    "projections_cashflow": [
      {"annee": "Y1", "fcf": <number>},
      {"annee": "Y2", "fcf": <number>},
      {"annee": "Y3", "fcf": <number>},
      {"annee": "Y4", "fcf": <number>},
      {"annee": "Y5", "fcf": <number>}
    ],
    "terminal_value": <number>,
    "terminal_growth_rate": <number>,
    "enterprise_value": <number>,
    "equity_value": <number>,
    "sensitivity": {
      "wacc_minus_2": <number>,
      "wacc_base": <number>,
      "wacc_plus_2": <number>,
      "growth_minus_1": <number>,
      "growth_plus_1": <number>
    },
    "note_methodologique": "string"
  },
  "multiples": {
    "ebitda_dernier_exercice": <number>,
    "ca_dernier_exercice": <number>,
    "multiple_ebitda_retenu": <number>,
    "multiple_ca_retenu": <number>,
    "justification_multiples": "string",
    "valeur_par_ebitda": <number>,
    "valeur_par_ca": <number>,
    "valeur_moyenne_multiples": <number>,
    "comparables_references": ["string"]
  },
  "decotes_primes": {
    "decote_illiquidite_pct": <number>,
    "decote_taille_pct": <number>,
    "decote_gouvernance_pct": <number>,
    "prime_croissance_pct": <number>,
    "ajustement_total_pct": <number>,
    "justification": "string"
  },
  "synthese_valorisation": {
    "valeur_basse": <number>,
    "valeur_mediane": <number>,
    "valeur_haute": <number>,
    "methode_privilegiee": "DCF | Multiples EBITDA | Multiples CA",
    "justification_methode": "string",
    "valeur_par_action_estimee": <number ou null>,
    "note_analyste": "string"
  },
  "implications_investissement": {
    "pre_money_estime": <number>,
    "si_levee_100m": "string",
    "si_levee_500m": "string",
    "multiple_sortie_estime": "string",
    "irr_investisseur_estime": "string"
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    const { data: existingDeliverables } = await ctx.supabase
      .from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDelivData = (type: string) => {
      const d = existingDeliverables?.find((del: any) => del.type === type);
      return d?.data && typeof d.data === "object" ? d.data : null;
    };

    const planOvoData = getDelivData("plan_ovo");
    const frameworkData = getDelivData("framework_data");
    const inputsData = getDelivData("inputs_data");
    const bmcData = getDelivData("bmc_analysis");
    const diagnosticData = getDelivData("diagnostic_data");

    const ragContext = await buildRAGContext(
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"]
    );

    const knowledgeBase = getFinancialKnowledgePrompt(ent.country || "cote_d_ivoire", ent.sector || "services_b2b", false);
    const valuationBenchmarks = getValuationBenchmarksPrompt();

    const delivSummary: string[] = [];
    if (planOvoData) delivSummary.push(`PLAN OVO (projections financières):\n${JSON.stringify(planOvoData).substring(0, 8000)}`);
    if (frameworkData) delivSummary.push(`FRAMEWORK FINANCIER:\n${JSON.stringify(frameworkData).substring(0, 5000)}`);
    if (inputsData) delivSummary.push(`DONNÉES FINANCIÈRES (inputs):\n${JSON.stringify(inputsData).substring(0, 5000)}`);
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 3000)}`);
    if (diagnosticData) delivSummary.push(`DIAGNOSTIC:\n${JSON.stringify(diagnosticData).substring(0, 2000)}`);

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}

══════ LIVRABLES EXISTANTS ══════
${delivSummary.length > 0 ? delivSummary.join("\n\n") : "(Aucun livrable — estimation sur déclaratif)"}

══════ BASE DE CONNAISSANCES FINANCIÈRE ══════
${knowledgeBase}

══════ MULTIPLES DE VALORISATION AFRIQUE ══════
${valuationBenchmarks}

══════ CRITÈRES BAILLEURS ══════
${getDonorCriteriaPrompt()}

${ragContext}

══════ INSTRUCTIONS ══════
Applique les 3 méthodes de valorisation (DCF, multiples EBITDA, multiples CA).
Utilise les cashflows du Plan OVO pour le DCF. Si pas de Plan OVO, estime à partir des inputs/framework.
Applique les décotes/primes appropriées au profil de l'entreprise.
Produis une fourchette de valorisation réaliste pour le contexte PME Afrique.

Réponds en JSON selon ce schéma :
${VALUATION_SCHEMA}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 16384);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "valuation", rawData, "valuation");

    return jsonResponse({ success: true, data: rawData, score: rawData.score || 0 });
  } catch (e: any) {
    console.error("generate-valuation error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
