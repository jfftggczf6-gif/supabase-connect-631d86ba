import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";

const SYSTEM_PROMPT = `Tu es un consultant expert en diagnostic d'entreprises africaines. Tu réalises des diagnostics stratégiques complets combinant analyses qualitatives et quantitatives.
IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, allData: any) => `
Réalise un diagnostic expert complet de "${name}" (Secteur: ${sector}, Pays: ${country}).

DONNÉES EXISTANTES:
${JSON.stringify(allData, null, 2)}
${docs ? `\nDOCUMENTS:\n${docs}` : ""}

Génère le diagnostic en JSON:
{
  "score": <0-100>,
  "synthese_executive": "<résumé en 3-4 phrases>",
  "niveau_maturite": "<Émergent|En développement|Structuré|Mature|Leader>",
  "swot": {
    "forces": [{"item": "<force>", "impact": "Fort|Moyen", "detail": "<explication>"}],
    "faiblesses": [{"item": "<faiblesse>", "impact": "Fort|Moyen", "detail": "<explication>"}],
    "opportunites": [{"item": "<opportunité>", "probabilite": "Élevée|Moyenne|Faible", "detail": "<explication>"}],
    "menaces": [{"item": "<menace>", "probabilite": "Élevée|Moyenne|Faible", "detail": "<explication>"}]
  },
  "diagnostic_par_dimension": {
    "strategie": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]},
    "marketing_commercial": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]},
    "operations": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]},
    "finance": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]},
    "rh_organisation": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]},
    "gouvernance": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]},
    "impact_social": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]},
    "innovation": {"score": <0-100>, "analyse": "<analyse>", "recommandations": ["<reco>"]}
  },
  "risques_critiques": [{"risque": "<description>", "severite": "Critique|Élevé|Moyen", "mitigation": "<action>"}],
  "plan_action_prioritaire": [
    {"action": "<action>", "priorite": "Urgente|Haute|Moyenne", "horizon": "Court terme|Moyen terme|Long terme", "responsable": "<qui>", "cout_estime": "<montant>"}
  ],
  "score_investment_readiness": <0-100>,
  "verdict": "<verdict global en 2-3 phrases>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const allData = {
      bmc: ctx.deliverableMap["bmc_analysis"] || {},
      sic: ctx.deliverableMap["sic_analysis"] || {},
      inputs: ctx.deliverableMap["inputs_data"] || {},
      framework: ctx.deliverableMap["framework_data"] || {},
    };

    const data = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, allData
    ));

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "diagnostic_data", data, "diagnostic");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-diagnostic error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
