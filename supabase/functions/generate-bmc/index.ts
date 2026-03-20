// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getDocumentContentForAgent } from "../_shared/helpers_v5.ts";
import { normalizeBmc } from "../_shared/normalizers.ts";
import { getSectorKnowledgePrompt } from "../_shared/financial-knowledge.ts";

const BMC_SYSTEM_PROMPT = `Tu es un expert en analyse de business models pour les PME africaines. Tu produis des analyses BMC (Business Model Canvas) professionnelles et détaillées.

IMPORTANT: Tu dois TOUJOURS répondre avec un JSON valide, sans texte avant ou après. Pas de markdown, pas de commentaires.`;

const BMC_USER_PROMPT = (name: string, sector: string, country: string, city: string, docs: string) => `
Analyse l'entreprise "${name}" (Secteur: ${sector || "non spécifié"}, Pays: ${country || "non spécifié"}, Ville: ${city || "non spécifié"}) et génère un Business Model Canvas complet.

${docs ? `DOCUMENTS FOURNIS:\n${docs}` : "Aucun document fourni, génère une analyse basée sur les informations disponibles."}

Génère un JSON avec EXACTEMENT cette structure:

{
  "score_global": <number 0-100>,
  "maturite": "<Émergent|En développement|Structuré|Mature>",
  "resume": "<phrase d'accroche résumant le business model en 1-2 lignes>",
  "tags": ["<tag positif avec ✓>", "<tag warning avec ⚠>", "<tag action avec →>"],
  "canvas": {
    "partenaires_cles": {
      "items": ["<partenaire 1>", "<partenaire 2>"],
      "detail": "<description détaillée des partenaires et de leur rôle>",
      "element_critique": "<élément critique si applicable ou null>"
    },
    "activites_cles": {
      "items": ["<activité 1>", "<activité 2>"],
      "detail": "<description détaillée>",
      "element_critique": "<élément critique ou null>"
    },
    "ressources_cles": {
      "items": ["<ressource 1>", "<ressource 2>"],
      "categories": {
        "humaines": "<description>",
        "materielles": "<description>",
        "immaterielles": "<description>",
        "financieres": "<description>"
      },
      "element_critique": "<élément critique ou null>"
    },
    "proposition_valeur": {
      "enonce": "<la proposition de valeur en une phrase>",
      "avantages": ["<avantage 1>", "<avantage 2>"],
      "detail": "<description détaillée>"
    },
    "relations_clients": {
      "type": "<type de relation>",
      "detail": "<description>",
      "items": ["<élément 1>", "<élément 2>"]
    },
    "canaux": {
      "items": ["<canal 1>", "<canal 2>"],
      "detail": "<description>"
    },
    "segments_clients": {
      "principal": "<segment principal>",
      "zone": "<zone géographique>",
      "type_marche": "<B2B|B2C|B2B2C>",
      "probleme_resolu": "<problème résolu>",
      "taille_marche": "<estimation taille du marché>",
      "intensite_besoin": "<score /10 avec description>"
    },
    "structure_couts": {
      "postes": [
        {"libelle": "<poste>", "montant": "<montant>", "type": "Fixe|Variable|Mixte", "pourcentage": <number>}
      ],
      "total_mensuel": "<total estimé>",
      "cout_critique": "<le poste de coût le plus critique>"
    },
    "flux_revenus": {
      "produit_principal": "<produit/service principal>",
      "prix_moyen": "<prix moyen>",
      "frequence_achat": "<fréquence>",
      "volume_estime": "<volume mensuel>",
      "ca_mensuel": "<CA mensuel estimé>",
      "marge_brute": "<marge brute estimée>",
      "mode_paiement": "<modes de paiement>"
    }
  },
  "diagnostic": {
    "scores_par_bloc": {
      "proposition_valeur": {"score": <0-100>, "commentaire": "<commentaire court>"},
      "activites_cles": {"score": <0-100>, "commentaire": "<commentaire>"},
      "ressources_cles": {"score": <0-100>, "commentaire": "<commentaire>"},
      "segments_clients": {"score": <0-100>, "commentaire": "<commentaire>"},
      "relations_clients": {"score": <0-100>, "commentaire": "<commentaire>"},
      "flux_revenus": {"score": <0-100>, "commentaire": "<commentaire>"},
      "partenaires_cles": {"score": <0-100>, "commentaire": "<commentaire>"},
      "canaux": {"score": <0-100>, "commentaire": "<commentaire>"},
      "structure_couts": {"score": <0-100>, "commentaire": "<commentaire>"}
    },
    "forces": ["<force 1>", "<force 2>"],
    "points_vigilance": ["<point 1>", "<point 2>"]
  },
  "swot": {
    "forces": ["<force 1>", "<force 2>", "<force 3>"],
    "faiblesses": ["<faiblesse 1>", "<faiblesse 2>", "<faiblesse 3>"],
    "opportunites": ["<opportunité 1>", "<opportunité 2>", "<opportunité 3>"],
    "menaces": ["<menace 1>", "<menace 2>", "<menace 3>"]
  },
  "recommandations": {
    "court_terme": "<description>",
    "moyen_terme": "<description>",
    "long_terme": "<description>"
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // RAG: enrichir avec benchmarks sectoriels
    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "secteurs"], "bmc_analysis");

    const sectorBenchmarks = getSectorKnowledgePrompt(ent.sector || "services_b2b");
    const agentDocs = getDocumentContentForAgent(ent, "bmc", 100_000);
    const rawBmcData = await callAI(BMC_SYSTEM_PROMPT, BMC_USER_PROMPT(
      ent.name, ent.sector || "", ent.country || "", ent.city || "", agentDocs
    ) + `\n\n══════ BENCHMARKS SECTORIELS ══════\n${sectorBenchmarks}` + ragContext, 32768, undefined, 0.2);

    // Normalize AI response
    const bmcData = normalizeBmc(rawBmcData);

    // Save both bmc_analysis and bmc_html
    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "bmc_analysis", bmcData, "bmc");

    await ctx.supabase.from("deliverables").upsert({
      enterprise_id: ctx.enterprise_id,
      type: "bmc_html",
      data: bmcData,
      score: bmcData.score_global || bmcData.score || null,
      ai_generated: true,
      version: 1,
    }, { onConflict: "enterprise_id,type" });

    return jsonResponse({ success: true, data: bmcData, score: bmcData.score_global || bmcData.score });
  } catch (e: any) {
    console.error("generate-bmc error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
