import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";

const SYSTEM_PROMPT = `Tu es un expert en due diligence et investment readiness pour les PME africaines. Tu évalues la maturité des entreprises selon les critères des investisseurs d'impact et DFI.
IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, allData: any) => `
Réalise la Due Diligence ODD (Operational Due Diligence) de "${name}" (Secteur: ${sector}, Pays: ${country}).

TOUTES LES DONNÉES:
${JSON.stringify(allData, null, 2)}
${docs ? `\nDOCUMENTS:\n${docs}` : ""}

Génère l'analyse ODD en JSON:
{
  "score": <0-100>,
  "readiness_level": "<Not Ready|Early Stage|Getting Ready|Investment Ready|Fully Ready>",
  "synthese": "<synthèse en 3-4 phrases>",
  "checklist": [
    {
      "categorie": "<Gouvernance|Juridique|Finance|Commercial|Impact|Opérationnel|ESG>",
      "critere": "<critère évalué>",
      "status": "pass|fail|partial",
      "score": <0-100>,
      "commentaire": "<commentaire détaillé>",
      "action_requise": "<action à mener si fail/partial>"
    }
  ],
  "scores_par_categorie": {
    "gouvernance": {"score": <0-100>, "items_pass": <number>, "items_total": <number>},
    "juridique": {"score": <0-100>, "items_pass": <number>, "items_total": <number>},
    "finance": {"score": <0-100>, "items_pass": <number>, "items_total": <number>},
    "commercial": {"score": <0-100>, "items_pass": <number>, "items_total": <number>},
    "impact": {"score": <0-100>, "items_pass": <number>, "items_total": <number>},
    "operationnel": {"score": <0-100>, "items_pass": <number>, "items_total": <number>},
    "esg": {"score": <0-100>, "items_pass": <number>, "items_total": <number>}
  },
  "red_flags": ["<red flag critique>"],
  "points_forts_investisseur": ["<point qui rassure un investisseur>"],
  "actions_prioritaires": [
    {"action": "<action>", "priorite": "Critique|Haute|Moyenne", "delai": "<délai>", "cout_estime": "<coût>"}
  ],
  "type_investisseur_recommande": ["<type: Impact Investor, DFI, Banque, etc.>"],
  "montant_levee_recommande": "<fourchette recommandée>",
  "recommandations_finales": ["<recommandation>"]
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
      diagnostic: ctx.deliverableMap["diagnostic_data"] || {},
      plan_ovo: ctx.deliverableMap["plan_ovo"] || {},
      business_plan: ctx.deliverableMap["business_plan"] || {},
    };

    const data = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, allData
    ));

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "odd_analysis", data, "odd");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-odd error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
