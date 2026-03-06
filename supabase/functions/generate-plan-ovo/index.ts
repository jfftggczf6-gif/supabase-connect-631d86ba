import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";

const SYSTEM_PROMPT = `Tu es un modélisateur financier senior spécialisé dans les PME africaines (focus: Côte d'Ivoire, Afrique de l'Ouest).
À partir des données historiques fournies, génère un plan financier réaliste sur 5 ans en JSON strict.

Paramètres:
- Devise: XOF (FCFA)
- TVA: 18%
- Impôt sur les sociétés: 25% (ou 4% si CA < 200M FCFA)
- Charges sociales: 25% du salaire brut
- Taux de croissance PME réaliste: 15-30%/an max sauf si données historiques justifient plus
- Taux de change EUR: 655.957

CALCULS OBLIGATOIRES - investment_metrics:
- VAN (Valeur Actuelle Nette): somme des cashflows actualisés au taux de 12%, moins investissement initial
- TRI (Taux de Rendement Interne): taux qui annule la VAN
- CAGR Revenue: taux de croissance annuel composé du CA entre année courante et année 5
- CAGR EBITDA: taux de croissance annuel composé de l'EBITDA
- ROI: cumul des résultats nets / investissement total
- Payback: nombre d'années pour récupérer l'investissement via les cashflows cumulés
- DSCR: EBITDA année courante / service de la dette annuel total
- Multiple EBITDA: valorisation estimée / EBITDA (multiple sectoriel typique 4-8x)

Calcule aussi VAN et TRI pour chaque scénario (optimiste, réaliste, pessimiste).

IMPORTANT: Réponds UNIQUEMENT en JSON valide. Pas de markdown, pas de backticks, pas de texte avant ou après.`;

const userPrompt = (name: string, sector: string, docs: string, allData: any) => `
Crée le plan financier OVO complet pour "${name}" (Secteur: ${sector}).

DONNÉES ENTREPRISE:
${JSON.stringify(allData, null, 2)}
${docs ? `\nDOCUMENTS:\n${docs}` : ""}

Génère le JSON suivant avec des valeurs réalistes basées sur les données:
{
  "score": <0-100>,
  "company": "${name}",
  "country": "Côte d'Ivoire",
  "currency": "XOF",
  "exchange_rate_eur": 655.957,
  "base_year": 2024,
  "years": {
    "year_minus_2": 2022,
    "year_minus_1": 2023,
    "current_year": 2024,
    "year2": 2025,
    "year3": 2026,
    "year4": 2027,
    "year5": 2028,
    "year6": 2029
  },
  "products": [{"name": "string", "filter": 1, "range": "Entry level", "channel": "B2B"}],
  "services": [{"name": "string", "filter": 1, "range": "Entry level", "channel": "B2B"}],
  "revenue": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "cogs": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "gross_profit": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "gross_margin_pct": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "staff": [{"category": "STAFF_CAT01", "label": "string", "department": "string", "social_security_rate": 0.25}],
  "opex": {
    "staff_salaries": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
    "marketing": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
    "office_costs": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
    "travel": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
    "insurance": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
    "maintenance": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
    "third_parties": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
    "other": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0}
  },
  "ebitda": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "ebitda_margin_pct": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "net_profit": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "cashflow": {"year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0},
  "capex": [{"label": "string", "acquisition_year": 2024, "acquisition_value": 0, "amortisation_rate_pct": 0.2}],
  "loans": {
    "ovo": {"amount": 0, "rate": 0.07, "term_years": 5},
    "family": {"amount": 0, "rate": 0.10, "term_years": 3},
    "bank": {"amount": 0, "rate": 0.20, "term_years": 2}
  },
  "funding_need": 0,
  "break_even_year": "string",
  "investment_metrics": {
    "van": 0,
    "tri": 0,
    "cagr_revenue": 0,
    "cagr_ebitda": 0,
    "roi": 0,
    "payback_years": 0,
    "dscr": 0,
    "multiple_ebitda": 0,
    "discount_rate": 0.12,
    "cost_of_capital": 0.12
  },
  "key_assumptions": ["string"],
  "scenarios": {
    "optimiste": {
      "hypotheses": "description",
      "taux_croissance_ca": "xx%/an",
      "revenue_year5": 0,
      "ebitda_year5": 0,
      "net_profit_year5": 0,
      "van": 0,
      "tri": 0
    },
    "realiste": {
      "hypotheses": "description",
      "taux_croissance_ca": "xx%/an",
      "revenue_year5": 0,
      "ebitda_year5": 0,
      "net_profit_year5": 0,
      "van": 0,
      "tri": 0
    },
    "pessimiste": {
      "hypotheses": "description",
      "taux_croissance_ca": "xx%/an",
      "revenue_year5": 0,
      "ebitda_year5": 0,
      "net_profit_year5": 0,
      "van": 0,
      "tri": 0
    }
  },
  "recommandations": ["string"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const allData = {
      inputs: ctx.deliverableMap["inputs_data"] || {},
      framework: ctx.deliverableMap["framework_data"] || {},
      bmc: ctx.deliverableMap["bmc_analysis"] || {},
    };

    const data = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ctx.documentContent, allData
    ));
    
    if (!data.score && data.score_global) data.score = data.score_global;

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "plan_ovo", data, "plan_ovo");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-plan-ovo error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
