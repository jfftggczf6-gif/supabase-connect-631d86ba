import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse, errorResponse, verifyAndGetContext, getDocumentContentForAgent, saveDeliverable, getFiscalParams, getFiscalParamsForPrompt, getCoachingContext } from "../_shared/helpers_v5.ts";
import { callAIWithCalculator } from "../_shared/ai-with-tools.ts";
import { getSectorGuardrails, getFinancialKnowledgePrompt } from "../_shared/financial-knowledge.ts";
import { computeFullPlan } from "../_shared/financial-compute.ts";
import type { InputsData } from "../_shared/financial-compute.ts";

// ─────────────────────────────────────────────────────────────────
// EDGE FUNCTION: generate-plan-financier
// 
// Fusionne generate-framework + generate-plan-ovo + generate-ovo-plan
// en un seul module cohérent.
//
// Étape 1 : Appel IA (Claude Sonnet) → analyse qualitative + hypothèses
// Étape 2 : Calculs déterministes (financial-compute.ts) → ratios + projections
// Étape 3 : Merge → objet JSON unique → stocké en base
// ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { supabase, user } = await verifyAndGetContext(req, body);
    const enterpriseId = body.enterprise_id;
    if (!enterpriseId) return errorResponse("enterprise_id required", 400);

    const requestId = crypto.randomUUID();
    console.log(`[plan-financier] START ${requestId} for enterprise ${enterpriseId}`);

    // ═══════════════════════════════════════════════════════════════
    // 1. Récupérer TOUTES les sources
    // ═══════════════════════════════════════════════════════════════

    const { data: enterprise } = await supabase
      .from("enterprises")
      .select("name, country, sector, employees_count, description, operating_mode")
      .eq("id", enterpriseId)
      .single();

    if (!enterprise) return errorResponse("Enterprise not found", 404);

    // Fetch all deliverables
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("type, data")
      .eq("enterprise_id", enterpriseId);

    const getDeliv = (type: string) => deliverables?.find((d: any) => d.type === type)?.data || {};

    const inputsData = getDeliv("inputs") as InputsData;
    const bmcData = getDeliv("bmc");
    const sicData = getDeliv("sic");
    const diagnosticData = getDeliv("diagnostic");

    // Coaching notes
    const coachingContext = await getCoachingContext(supabase, enterpriseId);

    const currentYear = new Date().getFullYear();
    const country = enterprise.country || "Côte d'Ivoire";
    const sector = enterprise.sector || "agro_industrie";
    const fiscal = getFiscalParams(country);
    const fp = getFiscalParamsForPrompt(country);
    const guardrails = getSectorGuardrails(sector);

    // Update status
    await supabase.from("deliverables").upsert({
      enterprise_id: enterpriseId,
      type: "plan_financier",
      data: { status: "processing", request_id: requestId, phase: "calling_ai", started_at: new Date().toISOString() },
    }, { onConflict: "enterprise_id,type" });

    // ═══════════════════════════════════════════════════════════════
    // 2. Appel IA — analyse qualitative + hypothèses
    // ═══════════════════════════════════════════════════════════════

    console.log(`[plan-financier] Calling AI for analysis...`);

    const systemPrompt = buildSystemPrompt(country, sector, fp, guardrails);
    const userPrompt = buildUserPrompt(enterprise, inputsData, bmcData, sicData, diagnosticData, coachingContext, currentYear, fp);

    const aiAnalysis = await callAIWithCalculator(systemPrompt, userPrompt, 16384, "claude-sonnet-4-20250514");

    // ═══════════════════════════════════════════════════════════════
    // 3. Calculs déterministes
    // ═══════════════════════════════════════════════════════════════

    console.log(`[plan-financier] Computing financial plan...`);

    await supabase.from("deliverables").update({
      data: { status: "processing", request_id: requestId, phase: "computing", last_update_at: new Date().toISOString() },
    }).eq("enterprise_id", enterpriseId).eq("type", "plan_financier");

    const computed = computeFullPlan(
      inputsData,
      aiAnalysis,
      enterprise.name,
      country,
      currentYear,
      { tva: fiscal.tva, is: fiscal.is, devise: fiscal.devise, currency_iso: fiscal.currency_iso, exchange_rate_eur: fiscal.exchange_rate_eur },
    );

    // ═══════════════════════════════════════════════════════════════
    // 4. Merge analyse IA + calculs → objet final
    // ═══════════════════════════════════════════════════════════════

    const finalPlan = {
      ...computed,

      // Analyse IA (qualitatif)
      analyse: {
        avis: aiAnalysis.synthese?.avis || "",
        tags: aiAnalysis.synthese?.tags || [],
        score_investissabilite: aiAnalysis.synthese?.score_investissabilite || 0,
        verdict: aiAnalysis.synthese?.verdict || "Non évalué",
        risques: aiAnalysis.risques || [],
        conditions_investissement: aiAnalysis.conditions_investissement || [],
        coherence_bmc: aiAnalysis.coherence_bmc || [],
        sensibilite: aiAnalysis.sensibilite || [],
      },

      // Hypothèses IA (pour traçabilité)
      hypotheses_ia: aiAnalysis.hypotheses || {},

      // Metadata
      _meta: {
        generated_at: new Date().toISOString(),
        request_id: requestId,
        model: "claude-sonnet-4-20250514",
        version: "2.0-unified",
        sources: ["inputs_data", "bmc_data", "sic_data", "diagnostic_data", "coaching_notes"],
      },
    };

    // ═══════════════════════════════════════════════════════════════
    // 5. Stockage
    // ═══════════════════════════════════════════════════════════════

    console.log(`[plan-financier] Saving to database...`);

    await saveDeliverable(supabase, enterpriseId, "plan_financier", finalPlan, "PLAN_FIN", undefined, "generation");

    // Also trigger Excel generation via Railway
    try {
      const railwayUrl = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
      const excelResp = await fetch(`${railwayUrl}/generate-ovo-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPlan),
        signal: AbortSignal.timeout(120_000),
      });

      if (excelResp.ok) {
        const excelBuffer = await excelResp.arrayBuffer();
        const filename = `PlanFinancier_${enterprise.name.replace(/\s+/g, "_")}_OVO_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.xlsm`;

        // Upload to Supabase storage
        const { error: uploadErr } = await supabase.storage
          .from("deliverables")
          .upload(`${enterpriseId}/${filename}`, excelBuffer, {
            contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
            upsert: true,
          });

        if (!uploadErr) {
          await supabase.from("deliverables").update({
            data: { ...finalPlan, excel_filename: filename, excel_generated: true },
          }).eq("enterprise_id", enterpriseId).eq("type", "plan_financier");

          console.log(`[plan-financier] Excel generated: ${filename}`);
        }
      }
    } catch (excelErr) {
      console.warn(`[plan-financier] Excel generation failed (non-blocking):`, excelErr);
    }

    console.log(`[plan-financier] DONE ${requestId}`);

    return jsonResponse({
      success: true,
      request_id: requestId,
      plan: finalPlan,
    });

  } catch (err) {
    console.error("[plan-financier] ERROR:", err);
    return errorResponse(String(err), 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  country: string,
  sector: string,
  fp: any,
  guardrails: any,
): string {
  return `Tu es un analyste financier senior spécialisé dans les PME africaines francophones.

MISSION : Analyser les documents financiers d'une entreprise et produire une analyse qualitative structurée.

OUTILS DE CALCUL DISPONIBLES :
Tu as accès à une calculatrice financière via les outils suivants :
- calc(expression) : évalue toute expression arithmétique
- verify_total(composants, total_cible) : vérifie qu'une décomposition totalise le bon montant
- estimate_breakdown(total, categories) : répartit un total entre catégories en respectant la somme
- project_series(valeur, taux, nb_annees) : projette une série de valeurs
- ratio_check(num, denom, nom, benchmarks) : calcule et évalue un ratio

RÈGLE ABSOLUE : tu ne fais JAMAIS de calcul de tête.
À chaque fois que tu as besoin d'une division, multiplication, somme, ou pourcentage,
tu appelles l'outil calc(). Même pour des opérations simples comme 388M / 10000.
Cela garantit ZÉRO erreur arithmétique dans toute l'analyse.

CONTEXTE FISCAL ${country.toUpperCase()} :
- Devise : ${fp.currency_iso} (${fp.devise}) — taux ${fp.exchange_rate_eur} ${fp.currency_iso}/EUR
- TVA : ${fp.tva}%
- IS : ${fp.is_standard}%
- Cotisations sociales patronales : ${fp.charges_sociales}%
- Inflation : 3%/an

BENCHMARKS SECTORIELS (${sector}) :
- Marge brute : ${guardrails.marge_brute_min}-${guardrails.marge_brute_max}%
- Marge EBITDA : ${guardrails.marge_ebitda_min}-${guardrails.marge_ebitda_max}%
- Ratio personnel/CA : ${guardrails.ratio_personnel_ca_min}-${guardrails.ratio_personnel_ca_max}%
- Croissance max : ${guardrails.croissance_max_annuelle}%/an

ESTIMATION EN CASCADE :
Quand une donnée manque, estime en cascade :
1. Donnée directe → la prendre telle quelle
2. Croisement de sources → calc(CA_produit / volume_BMC) = prix unitaire
3. Benchmark sectoriel → marge aviculture CIV = 35-50% → calc(prix × 0.65) = COGS
4. Estimation raisonnée → utilise estimate_breakdown() pour répartir un total
5. TOUJOURS vérifier la cohérence → verify_total() doit confirmer que la somme = donnée réelle

CONTRAINTE DE COHÉRENCE ABSOLUE :
- Utilise verify_total() après chaque décomposition
- Si l'écart > 5%, ajuste les estimations et re-vérifie
- La somme des CA produits DOIT = CA total réel
- La somme des salaires DOIT = charges personnel réelles

RÈGLES :
1. Tu ANALYSES, tu ne CALCULES PAS de tête (utilise les outils)
2. Chaque chiffre cité DOIT référencer sa source précise
3. Croissance max 30%/an les 3 premières années, 15-20% ensuite
4. JAMAIS de valeur arbitraire
5. Le pays est ${country}. CAPEX uniquement pour ${country}.

Quand tu as terminé toutes tes estimations et vérifications, produis le JSON final.
FORMAT : JSON strict, zéro markdown, zéro texte avant/après.`;
}

// ─────────────────────────────────────────────────────────────────
// USER PROMPT
// ─────────────────────────────────────────────────────────────────

function buildUserPrompt(
  enterprise: any,
  inputs: InputsData,
  bmc: any,
  sic: any,
  diagnostic: any,
  coachingNotes: string,
  currentYear: number,
  fp: any,
): string {

  const cr = inputs.compte_resultat || {};
  const bil = inputs.bilan || {};
  const CA = cr.chiffre_affaires || cr.ca || inputs.revenue || 0;

  // Build context blocks
  let blocks = `ENTREPRISE :
- Nom : ${enterprise.name}
- Pays : ${enterprise.country}
- Secteur : ${enterprise.sector}
- Mode : ${enterprise.operating_mode || "N/A"}
- Année courante : ${currentYear}
- Employés : ${enterprise.employees_count || 0}
- CA déclaré : ${(CA || 0).toLocaleString("fr-FR")} ${fp.devise}
`;

  // Compte de résultat
  if (cr && Object.keys(cr).length > 0) {
    const lines = [];
    if (cr.chiffre_affaires || cr.ca) lines.push(`  CA: ${(cr.chiffre_affaires || cr.ca || 0).toLocaleString("fr-FR")}`);
    if (cr.achats_matieres || cr.achats) lines.push(`  Achats: ${(cr.achats_matieres || cr.achats || 0).toLocaleString("fr-FR")}`);
    if (cr.charges_personnel || cr.salaires) lines.push(`  Charges personnel: ${(cr.charges_personnel || cr.salaires || 0).toLocaleString("fr-FR")}`);
    if (cr.charges_externes) lines.push(`  Charges externes: ${(cr.charges_externes || 0).toLocaleString("fr-FR")}`);
    if (cr.dotations_amortissements) lines.push(`  Amortissements: ${(cr.dotations_amortissements || 0).toLocaleString("fr-FR")}`);
    if (cr.charges_financieres) lines.push(`  Charges financières: ${(cr.charges_financieres || 0).toLocaleString("fr-FR")}`);
    if (cr.resultat_exploitation) lines.push(`  Résultat exploitation: ${(cr.resultat_exploitation || 0).toLocaleString("fr-FR")}`);
    if (cr.resultat_net) lines.push(`  Résultat net: ${(cr.resultat_net || 0).toLocaleString("fr-FR")}`);
    if (lines.length > 0) blocks += `\nCOMPTE DE RÉSULTAT (données réelles — NE PAS MODIFIER) :\n${lines.join("\n")}\n`;
  }

  // Bilan
  if (bil && Object.keys(bil).length > 0) {
    const lines = [];
    if (bil.total_actif) lines.push(`  Total actif: ${bil.total_actif.toLocaleString("fr-FR")}`);
    if (bil.capitaux_propres) lines.push(`  Capitaux propres: ${bil.capitaux_propres.toLocaleString("fr-FR")}`);
    if (bil.dettes_totales || bil.dettes) lines.push(`  Dettes: ${(bil.dettes_totales || bil.dettes || 0).toLocaleString("fr-FR")}`);
    if (bil.tresorerie) lines.push(`  Trésorerie: ${bil.tresorerie.toLocaleString("fr-FR")}`);
    if (lines.length > 0) blocks += `\nBILAN (données réelles) :\n${lines.join("\n")}\n`;
  }

  // Équipe
  if (inputs.equipe && inputs.equipe.length > 0) {
    blocks += `\nÉQUIPE (données réelles) :\n${inputs.equipe.map(e => `  - ${e.poste}: ${e.nombre} pers., ${(e.salaire_mensuel || 0).toLocaleString("fr-FR")}/mois`).join("\n")}\n`;
  }

  // Coûts détaillés
  if (inputs.couts_variables?.length) {
    blocks += `\nCOÛTS VARIABLES :\n${inputs.couts_variables.map(c => `  - ${c.poste}: ${((c.montant_annuel || (c.montant_mensuel || 0) * 12) || 0).toLocaleString("fr-FR")}/an`).join("\n")}\n`;
  }
  if (inputs.couts_fixes?.length) {
    blocks += `\nCOÛTS FIXES :\n${inputs.couts_fixes.map(c => `  - ${c.poste}: ${((c.montant_annuel || (c.montant_mensuel || 0) * 12) || 0).toLocaleString("fr-FR")}/an`).join("\n")}\n`;
  }

  // Investissements
  if (inputs.investissements?.length) {
    blocks += `\nINVESTISSEMENTS EXISTANTS :\n${inputs.investissements.map(inv => `  - ${inv.nature}: ${(inv.montant || 0).toLocaleString("fr-FR")}, année ${inv.annee_achat || "N/A"}, amort. ${inv.duree_amortissement_ans || "N/A"} ans`).join("\n")}\n`;
  }

  // Financement
  if (inputs.financement) {
    const fin = inputs.financement;
    const parts = [];
    if (fin.apports_capital) parts.push(`  Capital: ${fin.apports_capital.toLocaleString("fr-FR")}`);
    if (fin.prets?.length) {
      fin.prets.forEach(p => parts.push(`  Prêt ${p.source}: ${(p.montant || 0).toLocaleString("fr-FR")} à ${p.taux_pct}% sur ${p.duree_mois} mois`));
    }
    if (parts.length > 0) blocks += `\nFINANCEMENT :\n${parts.join("\n")}\n`;
  }

  // BFR
  if (inputs.bfr) {
    const b = inputs.bfr;
    const parts = [];
    if (b.delai_clients_jours) parts.push(`  DSO: ${b.delai_clients_jours}j`);
    if (b.delai_fournisseurs_jours) parts.push(`  DPO: ${b.delai_fournisseurs_jours}j`);
    if (b.stock_moyen_jours) parts.push(`  DIO: ${b.stock_moyen_jours}j`);
    if (parts.length > 0) blocks += `\nBFR :\n${parts.join("\n")}\n`;
  }

  // BMC
  if (bmc && Object.keys(bmc).length > 0) {
    blocks += `\nBMC (Business Model Canvas) :\n${JSON.stringify(bmc, null, 2).slice(0, 3000)}\n`;
  }

  // SIC
  if (sic && Object.keys(sic).length > 0) {
    blocks += `\nSIC (Stratégie d'investissement) :\n${JSON.stringify(sic, null, 2).slice(0, 2000)}\n`;
  }

  // Diagnostic
  if (diagnostic && Object.keys(diagnostic).length > 0) {
    blocks += `\nDIAGNOSTIC EXPERT :\n${JSON.stringify(diagnostic, null, 2).slice(0, 3000)}\n`;
  }

  // Coaching notes
  if (coachingNotes) {
    blocks += `\nNOTES DU COACH :\n${coachingNotes.slice(0, 2000)}\n`;
  }

  // JSON schema to produce
  blocks += `
PRODUIS LE JSON SUIVANT (toutes les clés sont obligatoires) :

{
  "synthese": {
    "avis": "3-5 lignes d'analyse. Citer les chiffres réels. Identifier le problème principal et le potentiel.",
    "tags": ["tag1", "tag2", "tag3", "tag4"],
    "score_investissabilite": 48,
    "verdict": "Investissable | Conditionnel | Non investissable"
  },
  "risques": [
    { "titre": "...", "description": "...", "impact": "critique | élevé | modéré" }
  ],
  "conditions_investissement": [
    { "type": "prealable | recommande | suivi", "texte": "..." }
  ],
  "coherence_bmc": [
    { "niveau": "ok | warning | erreur", "texte": "..." }
  ],
  "hypotheses": {
    "taux_croissance_ca": [0.20, 0.20, 0.20, 0.15, 0.15],
    "taux_croissance_prix": 0.03,
    "taux_croissance_opex": 0.08,
    "taux_croissance_salariale": 0.05,
    "taux_cogs_cible": [0.72, 0.71, 0.70, 0.70, 0.70],
    "inflation": 0.03,
    "justification": "Texte expliquant le choix des taux..."
  },
  "produits": [
    {
      "nom": "Nom du produit",
      "prix_unitaire": 10000,
      "cout_unitaire": 6500,
      "volume_annuel": 38880,
      "taux_croissance_volume": 0.20,
      "taux_croissance_prix": 0.03,
      "part_ca": 0.56,
      "range_flags": [1, 0, 0],
      "channel_flags": [0, 1],
      "volume_ym2": 27000,
      "volume_ym1": 32400,
      "estimation": {
        "niveau": 2,
        "methode": "CA oeufs 388M / prix BMC 10 000 = 38 800 plateaux",
        "sources": ["États financiers 2024 — CA par activité", "BMC — flux revenus"],
        "confiance": "haute"
      }
    }
  ],
  "services": [],
  "staff": [
    {
      "categorie": "Direction",
      "departement": "DIRECTION",
      "effectif_actuel": 3,
      "effectif_cible_an5": 4,
      "salaire_mensuel": 350000,
      "taux_charges_sociales": 0.1645,
      "primes_annuelles": 50000,
      "estimation": {
        "niveau": 4,
        "methode": "Total 95M / 89 pers → calibrage itératif par catégorie BMC",
        "sources": ["États financiers 2024 — charges personnel", "BMC — ressources clés"],
        "confiance": "moyenne"
      }
    }
  ],
  "opex": {
    "marketing": { "total_cy": 1500000, "growth": 0.10 },
    "taxes_on_staff": { "total_cy": 200000, "growth": 0.05 },
    "office": { "total_cy": 800000, "growth": 0.05 },
    "other": { "total_cy": 100000, "growth": 0.03 },
    "travel": { "nb_travellers_cy": 3, "avg_cost_cy": 200000, "growth": 0.05 },
    "insurance": { "total_cy": 300000, "growth": 0.03 },
    "maintenance": { "total_cy": 200000, "growth": 0.05 },
    "third_parties": { "total_cy": 600000, "growth": 0.08 }
  },
  "capex": [
    {
      "label": "Système irrigation 50ha",
      "categorie": "production",
      "montant": 85000000,
      "annee": ${currentYear + 1},
      "taux_amortissement": 0.10,
      "estimation": { "niveau": 2, "methode": "Diagnostic expert", "sources": ["Diagnostic"], "confiance": "haute" }
    }
  ],
  "scenarios": {
    "pessimiste": { "taux_croissance": 0.10 },
    "realiste": { "taux_croissance": 0.20 },
    "optimiste": { "taux_croissance": 0.28 }
  },
  "sensibilite": [
    { "variable": "Prix du maïs", "impact_plus20": -45000000, "impact_moins20": 45000000, "niveau": "fort" }
  ],
  "ranges": [
    { "slot": 1, "name": "STANDARD" }, { "slot": 2, "name": "-" }, { "slot": 3, "name": "-" }
  ],
  "channels": [
    { "slot": 1, "name": "B2B" }, { "slot": 2, "name": "B2C" }
  ]
}

RAPPELS CRITIQUES :
- CHAQUE produit/service DOIT avoir volume_annuel > 0 et prix_unitaire > 0
- La SOMME des CA produits (prix × volume) doit ≈ CA total réel
- La SOMME des salaires staff × effectif × 12 × (1 + charges) doit ≈ charges personnel réelles
- L'OPEX total doit être cohérent avec les charges externes réelles
- Chaque estimation porte son objet "estimation" avec niveau, méthode, sources, confiance`;

  return blocks;
}
