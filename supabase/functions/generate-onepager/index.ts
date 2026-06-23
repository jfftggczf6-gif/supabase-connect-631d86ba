// v5 — format I&P one-pager 2026-03-21
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getCoachingContext, getFiscalParams, preloadFiscalParams,
} from "../_shared/helpers_v5.ts";
import { getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { getCanonicalFinancials, formatCanonicalForPrompt } from "../_shared/canonical-financials.ts";

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
- Concis : chaque champ est 1-3 phrases max
- Factuel et chiffré : pas de superlatifs ("leader du marché") sans preuve
- Le potentiel marché et l'impact sont des paragraphes narratifs

RÈGLES SUR LES CHIFFRES FINANCIERS (BRIEF 0.10) :
1. Les chiffres financiers (CA, EBITDA, TRI, VAN, valorisation, montant de la levée, croissance projetée) sont DÉJÀ calculés et te sont fournis dans le bloc « CHIFFRES FINANCIERS CANONIQUES ».
2. INTERDICTION de les recalculer, de les modifier ou d'en inventer d'autres dans tes narratives.
3. Les champs numériques de "traction_finances" (ca_annee_derniere, croissance, rentabilite) et "presentation_entreprise.financement_recherche" sont remplis automatiquement côté serveur depuis le canonique. Tu peux les laisser vides ou les pré-remplir mais ils seront écrasés.
4. Tu peux ajouter UN champ "commentaire_financier" (1-2 phrases qualitatives) qui contextualise les chiffres canoniques (ex: « EBITDA en hausse de 30% sur 3 ans grâce à la mutualisation des coûts de logistique »).

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
    "objectif": "string — à quoi sert le financement (qualitatif — montant rempli côté serveur)"
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
    "ventes": "string — narrative sur le modèle de vente et la traction commerciale (qualitatif)",
    "acces_financement": "string — financements obtenus jusqu'ici (qualitatif)",
    "economie_unitaire": "string — marge brute, marge unitaire, avantage coût (qualitatif)",
    "plan_croissance": "string — hypothèses de croissance et plan à 3-5 ans (qualitatif)",
    "source": "string — ex: 'États financiers 2022-2024'"
  },
  "commentaire_financier": "string — 1-2 phrases qualitatives sur les chiffres canoniques (ex: EBITDA en hausse de 30% grâce à la mutualisation)",

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

    // ═══════ Précondition SSOT (brief 0.10) — fiche canonical requise ═══════
    const canonical = await getCanonicalFinancials(ctx.supabase, ctx.enterprise_id);
    if (!canonical) {
      return errorResponse(
        "Plan financier doit être généré avant le OnePager (fiche canonique absente).",
        412,
      );
    }

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
    // Brief 0.10: plan_ovo & valuation lus depuis canonical (cf. formatCanonicalForPrompt)
    const oddData = getDelivData("odd_analysis");

    // Financial Truth Anchor
    const { getFinancialTruth } = await import("../_shared/normalizers.ts");
    const truth = getFinancialTruth(inputsData);
    // Précharge DB knowledge_country_data (Aurélie fixes RDC effectifs)
    await preloadFiscalParams(ctx.supabase);
    const devise = (inputsData as any)?.devise || getFiscalParams(ent.country || '').devise || '';
    let tractionBlock = "";
    if (truth) {
      tractionBlock = `
══════ TRACTION — CHIFFRES VÉRIFIÉS (ÉTATS FINANCIERS) ══════
⚠ UTILISER CES CHIFFRES EXACTEMENT DANS LA SECTION traction_finances
CA N-2 (${truth.annee_n - 2}) = ${truth.ca_n_minus_2.toLocaleString('fr-FR')} ${devise}
CA N-1 (${truth.annee_n - 1}) = ${truth.ca_n_minus_1.toLocaleString('fr-FR')} ${devise}
CA N (${truth.annee_n}) = ${truth.ca_n.toLocaleString('fr-FR')} ${devise}
Trésorerie = ${truth.tresorerie_nette.toLocaleString('fr-FR')} ${devise}
EBITDA = ${truth.ebitda.toLocaleString('fr-FR')} ${devise}
Marge brute = ${truth.marge_brute_pct}%
══════ FIN TRACTION ══════
`;
    }

    const delivSummary: string[] = [];
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 3000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 2000)}`);
    if (inputsData) delivSummary.push(`INPUTS FINANCIERS:\n${JSON.stringify(inputsData).substring(0, 3000)}`);
    if (oddData) delivSummary.push(`ODD:\n${JSON.stringify(oddData).substring(0, 1500)}`);

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || ''}
VILLE : ${ent.city || ""}
EFFECTIFS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
DESCRIPTION : ${ent.description || ""}
CONTACT : ${ent.contact_name || ""} — ${ent.contact_email || ""} — ${ent.contact_phone || ""}

${tractionBlock}

${formatCanonicalForPrompt(canonical)}

══════ LIVRABLES (contexte qualitatif uniquement — chiffres dans le bloc canonique ci-dessus) ══════
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
    const rawData = await callAI(injectGuardrails(SYSTEM_PROMPT, ent.country), prompt + coachingContext, 8192, "claude-sonnet-4-6", 0.3, { functionName: "generate-onepager", enterpriseId: ctx.enterprise_id });

    // ═══════ Injection serveur depuis canonical (brief 0.10) ═══════
    // L'IA garde les narratives qualitatives. Tous les chiffres viennent du canonique.
    const ccy = canonical.currency_iso || canonical.currency || "FCFA";
    const fmt = (n: number | null | undefined) =>
      n !== null && n !== undefined
        ? `${Math.round(n).toLocaleString("fr-FR")} ${ccy}`
        : "—";

    const caProj = (canonical.ca_projected as any) || {};
    const cagr5y =
      caProj.y5 != null && canonical.ca_y != null && canonical.ca_y > 0
        ? Math.round((Math.pow(caProj.y5 / canonical.ca_y, 1 / 5) - 1) * 100)
        : null;

    rawData.kpis_financiers = {
      ca_actuel: canonical.ca_y,
      ebitda_actuel: canonical.ebitda_y,
      resultat_net_actuel: canonical.resultat_net_y,
      croissance_projetee_pct: cagr5y,
      ca_projected_y5: caProj.y5 ?? null,
      van: canonical.van,
      tri_pct: canonical.tri_pct,
      payback_years: canonical.payback_years,
      currency: ccy,
      _injected_from_canonical: true,
      _canonical_version: canonical.version,
    };

    rawData.valorisation_indicative = {
      fourchette_basse: canonical.valorisation_basse,
      fourchette_mediane: canonical.valorisation_mediane,
      fourchette_haute: canonical.valorisation_haute,
      methode: canonical.methode_privilegiee,
      wacc_pct: canonical.wacc_pct,
      currency: ccy,
      _injected_from_canonical: true,
      _canonical_version: canonical.version,
    };

    rawData.financement_recherche = {
      montant: canonical.besoin_financement_total,
      currency: ccy,
      composition: canonical.composition_besoin,
      financement_deja_obtenu: canonical.financement_deja_obtenu,
      _injected_from_canonical: true,
      _canonical_version: canonical.version,
    };

    // Backward-compat strings — écrasent les valeurs IA pour garantir cohérence avec canonical
    rawData.presentation_entreprise = rawData.presentation_entreprise || {};
    rawData.presentation_entreprise.financement_recherche =
      canonical.besoin_financement_total != null
        ? fmt(canonical.besoin_financement_total)
        : rawData.presentation_entreprise.financement_recherche;

    rawData.traction_finances = rawData.traction_finances || {};
    if (canonical.ca_y != null) {
      rawData.traction_finances.ca_annee_derniere = `${fmt(canonical.ca_y)}${canonical.base_year ? ` (${canonical.base_year})` : ""}`;
    }
    const histParts: string[] = [];
    if (canonical.ca_y_minus_2 != null && canonical.base_year)
      histParts.push(`${fmt(canonical.ca_y_minus_2)} (${canonical.base_year - 2})`);
    if (canonical.ca_y_minus_1 != null && canonical.base_year)
      histParts.push(`${fmt(canonical.ca_y_minus_1)} (${canonical.base_year - 1})`);
    if (canonical.ca_y != null && canonical.base_year)
      histParts.push(`${fmt(canonical.ca_y)} (${canonical.base_year})`);
    if (histParts.length >= 2) {
      rawData.traction_finances.croissance = histParts.join(" → ");
    }
    if (canonical.ebitda_y != null || canonical.resultat_net_y != null) {
      rawData.traction_finances.rentabilite = `EBITDA ${fmt(canonical.ebitda_y)} · Résultat net ${fmt(canonical.resultat_net_y)}`;
    }

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "onepager", rawData, "onepager");

    return jsonResponse({ success: true, data: rawData, score: rawData.score || 0 });
  } catch (e: any) {
    console.error("generate-onepager error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
