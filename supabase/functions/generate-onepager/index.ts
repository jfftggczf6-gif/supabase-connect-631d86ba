import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse,
} from "../_shared/helpers.ts";
import { getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un expert en deal sourcing et communication investisseur pour PME africaines.
Tu rédiges des One-Pagers (teasers investisseur) d'une page, concis, percutants et professionnels.

Le one-pager doit être un document de deal sourcing que l'on envoie à un investisseur pour susciter l'intérêt.
Il doit être factuel, chiffré, et donner envie d'en savoir plus.

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const ONEPAGER_SCHEMA = `{
  "score": <0-100>,
  "entreprise": {
    "nom": "string",
    "secteur": "string",
    "pays": "string",
    "ville": "string",
    "forme_juridique": "string",
    "date_creation": "string",
    "effectifs": "string"
  },
  "proposition_valeur": "string — 2-3 phrases percutantes",
  "probleme_solution": {
    "probleme": "string — le problème marché adressé",
    "solution": "string — comment l'entreprise le résout"
  },
  "marche": {
    "tam": "string — Total Addressable Market",
    "sam": "string — Serviceable Addressable Market",
    "description": "string — positionnement"
  },
  "traction": {
    "ca_y_2": "string — CA N-2 avec devise",
    "ca_y_1": "string — CA N-1",
    "ca_y0": "string — CA dernier exercice",
    "croissance": "string — CAGR ou %",
    "clients_cles": "string"
  },
  "kpis_financiers": {
    "marge_brute": "string",
    "ebitda": "string",
    "resultat_net": "string",
    "tresorerie": "string"
  },
  "impact_odd": ["string — 2-3 ODD principaux avec description courte"],
  "equipe": "string — fondateur/dirigeant + expérience clé",
  "besoin_financement": {
    "montant": "string — ex: 200-500M FCFA",
    "utilisation": "string — à quoi servira le financement",
    "type": "string — equity, dette, mixte"
  },
  "valorisation_indicative": "string — fourchette si disponible",
  "points_forts": ["string — 3-5 points forts clés"],
  "contact": {
    "nom": "string",
    "email": "string",
    "telephone": "string"
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

    const delivSummary: string[] = [];
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 3000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 2000)}`);
    if (inputsData) delivSummary.push(`INPUTS FINANCIERS:\n${JSON.stringify(inputsData).substring(0, 3000)}`);
    if (planOvoData) delivSummary.push(`PLAN OVO:\n${JSON.stringify(planOvoData).substring(0, 3000)}`);
    if (valuationData) delivSummary.push(`VALORISATION:\n${JSON.stringify(valuationData).substring(0, 2000)}`);
    if (oddData) delivSummary.push(`ODD:\n${JSON.stringify(oddData).substring(0, 1500)}`);

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
VILLE : ${ent.city || ""}
EFFECTIFS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
DESCRIPTION : ${ent.description || ""}
CONTACT : ${ent.contact_name || ""} — ${ent.contact_email || ""} — ${ent.contact_phone || ""}

══════ LIVRABLES ══════
${delivSummary.join("\n\n")}

══════ CRITÈRES BAILLEURS ══════
${getDonorCriteriaPrompt()}

══════ INSTRUCTIONS ══════
Rédige un one-pager investisseur percutant et professionnel. Chaque section doit être concise (1-3 phrases max).
Les chiffres doivent être réels (tirés des livrables), pas inventés.
Si la valorisation est disponible, l'inclure.

Réponds en JSON selon ce schéma :
${ONEPAGER_SCHEMA}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 8192);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "onepager", rawData, "onepager");

    return jsonResponse({ success: true, data: rawData, score: rawData.score || 0 });
  } catch (e: any) {
    console.error("generate-onepager error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
