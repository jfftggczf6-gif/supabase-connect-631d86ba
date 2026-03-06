import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";

const SYSTEM_PROMPT = `Tu es un expert en planification financière pour les PME africaines (zone UEMOA/CEMAC). Tu produis des plans financiers OVO (Optimiste-Vraisemblable-pessimiste) sur 3-5 ans.
IMPORTANT: Réponds UNIQUEMENT en JSON valide. Montants en FCFA.`;

const userPrompt = (name: string, sector: string, docs: string, allData: any) => `
Crée le plan financier OVO pour "${name}" (Secteur: ${sector}).

DONNÉES:
${JSON.stringify(allData, null, 2)}
${docs ? `\nDOCUMENTS:\n${docs}` : ""}

Génère le plan OVO en JSON:
{
  "score": <0-100>,
  "hypotheses_base": {
    "taux_croissance_secteur": "<xx%>",
    "inflation": "<xx%>",
    "taux_interet": "<xx%>",
    "horizon": "5 ans"
  },
  "scenarios": {
    "optimiste": {
      "hypotheses": "<description des hypothèses>",
      "taux_croissance_ca": "<xx%/an>",
      "projections": [
        {"annee": "N+1", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+2", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+3", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+4", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+5", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>}
      ],
      "investissements_requis": <number>,
      "point_equilibre": "<quand>",
      "valorisation_estimee": <number>
    },
    "realiste": {
      "hypotheses": "<description>",
      "taux_croissance_ca": "<xx%/an>",
      "projections": [
        {"annee": "N+1", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+2", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+3", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+4", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+5", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>}
      ],
      "investissements_requis": <number>,
      "point_equilibre": "<quand>",
      "valorisation_estimee": <number>
    },
    "pessimiste": {
      "hypotheses": "<description>",
      "taux_croissance_ca": "<xx%/an>",
      "projections": [
        {"annee": "N+1", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+2", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+3", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+4", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>},
        {"annee": "N+5", "ca": <number>, "resultat_net": <number>, "tresorerie": <number>}
      ],
      "investissements_requis": <number>,
      "point_equilibre": "<quand>",
      "valorisation_estimee": <number>
    }
  },
  "besoin_financement": {
    "montant_total": <number>,
    "repartition": {"fonds_propres": <number>, "dette": <number>, "subventions": <number>},
    "calendrier": "<planning de mobilisation>"
  },
  "indicateurs_cles": {
    "tri": "<taux de rendement interne>",
    "van": "<valeur actuelle nette>",
    "payback": "<délai de récupération>",
    "dscr": "<ratio de couverture du service de la dette>"
  },
  "risques_financiers": ["<risque>"],
  "recommandations": ["<recommandation>"]
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
    // plan_ovo doesn't need heavy normalization, score is straightforward
    if (!data.score && data.score_global) data.score = data.score_global;

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "plan_ovo", data, "plan_ovo");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-plan-ovo error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
