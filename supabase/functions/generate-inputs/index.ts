import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getFiscalParams } from "../_shared/helpers.ts";
import { normalizeInputs } from "../_shared/normalizers.ts";
import { getExtractionKnowledgePrompt } from "../_shared/financial-knowledge.ts";

const buildSystemPrompt = (devise: string) => `Tu es un analyste financier expert certifié SYSCOHADA révisé (2017), spécialisé PME africaines (zones UEMOA/CEMAC).

MISSION: EXTRAIRE les données financières HISTORIQUES des documents fournis (comptes de résultat, bilans, états financiers).
Tu NE FAIS PAS de projections, PAS de scénarios, PAS de plan d'action.

RÈGLES D'EXTRACTION:
1. Extrais UNIQUEMENT les chiffres présents dans les documents uploadés.
2. Si une donnée n'est pas dans les documents, mets 0 (ne l'invente PAS).
3. Vérifie la cohérence: Total Actif = Total Passif, Résultat net cohérent.
4. Tous les montants en ${devise} sans séparateurs de milliers dans les champs numériques.
5. Le score reflète la COMPLÉTUDE des données extraites (100 = toutes les données trouvées).

${getExtractionKnowledgePrompt()}

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, bmcData: any, devise: string) => `
Extrais les données financières HISTORIQUES de "${name}" (Secteur: ${sector}, Pays: ${country}).

${bmcData?.canvas ? `DONNÉES BMC (pour contexte):\n${JSON.stringify(bmcData.canvas, null, 2)}` : ""}
${docs ? `DOCUMENTS FINANCIERS À ANALYSER:\n${docs}` : "AUCUN DOCUMENT FINANCIER UPLOADÉ — mets toutes les valeurs à 0."}

Extrais et retourne ce JSON:
{
  "score": <0-100 complétude des données extraites>,
  "periode": "<ex: Exercice 2024 ou N/A si pas de documents>",
  "devise": "${devise}",
  "fiabilite": "<Élevée|Moyenne|Faible>",
  "source_documents": ["<nom des fichiers analysés>"],

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

  "effectifs": {
    "total": <number>,
    "cadres": <number>,
    "employes": <number>
  },

  "kpis": {
    "marge_brute_pct": "<xx% ou N/A>",
    "marge_nette_pct": "<xx% ou N/A>",
    "ratio_endettement_pct": "<xx% ou N/A>"
  },

  "donnees_manquantes": ["<donnée non trouvée dans les documents>"],
  "hypotheses": ["<hypothèse utilisée pour compléter>"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const bmcData = ctx.deliverableMap["bmc_analysis"] || {};
    const fiscalParams = getFiscalParams(ent.country || "Côte d'Ivoire");

    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal"]);

    const enrichedPrompt = userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, bmcData, fiscalParams.devise
    ) + ragContext + `\n\nPARAMÈTRES FISCAUX ${ent.country || "Côte d'Ivoire"}:\n${JSON.stringify(fiscalParams)}`;

    const rawData = await callAI(buildSystemPrompt(fiscalParams.devise), enrichedPrompt, 8192);
    const data = normalizeInputs(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", data, "inputs");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-inputs error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
