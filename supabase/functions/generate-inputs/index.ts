import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";

const SYSTEM_PROMPT = `Tu es un expert-comptable spécialisé dans les PME africaines (zone UEMOA/CEMAC). Tu extrais et structures les données financières à partir de documents.
IMPORTANT: Réponds UNIQUEMENT en JSON valide. Tous les montants en FCFA.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, bmcData: any) => `
Analyse les données financières de "${name}" (Secteur: ${sector}, Pays: ${country}).

${bmcData?.canvas ? `DONNÉES BMC (flux revenus, structure coûts):\n${JSON.stringify({
  flux_revenus: bmcData.canvas?.flux_revenus,
  structure_couts: bmcData.canvas?.structure_couts
}, null, 2)}` : ""}
${docs ? `DOCUMENTS FINANCIERS:\n${docs}` : ""}

Extrais et structure les données financières en JSON:
{
  "score": <0-100>,
  "periode": "<ex: 2023-2025>",
  "devise": "FCFA",
  "compte_resultat": {
    "chiffre_affaires": <number>,
    "achats_matieres": <number>,
    "charges_personnel": <number>,
    "charges_externes": <number>,
    "dotations_amortissements": <number>,
    "resultat_exploitation": <number>,
    "charges_financieres": <number>,
    "resultat_net": <number>
  },
  "bilan": {
    "actif": {
      "immobilisations": <number>,
      "stocks": <number>,
      "creances_clients": <number>,
      "tresorerie": <number>,
      "total_actif": <number>
    },
    "passif": {
      "capitaux_propres": <number>,
      "dettes_lt": <number>,
      "dettes_ct": <number>,
      "fournisseurs": <number>,
      "total_passif": <number>
    }
  },
  "tresorerie": {
    "flux_exploitation": <number>,
    "flux_investissement": <number>,
    "flux_financement": <number>,
    "variation_tresorerie": <number>
  },
  "effectifs": {
    "total": <number>,
    "cadres": <number>,
    "employes": <number>
  },
  "hypotheses": ["<hypothèse utilisée pour estimer les données>"],
  "fiabilite": "<Élevée|Moyenne|Faible - basée sur les données disponibles>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const bmcData = ctx.deliverableMap["bmc_analysis"] || {};

    const data = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, bmcData
    ));

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", data, "inputs");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-inputs error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
