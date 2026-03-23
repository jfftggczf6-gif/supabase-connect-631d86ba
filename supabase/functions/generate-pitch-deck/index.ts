// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse,
} from "../_shared/helpers_v5.ts";
import { getFinancialKnowledgePrompt, getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";

const SYSTEM_PROMPT = `Tu es un expert en levée de fonds et présentation investisseur pour PME africaines.
Tu crées des Pitch Decks de 12 slides structurées pour présentation en comité d'investissement.

STRUCTURE DES 12 SLIDES :
1. Cover — Nom, logo, tagline, secteur, pays
2. Problème — Le problème marché adressé (chiffres, douleur client)
3. Solution — La solution de l'entreprise (proposition de valeur unique)
4. Marché — TAM/SAM/SOM, tendances, potentiel de croissance
5. Business Model — Comment l'entreprise gagne de l'argent (modèle de revenus)
6. Traction — KPIs clés, croissance, clients, réalisations
7. Financier — P&L résumé, projections 5 ans, KPIs financiers
8. Impact — Alignement ODD, impact social/environnemental mesurable
9. Équipe — Fondateurs, management, compétences clés
10. Concurrence — Positionnement, avantages compétitifs, barrières
11. Ask — Montant recherché, valorisation, utilisation des fonds, ROI attendu
12. Contact — Coordonnées, prochaines étapes

Chaque slide doit avoir un titre, des bullet points percutants, et des données chiffrées quand possible.

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const PITCH_SCHEMA = `{
  "score": <0-100>,
  "slides": [
    {
      "numero": 1,
      "titre": "string",
      "type": "cover|probleme|solution|marche|business_model|traction|financier|impact|equipe|concurrence|ask|contact",
      "contenu": {
        "headline": "string — titre principal de la slide",
        "bullets": ["string — points clés"],
        "chiffres_cles": [{"label": "string", "valeur": "string", "source": "string"}],
        "notes_presentateur": "string — ce qu'il faut dire en présentant cette slide"
      }
    }
  ],
  "metadata": {
    "entreprise": "string",
    "secteur": "string",
    "pays": "string",
    "date_generation": "string",
    "duree_presentation_estimee": "string — ex: 15-20 minutes"
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    const { data: existingDeliverables } = await ctx.supabase
      .from("deliverables")
      .select("type, data")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDelivData = (type: string) => {
      const d = existingDeliverables?.find((del: any) => del.type === type);
      return d?.data && typeof d.data === "object" ? d.data : null;
    };

    const bmcData = getDelivData("bmc_analysis");
    const sicData = getDelivData("sic_analysis");
    const inputsData = getDelivData("inputs_data");
    const planOvoData = getDelivData("plan_ovo");
    const valuationData = getDelivData("valuation");
    const oddData = getDelivData("odd_analysis");
    const diagnosticData = getDelivData("diagnostic_data");

    const knowledgeBase = getFinancialKnowledgePrompt(ent.country || "cote_d_ivoire", ent.sector || "services_b2b", false);

    const delivSummary: string[] = [];
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 3000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 2000)}`);
    if (inputsData) delivSummary.push(`INPUTS:\n${JSON.stringify(inputsData).substring(0, 3000)}`);
    if (planOvoData) delivSummary.push(`PLAN OVO:\n${JSON.stringify(planOvoData).substring(0, 5000)}`);
    if (valuationData) delivSummary.push(`VALORISATION:\n${JSON.stringify(valuationData).substring(0, 3000)}`);
    if (oddData) delivSummary.push(`ODD:\n${JSON.stringify(oddData).substring(0, 2000)}`);
    if (diagnosticData) delivSummary.push(`DIAGNOSTIC:\n${JSON.stringify(diagnosticData).substring(0, 2000)}`);

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
DESCRIPTION : ${ent.description || ""}
EFFECTIFS : ${ent.employees_count || "Non spécifié"}
CONTACT : ${ent.contact_name || ""} — ${ent.contact_email || ""} — ${ent.contact_phone || ""}

══════ LIVRABLES ══════
${delivSummary.join("\n\n")}

══════ CONNAISSANCES FINANCIÈRES ══════
${knowledgeBase}

══════ CRITÈRES BAILLEURS ══════
${getDonorCriteriaPrompt()}

══════ INSTRUCTIONS ══════
Crée exactement 12 slides pour un pitch deck investisseur professionnel.
Chaque slide doit être percutante, chiffrée quand possible, et adaptée au contexte PME Afrique.
La slide "Ask" (11) doit inclure la valorisation si disponible dans les livrables.

Réponds en JSON selon ce schéma :
${PITCH_SCHEMA}`;

    const rawData = await callAI(injectGuardrails(SYSTEM_PROMPT), prompt, 16384);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "pitch_deck", rawData, "pitch_deck");

    return jsonResponse({ success: true, data: rawData, score: rawData.score || 0 });
  } catch (e: any) {
    console.error("generate-pitch-deck error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
