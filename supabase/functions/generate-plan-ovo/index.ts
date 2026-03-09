import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext } from "../_shared/helpers.ts";
import { normalizePlanOvo, enforceFrameworkConstraints } from "../_shared/normalizers.ts";

const SYSTEM_PROMPT = `Tu es un modélisateur financier senior spécialisé dans les PME africaines (focus: Côte d'Ivoire, Afrique de l'Ouest).
À partir des données historiques fournies, génère un plan financier réaliste sur 8 ans (N-2 à N+5) en JSON strict.

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

COHÉRENCE OBLIGATOIRE:
- gross_profit = revenue - cogs (pour CHAQUE année)
- ebitda = gross_profit - total_opex (pour CHAQUE année)
- Toutes les 8 années (year_minus_2 à year6) DOIVENT avoir des valeurs non-nulles dans revenue, cogs, gross_profit, ebitda, net_profit, cashflow
- Les projections DOIVENT être cohérentes avec les contraintes du Plan Financier Intermédiaire si fournies

IMPORTANT: Réponds UNIQUEMENT en JSON valide. Pas de markdown, pas de backticks, pas de texte avant ou après.`;

function buildUserPrompt(name: string, sector: string, docs: string, allData: any): string {
  const cy = new Date().getFullYear();
  const ym2 = cy - 2;
  const ym1 = cy - 1;

  // Extract framework projections as constraints
  let frameworkConstraints = "";
  const fw = allData.framework;
  if (fw?.projection_5ans?.lignes && Array.isArray(fw.projection_5ans.lignes)) {
    const lines = fw.projection_5ans.lignes;
    const label = (l: any) => (l.poste || l.libelle || '').toLowerCase();
    const caLine = lines.find((l: any) => { const lb = label(l); return lb.includes("ca total") || lb.includes("chiffre") || lb.includes("revenue"); });
    const ebitdaLine = lines.find((l: any) => label(l).includes("ebitda"));
    const rnLine = lines.find((l: any) => { const lb = label(l); return lb.includes("résultat net") || lb.includes("resultat net"); });
    const mbLine = lines.find((l: any) => { const lb = label(l); return lb.includes("marge brute") || lb.includes("gross"); });
    const cfLine = lines.find((l: any) => { const lb = label(l); return lb.includes("cash") || lb.includes("trésorerie"); });

    const found = [caLine, ebitdaLine, rnLine, mbLine, cfLine].filter(Boolean);
    if (found.length > 0) {
      frameworkConstraints = `\nCONTRAINTES OBLIGATOIRES DU PLAN FINANCIER INTERMÉDIAIRE (respecter ces valeurs exactes pour les projections):`;
      const fmtLine = (name: string, line: any) => {
        return `\n- ${name}: year2(${cy+1})=${line.an1 ?? '?'}, year3(${cy+2})=${line.an2 ?? '?'}, year4(${cy+3})=${line.an3 ?? '?'}, year5(${cy+4})=${line.an4 ?? '?'}, year6(${cy+5})=${line.an5 ?? '?'}`;
      };
      if (caLine) frameworkConstraints += fmtLine("Revenue (CA)", caLine);
      if (mbLine) frameworkConstraints += fmtLine("Marge Brute", mbLine);
      if (ebitdaLine) frameworkConstraints += fmtLine("EBITDA", ebitdaLine);
      if (rnLine) frameworkConstraints += fmtLine("Résultat Net", rnLine);
      if (cfLine) frameworkConstraints += fmtLine("Cash-Flow", cfLine);
    }
  }

  // Extract historical CA from inputs
  let inputsConstraints = "";
  const inputs = allData.inputs;
  if (inputs?.compte_resultat) {
    const cr = inputs.compte_resultat;
    if (cr.chiffre_affaires) {
      inputsConstraints = `\nDONNÉES HISTORIQUES (compte de résultat année en cours):
- CA: ${cr.chiffre_affaires} FCFA
- Charges personnel: ${cr.charges_personnel || '?'} FCFA
- Résultat net: ${cr.resultat_net || '?'} FCFA`;
    }
  }

  return `
Crée le plan financier OVO complet pour "${name}" (Secteur: ${sector}).

DONNÉES ENTREPRISE:
${JSON.stringify(allData, null, 2)}
${docs ? `\nDOCUMENTS:\n${docs}` : ""}
${frameworkConstraints}
${inputsConstraints}

ANNÉES À UTILISER:
- year_minus_2 = ${ym2}
- year_minus_1 = ${ym1}
- current_year = ${cy}
- year2 = ${cy + 1}
- year3 = ${cy + 2}
- year4 = ${cy + 3}
- year5 = ${cy + 4}
- year6 = ${cy + 5}

Génère le JSON suivant avec des valeurs réalistes basées sur les données:
{
  "score": <0-100>,
  "company": "${name}",
  "country": "Côte d'Ivoire",
  "currency": "XOF",
  "exchange_rate_eur": 655.957,
  "base_year": ${cy},
  "years": {
    "year_minus_2": ${ym2},
    "year_minus_1": ${ym1},
    "current_year": ${cy},
    "year2": ${cy + 1},
    "year3": ${cy + 2},
    "year4": ${cy + 3},
    "year5": ${cy + 4},
    "year6": ${cy + 5}
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
  "capex": [{"label": "string", "acquisition_year": ${cy}, "acquisition_value": 0, "amortisation_rate_pct": 0.2}],
  "loans": {
    "ovo": {"amount": 0, "rate": 0.07, "term_years": 5},
    "family": {"amount": 0, "rate": 0.10, "term_years": 3},
    "bank": {"amount": 0, "rate": 0.20, "term_years": 2}
  },
  "funding_need": 0,
  "break_even_year": "string",
  "investment_metrics": {
    "van": 0, "tri": 0, "cagr_revenue": 0, "cagr_ebitda": 0,
    "roi": 0, "payback_years": 0, "dscr": 0, "multiple_ebitda": 0,
    "discount_rate": 0.12, "cost_of_capital": 0.12
  },
  "key_assumptions": ["string"],
  "scenarios": {
    "optimiste": {"hypotheses": "description", "taux_croissance_ca": "xx%/an", "revenue_year5": 0, "ebitda_year5": 0, "net_profit_year5": 0, "van": 0, "tri": 0},
    "realiste": {"hypotheses": "description", "taux_croissance_ca": "xx%/an", "revenue_year5": 0, "ebitda_year5": 0, "net_profit_year5": 0, "van": 0, "tri": 0},
    "pessimiste": {"hypotheses": "description", "taux_croissance_ca": "xx%/an", "revenue_year5": 0, "ebitda_year5": 0, "net_profit_year5": 0, "van": 0, "tri": 0}
  },
  "recommandations": ["string"]
}`;
}

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

    const rawData = await callAI(SYSTEM_PROMPT, buildUserPrompt(
      ent.name, ent.sector || "", ctx.documentContent, allData
    ));
    
    // Normalize: fix years, ensure consistency, fill gaps
    let data = normalizePlanOvo(rawData);
    
    // Enforce Framework constraints: overwrite projections with exact Framework values
    const frameworkData = allData.framework;
    data = enforceFrameworkConstraints(data, frameworkData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "plan_ovo", data, "plan_ovo");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-plan-ovo error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
