// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getDocumentContentForAgent, getKnowledgeForAgent, getCoachingContext } from "../_shared/helpers_v5.ts";
import { normalizeBmc } from "../_shared/normalizers.ts";
import { getSectorKnowledgePrompt, getContextualBenchmarks } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";

const BMC_SYSTEM_PROMPT = `Tu es un expert en analyse de business models pour les PME africaines. Tu produis des analyses BMC (Business Model Canvas) professionnelles.

STYLE : ÉQUILIBRÉ — ni trop court ni trop long. Informatif mais lisible.
- "detail" d'un bloc canvas : 3-5 phrases avec explications claires. Cite la source entre parenthèses.
- "items" d'un bloc : 4-6 éléments, chacun en 1 phrase courte explicative
- "element_critique" : 1-2 phrases avec justification
- structure_couts.postes : montant en NOMBRE ENTIER (devise locale). JAMAIS coller le montant avec l'année.
- flux_revenus : chiffres précis avec contexte (ex: "10 000 XOF par plaquette de 30 œufs")
- diagnostic/recommandations : 2-3 phrases par point, avec la raison et l'action proposée

IMPORTANT: Réponds UNIQUEMENT en JSON valide, sans texte, sans markdown.`;

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
    const requestId = crypto.randomUUID();

    // Mark as processing
    const { data: existingDeliv } = await ctx.supabase.from("deliverables")
      .select("data").eq("enterprise_id", ctx.enterprise_id).eq("type", "bmc_analysis").maybeSingle();
    if (existingDeliv?.data && Object.keys(existingDeliv.data).length > 5) {
      await ctx.supabase.from("deliverables").update({
        data: { ...existingDeliv.data, _processing: true, _request_id: requestId },
      }).eq("enterprise_id", ctx.enterprise_id).eq("type", "bmc_analysis");
    } else {
      await ctx.supabase.from("deliverables").upsert({
        enterprise_id: ctx.enterprise_id, type: "bmc_analysis",
        data: { status: "processing", request_id: requestId, started_at: new Date().toISOString() },
      }, { onConflict: "enterprise_id,type" });
    }

    // Return 202 immediately, work in background
    const asyncWork = async () => {
    try {

    // RAG: enrichir avec benchmarks sectoriels
    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "secteurs"], "bmc_analysis");

    const sectorBenchmarks = getSectorKnowledgePrompt(ent.sector || "services_b2b");
    const contextBenchmarks = getContextualBenchmarks(ent.country || "Côte d'Ivoire", ent.sector || "services_b2b");
    const kbContext = await getKnowledgeForAgent(ctx.supabase, ent.country || "", ent.sector || "", "bmc");
    const agentDocs = getDocumentContentForAgent(ent, "bmc", 20_000);
    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);

    // Inject structured data from upstream deliverables
    let upstreamContext = "";
    const inputsData = ctx.deliverableMap["inputs_data"];
    if (inputsData && typeof inputsData === "object" && Object.keys(inputsData).length > 5) {
      upstreamContext += `\n\n══════ DONNÉES FINANCIÈRES EXTRAITES (inputs_data) ══════\n`;
      if (inputsData.produits_services?.length) {
        upstreamContext += `Produits/Services:\n${inputsData.produits_services.map((p: any) => `  - ${p.nom}: CA=${(p.ca_estime||0).toLocaleString("fr-FR")}, part=${p.part_ca_pct||0}%`).join("\n")}\n`;
      }
      if (inputsData.compte_resultat?.chiffre_affaires) {
        upstreamContext += `CA total: ${inputsData.compte_resultat.chiffre_affaires.toLocaleString("fr-FR")} FCFA\n`;
      }
      if (inputsData.equipe?.length) {
        upstreamContext += `Équipe: ${inputsData.equipe.map((e: any) => `${e.poste}(${e.nombre})`).join(", ")}\n`;
      }
    }
    const preScreen = ctx.deliverableMap["pre_screening"];
    if (preScreen && typeof preScreen === "object" && Object.keys(preScreen).length > 5) {
      upstreamContext += `\n══════ PRÉ-SCREENING ══════\n`;
      if (preScreen.activites_identifiees?.length) upstreamContext += `Activités: ${preScreen.activites_identifiees.map((a: any) => typeof a === 'string' ? a : a.nom || a).join(", ")}\n`;
      if (preScreen.forces?.length) upstreamContext += `Forces: ${preScreen.forces.slice(0,4).map((f: any) => typeof f === 'string' ? f : f.titre || f).join(" | ")}\n`;
      if (preScreen.classification) upstreamContext += `Classification: ${preScreen.classification}\n`;
    }

    const rawBmcData = await callAI(injectGuardrails(BMC_SYSTEM_PROMPT), BMC_USER_PROMPT(
      ent.name, ent.sector || "", ent.country || "", ent.city || "", agentDocs
    ) + `\n\n══════ BENCHMARKS SECTORIELS ══════\n${sectorBenchmarks}\n\n${contextBenchmarks}` + ragContext + kbContext + coachingContext + upstreamContext, 32768, "claude-sonnet-4-20250514", 0.3);

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

    console.log(`[bmc] ✅ DONE ${requestId}`);
    } catch (innerErr: any) {
      console.error("[bmc] Background error:", innerErr);
      // Preserve existing data, just add error flag
      const { data: curr } = await ctx.supabase.from("deliverables")
        .select("data").eq("enterprise_id", ctx.enterprise_id).eq("type", "bmc_analysis").maybeSingle();
      const safeData = (curr?.data && Object.keys(curr.data).length > 5)
        ? { ...curr.data, _error: innerErr.message?.slice(0, 500), _request_id: requestId }
        : { status: "error", error: innerErr.message?.slice(0, 500), request_id: requestId };
      await ctx.supabase.from("deliverables").update({ data: safeData })
        .eq("enterprise_id", ctx.enterprise_id).eq("type", "bmc_analysis");
    }
    };
    // @ts-ignore
    EdgeRuntime.waitUntil(asyncWork());
    return new Response(JSON.stringify({ accepted: true, request_id: requestId }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-bmc error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
