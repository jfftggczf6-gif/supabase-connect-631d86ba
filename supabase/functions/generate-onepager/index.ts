// v5 — format I&P one-pager 2026-03-21
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getCoachingContext,
} from "../_shared/helpers_v5.ts";
import { getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";

const SYSTEM_PROMPT = `Tu es un analyste deal sourcing senior spécialisé en investissement d'impact en Afrique francophone.

Tu rédiges un One-Pager au format I&P (Investisseurs & Partenaires). C'est un document de 1 page qui synthétise une entreprise pour susciter l'intérêt d'un investisseur ou d'un bailleur.

FORMAT :
Le one-pager suit EXACTEMENT la structure du template I&P :
1. Titre : "I&P Company One-Pager – [Nom]"
2. Aperçu du projet (3-5 phrases)
3. Tableau à 5 sections :
   - Présentation de l'entreprise (infos factuelles)
   - Équipe et gouvernance
   - Traction et finances (CHIFFRES RÉELS, pas inventés)
   - Potentiel du marché
   - Impact
4. Critères I&P : documentation disponible par catégorie

RÈGLES :
- Chaque champ de la section "traction_finances" DOIT utiliser les chiffres exacts des états financiers
- Le CA doit être le CA réel du dernier exercice (pas une estimation)
- La croissance doit montrer l'historique 3 ans réel
- Concis : chaque champ est 1-3 phrases max
- Factuel et chiffré : pas de superlatifs ("leader du marché") sans preuve
- Le potentiel marché et l'impact sont des paragraphes narratifs

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const ONEPAGER_SCHEMA = `{
  "titre": "string — 'I&P Company One-Pager – [Nom entreprise]'",
  "apercu_projet": "string — 3-5 phrases décrivant les activités de l'entreprise, son positionnement et sa proposition de valeur",

  "presentation_entreprise": {
    "nom": "string",
    "secteur": "string",
    "localisation": "string — ville, pays",
    "site_web": "string ou 'Non disponible'",
    "annee_creation": "string",
    "forme_juridique": "string",
    "financement_recherche": "string — montant et type (ex: '150-200M FCFA — prêt à taux préférentiel')",
    "objectif": "string — à quoi sert le financement"
  },

  "equipe_gouvernance": {
    "fondateur": "string — nom + parcours en 1 phrase",
    "dirige_par_femmes": "string — Oui / Non / Partiellement",
    "competences": "string — compétences clés de l'équipe dirigeante",
    "taille_equipe": "string — nombre de personnes + répartition si pertinent",
    "gouvernance": "string — description de la gouvernance (CA, comité, etc.)",
    "formelle": "string — Oui / Non / En cours — détail"
  },

  "traction_finances": {
    "ventes": "string — description du modèle de vente et de la traction commerciale",
    "ca_annee_derniere": "string — CA exact avec l'année (ex: '460 329 721 FCFA (2024)')",
    "acces_financement": "string — financements obtenus jusqu'ici",
    "croissance": "string — taux de croissance et historique (ex: '462M (2022) → 759M (2023) → 460M (2024)')",
    "economie_unitaire": "string — marge brute, marge unitaire, avantage coût",
    "rentabilite": "string — EBITDA, marge nette, résultat net",
    "plan_croissance": "string — hypothèses de croissance et plan à 3-5 ans",
    "source": "string — ex: 'États financiers 2022-2024' ou 'Plan OVO — projections'"
  },

  "potentiel_marche": "string — 1 paragraphe décrivant la taille du marché, la dynamique, la concurrence et le positionnement",

  "impact": "string — 1 paragraphe décrivant l'impact social (emplois, sécurité alimentaire, inclusion, ODD alignés)",

  "criteres_ip": {
    "generalites": "string — documentation générale disponible (statuts, K-bis, organigramme...)",
    "financier": "string — documentation financière disponible (états financiers, business plan, projections...)",
    "juridique": "string — documentation juridique disponible (statuts, PV AG, contrats...)",
    "impact_doc": "string — documentation impact disponible (théorie du changement, indicateurs, ODD...)",
    "rh": "string — documentation RH disponible (organigramme, contrats, masse salariale...)"
  },

  "score": "<number 0-100>"
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

    // Financial Truth Anchor
    const { getFinancialTruth } = await import("../_shared/normalizers.ts");
    const truth = getFinancialTruth(inputsData);
    let tractionBlock = "";
    if (truth) {
      tractionBlock = `
══════ TRACTION — CHIFFRES VÉRIFIÉS (ÉTATS FINANCIERS) ══════
⚠ UTILISER CES CHIFFRES EXACTEMENT DANS LA SECTION traction_finances
CA N-2 (${truth.annee_n - 2}) = ${truth.ca_n_minus_2.toLocaleString('fr-FR')} FCFA
CA N-1 (${truth.annee_n - 1}) = ${truth.ca_n_minus_1.toLocaleString('fr-FR')} FCFA
CA N (${truth.annee_n}) = ${truth.ca_n.toLocaleString('fr-FR')} FCFA
Trésorerie = ${truth.tresorerie_nette.toLocaleString('fr-FR')} FCFA
EBITDA = ${truth.ebitda.toLocaleString('fr-FR')} FCFA
Marge brute = ${truth.marge_brute_pct}%
══════ FIN TRACTION ══════
`;
    }

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

${tractionBlock}

══════ LIVRABLES ══════
${delivSummary.join("\n\n")}

══════ CRITÈRES BAILLEURS ══════
${getDonorCriteriaPrompt()}

══════ INSTRUCTIONS ══════
Rédige un one-pager au format I&P. Chaque section doit être concise (1-3 phrases max).
Les chiffres de la section traction_finances doivent être les chiffres réels des états financiers.
La section criteres_ip doit lister les documents OVO disponibles pour chaque catégorie.

Réponds en JSON selon ce schéma :
${ONEPAGER_SCHEMA}`;

    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);
    const rawData = await callAI(injectGuardrails(SYSTEM_PROMPT), prompt + coachingContext, 8192);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "onepager", rawData, "onepager");

    return jsonResponse({ success: true, data: rawData, score: rawData.score || 0 });
  } catch (e: any) {
    console.error("generate-onepager error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
