import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";
import { normalizeSic } from "../_shared/normalizers.ts";

const SYSTEM_PROMPT = `Tu es un expert en impact social et ODD (Objectifs de Développement Durable) pour les PME africaines. Tu produis des analyses SIC (Social Impact Canvas) professionnelles.
IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, bmcData: any) => `
Analyse l'entreprise "${name}" (Secteur: ${sector}, Pays: ${country}).

${bmcData?.canvas ? `DONNÉES BMC EXISTANTES:\n${JSON.stringify(bmcData, null, 2)}` : ""}
${docs ? `DOCUMENTS:\n${docs}` : ""}

Génère un Social Impact Canvas complet en JSON:
{
  "score": <0-100>,
  "mission_sociale": "<mission sociale de l'entreprise>",
  "probleme_social": "<problème social adressé>",
  "beneficiaires": {
    "directs": ["<bénéficiaire 1>"],
    "indirects": ["<bénéficiaire 1>"]
  },
  "theorie_changement": {
    "inputs": ["<ressource mobilisée>"],
    "activites": ["<activité clé>"],
    "outputs": ["<produit/service>"],
    "outcomes": ["<changement à court terme>"],
    "impact": ["<impact à long terme>"]
  },
  "odd_alignment": [
    {"odd_number": <1-17>, "odd_name": "<nom>", "contribution": "<comment l'entreprise contribue>", "level": "Fort|Moyen|Faible"}
  ],
  "indicateurs_impact": [
    {"indicateur": "<nom>", "valeur_actuelle": "<valeur>", "cible": "<objectif>", "unite": "<unité>"}
  ],
  "canvas": {
    "valeur_sociale": "<proposition de valeur sociale>",
    "parties_prenantes": ["<partie prenante>"],
    "ressources_impact": ["<ressource>"],
    "activites_impact": ["<activité>"],
    "resultats_attendus": ["<résultat>"],
    "mesure_impact": "<comment mesurer>"
  },
  "risques_sociaux": ["<risque>"],
  "recommandations": ["<recommandation>"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const bmcData = ctx.deliverableMap["bmc_analysis"] || ctx.moduleMap["bmc"] || {};

    const rawData = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, bmcData
    ));
    const data = normalizeSic(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "sic_analysis", data, "sic");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-sic error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
