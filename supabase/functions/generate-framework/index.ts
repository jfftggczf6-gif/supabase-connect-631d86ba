import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";
import { normalizeFramework } from "../_shared/normalizers.ts";

const SYSTEM_PROMPT = `Tu es un analyste financier expert spécialisé dans les PME africaines (zone UEMOA/CEMAC). Tu calcules les ratios financiers et produis des analyses complètes.
IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const userPrompt = (name: string, sector: string, docs: string, inputsData: any) => `
Réalise l'analyse financière complète de "${name}" (Secteur: ${sector}).

${inputsData?.compte_resultat ? `DONNÉES FINANCIÈRES:\n${JSON.stringify(inputsData, null, 2)}` : "Aucune donnée financière structurée, estime à partir des documents."}
${docs ? `DOCUMENTS:\n${docs}` : ""}

Génère le framework d'analyse financière en JSON:
{
  "score": <0-100>,
  "ratios": {
    "rentabilite": {
      "marge_brute": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"},
      "marge_nette": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"},
      "roe": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"},
      "roa": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"}
    },
    "liquidite": {
      "ratio_courant": {"valeur": "<x.x>", "seuil": ">1.5", "verdict": "Bon|Moyen|Faible"},
      "ratio_rapide": {"valeur": "<x.x>", "seuil": ">1.0", "verdict": "Bon|Moyen|Faible"},
      "bfr_jours": {"valeur": "<xx jours>", "commentaire": "<analyse>"}
    },
    "solvabilite": {
      "endettement": {"valeur": "<xx%>", "seuil": "<60%", "verdict": "Bon|Moyen|Faible"},
      "autonomie_financiere": {"valeur": "<xx%>", "seuil": ">40%", "verdict": "Bon|Moyen|Faible"},
      "capacite_remboursement": {"valeur": "<x.x ans>", "seuil": "<3 ans", "verdict": "Bon|Moyen|Faible"}
    },
    "activite": {
      "rotation_stocks": {"valeur": "<x.x>", "commentaire": "<analyse>"},
      "delai_clients": {"valeur": "<xx jours>", "commentaire": "<analyse>"},
      "delai_fournisseurs": {"valeur": "<xx jours>", "commentaire": "<analyse>"}
    }
  },
  "analyse_tendance": "<analyse de l'évolution sur 3 ans>",
  "points_forts": ["<point fort financier>"],
  "points_faibles": ["<point faible financier>"],
  "risques_financiers": ["<risque identifié>"],
  "recommandations": ["<recommandation financière>"],
  "capacite_investissement": "<analyse de la capacité d'investissement>",
  "besoin_financement": "<estimation du besoin de financement>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const inputsData = ctx.deliverableMap["inputs_data"] || ctx.moduleMap["inputs"] || {};

    const rawData = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ctx.documentContent, inputsData
    ));
    const data = normalizeFramework(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "framework_data", data, "framework");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-framework error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
