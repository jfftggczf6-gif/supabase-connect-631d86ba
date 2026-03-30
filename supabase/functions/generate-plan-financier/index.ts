import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse, errorResponse, verifyAndGetContext, getDocumentContentForAgent, saveDeliverable, getFiscalParams, getFiscalParamsForPrompt, getCoachingContext, getKnowledgeForAgent, buildRAGContext } from "../_shared/helpers_v5.ts";
import { callAIWithCalculator } from "../_shared/ai-with-tools.ts";
import { getSectorGuardrails, getFinancialKnowledgePrompt } from "../_shared/financial-knowledge.ts";
import { computeFullPlan } from "../_shared/financial-compute.ts";
import { adaptPlanFinancierToOvoFormat } from "../_shared/plan-to-ovo-adapter.ts";
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
      .select("name, country, sector, employees_count, description, operating_mode, document_content, document_parsing_report")
      .eq("id", enterpriseId)
      .single();

    if (!enterprise) return errorResponse("Enterprise not found", 404);

    // Fetch all deliverables
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("type, data")
      .eq("enterprise_id", enterpriseId);

    const getDeliv = (type: string) => deliverables?.find((d: any) => d.type === type)?.data || {};

    const inputsData = getDeliv("inputs_data") as InputsData;
    const bmcData = getDeliv("bmc_analysis");
    const sicData = getDeliv("sic_analysis");
    const diagnosticData = getDeliv("diagnostic_data");
    const preScreenData = getDeliv("pre_screening");

    // Coaching notes
    const coachingContext = await getCoachingContext(supabase, enterpriseId);

    const currentYear = new Date().getFullYear();
    const country = enterprise.country || '';
    const sector = enterprise.sector || "agro_industrie";
    const fiscal = getFiscalParams(country);
    // Use currency from inputs if available (entrepreneur may use USD, EUR, etc.)
    const inputsCurrency = (inputsData as any)?.devise;
    if (inputsCurrency && inputsCurrency !== fiscal.devise) {
      console.log(`[plan-financier] Inputs use ${inputsCurrency}, country default is ${fiscal.devise} — using ${inputsCurrency}`);
      fiscal.devise = inputsCurrency;
      fiscal.currency_iso = inputsCurrency;
    }
    const fp = getFiscalParamsForPrompt(country);
    if (inputsCurrency) { fp.devise = inputsCurrency; fp.currency_iso = inputsCurrency; }
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

    // Knowledge base + RAG (benchmarks + feedback loop corrections)
    const knowledgeContext = await getKnowledgeForAgent(supabase, country, sector, 'framework');
    const ragContext = await buildRAGContext(supabase, country, sector, ["benchmarks", "fiscal"], "plan_financier");

    // Documents NON injectés dans plan_financier (trop lourd pour Sonnet + tools).
    // Les données sont déjà extraites par Opus dans inputs_data + BMC + SIC.

    const systemPrompt = buildSystemPrompt(country, sector, fp, guardrails);
    const userPrompt = buildUserPrompt(enterprise, inputsData, bmcData, sicData, preScreenData, diagnosticData, coachingContext, currentYear, fp)
      + knowledgeContext + ragContext;

    // Sonnet pour tools/calculatrice (Opus timeout avec tool_use loop dans edge functions)
    const aiAnalysis = await callAIWithCalculator(systemPrompt, userPrompt, 16384, "claude-sonnet-4-20250514", 0.2);

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
      enterprise.employees_count || 0,
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
        rentabilite_par_activite: computed.rentabilite_par_activite || [],
        ratios_vs_benchmarks: (() => {
          const mb = computed.sante_financiere?.rentabilite?.marge_brute_pct || 0;
          const ebitda = computed.sante_financiere?.rentabilite?.marge_ebitda_pct || 0;
          const persoCA = computed.kpis?.ca > 0 ? Math.round(((inputsData.compte_resultat?.charges_personnel || inputsData.compte_resultat?.salaires || 0) / computed.kpis.ca) * 1000) / 10 : 0;
          const src = guardrails.source || "I&P IPAE + Adenia Partners";
          return [
            { label: "Marge brute", valeur: `${mb}%`, benchmark: `${guardrails.marge_brute_min}-${guardrails.marge_brute_max}%`, statut: mb >= guardrails.marge_brute_min ? "ok" : "sous", source: src },
            { label: "Marge EBITDA", valeur: `${ebitda}%`, benchmark: `${guardrails.marge_ebitda_min}-${guardrails.marge_ebitda_max}%`, statut: ebitda >= guardrails.marge_ebitda_min ? "ok" : "sous", source: src },
            { label: "Personnel/CA", valeur: `${persoCA}%`, benchmark: `${guardrails.ratio_personnel_ca_min}-${guardrails.ratio_personnel_ca_max}%`, statut: persoCA <= guardrails.ratio_personnel_ca_max ? "ok" : "attention", source: src },
            { label: "Croissance max", valeur: `${guardrails.croissance_max_annuelle || 30}%/an`, benchmark: "Seuil prudentiel", statut: "reference", source: src },
          ].filter((r: any) => r.valeur !== "undefined%" && r.valeur !== "0%");
        })(),
      },

      // Hypothèses IA (pour traçabilité)
      hypotheses_ia: aiAnalysis.hypotheses || {},

      // Metadata
      _meta: {
        generated_at: new Date().toISOString(),
        request_id: requestId,
        model: "claude-opus-4-6",
        version: "2.0-unified",
        sources: ["inputs_data", "bmc_data", "sic_data", "diagnostic_data", "coaching_notes"],
      },
    };

    // ═══════════════════════════════════════════════════════════════
    // 5. Stockage
    // ═══════════════════════════════════════════════════════════════

    // Cell mapping Opus déplacé vers download-deliverable (on-demand)
    // pour éviter le WORKER_LIMIT sur la génération

    console.log(`[plan-financier] Saving to database...`);

    await saveDeliverable(supabase, enterpriseId, "plan_financier", finalPlan, "PLAN_FIN", undefined, "generation");

    // Also trigger Excel generation via Railway
    try {
      const railwayUrl = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
      const parserApiKey = Deno.env.get("PARSER_API_KEY") || "esono-parser-2026-prod";

      // Télécharger le template
      const { data: templateBlob, error: tplErr } = await supabase.storage
        .from("ovo-templates")
        .download("251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm");

      if (tplErr || !templateBlob) {
        throw new Error(`Template not found: ${tplErr?.message}`);
      }

      // Encoder en base64
      const templateBuffer = await templateBlob.arrayBuffer();
      const templateBytes = new Uint8Array(templateBuffer);
      let templateBase64 = "";
      // Encode to base64 safely (avoid stack overflow from spread on large arrays)
      let binaryStr = "";
      for (let i = 0; i < templateBytes.length; i++) {
        binaryStr += String.fromCharCode(templateBytes[i]);
      }
      templateBase64 = btoa(binaryStr);

      // Adapter plan_financier → format fill_ovo()
      const ovoData = adaptPlanFinancierToOvoFormat(finalPlan);
      console.log(`[plan-financier] Sending to Python: ${Object.keys(ovoData).length} keys, ${(ovoData.products||[]).length} products`);

      const excelResp = await fetch(`${railwayUrl}/generate-ovo-excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${parserApiKey}`,
        },
        body: JSON.stringify({
          data: ovoData,
          template_base64: templateBase64,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (excelResp.ok) {
        const excelBuffer = await excelResp.arrayBuffer();
        const filename = `PlanFinancier_${enterprise.name.replace(/\s+/g, "_")}_OVO_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.xlsm`;

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
          console.log(`[plan-financier] Excel generated: ${filename} (${excelBuffer.byteLength} bytes)`);
        } else {
          console.warn(`[plan-financier] Excel upload error: ${uploadErr.message}`);
        }
      } else {
        const errText = await excelResp.text();
        console.warn(`[plan-financier] Python error ${excelResp.status}: ${errText.slice(0, 200)}`);
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
3. Croissance max ${guardrails.croissance_max_annuelle}%/an pour ce secteur — ajuste selon l'historique réel de l'entreprise
4. JAMAIS de valeur arbitraire
5. Le pays est ${country}. CAPEX uniquement pour ${country}.

Quand tu as terminé toutes tes estimations et vérifications, produis le JSON final.
FORMAT : JSON strict, zéro markdown, zéro texte avant/après.

CRITICAL: Tu DOIS répondre UNIQUEMENT avec un objet JSON valide. Pas de texte avant, pas de texte après, pas de markdown. Commence ta réponse par { et termine par }.`;
}

// ─────────────────────────────────────────────────────────────────
// USER PROMPT
// ─────────────────────────────────────────────────────────────────

function buildUserPrompt(
  enterprise: any,
  inputs: InputsData,
  bmc: any,
  sic: any,
  preScreen: any,
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

  // Historique 3 ans — DONNÉES RÉELLES
  if ((inputs as any).historique_3ans) {
    const h = (inputs as any).historique_3ans;
    blocks += `\nHISTORIQUE 3 ANS (DONNÉES RÉELLES — NE PAS MODIFIER, utiliser comme base) :\n`;
    for (const [period, label] of [['n_moins_2', 'N-2'], ['n_moins_1', 'N-1'], ['n', 'N (année courante)']]) {
      const year = (h as any)[period];
      if (year?.ca_total) {
        blocks += `  ${label} (${year.annee}) : CA=${(year.ca_total||0).toLocaleString("fr-FR")}, CV=${(year.couts_variables||0).toLocaleString("fr-FR")}, CF=${(year.charges_fixes||0).toLocaleString("fr-FR")}, RE=${(year.resultat_exploitation||0).toLocaleString("fr-FR")}, RN=${(year.resultat_net||0).toLocaleString("fr-FR")}`;
        if (year.ca_par_produit?.length) blocks += `, Produits: ${year.ca_par_produit.map((p: any) => `${p.nom}=${(p.ca||0).toLocaleString("fr-FR")}`).join(', ')}`;
        blocks += `\n`;
      }
    }
    blocks += `⚠️ ATTENTION : le CA peut BAISSER d'une année à l'autre (cas réel). Ne PAS supposer une croissance régulière.\n`;
  }

  // Pre-compute product pricing (don't leave it to the AI)
  const prodServices = (inputs as any).produits_services || [];
  if (prodServices.length > 0) {
    blocks += `\nPRODUITS/SERVICES — DONNÉES PRÉ-CALCULÉES (utilise ces valeurs EXACTES) :\n`;
    for (const ps of prodServices) {
      const caVal = ps.ca_estime || ps.ca_annuel || 0;
      let prix = ps.prix_unitaire || 0;
      let vol = ps.volume_annuel || 0;

      // Pre-calculate missing prix/vol
      if (caVal > 0 && prix === 0 && vol > 0) {
        prix = Math.round(caVal / vol);
      } else if (caVal > 0 && vol === 0 && prix > 0) {
        vol = Math.round(caVal / prix);
      } else if (caVal > 0 && prix === 0 && vol === 0) {
        // Estimate: use CA/1000 as prix, CA/prix as vol
        prix = Math.max(1000, Math.round(caVal / 10000));
        vol = Math.round(caVal / prix);
      }

      const partCa = CA > 0 ? Math.round((caVal / CA) * 1000) / 10 : 0;
      blocks += `  → ${ps.nom}: CA=${caVal > 0 ? caVal.toLocaleString("fr-FR") : '0'} ${devise}, prix_unitaire=${prix.toLocaleString("fr-FR")}, volume_annuel=${vol.toLocaleString("fr-FR")}, part_ca=${partCa}%\n`;
    }
    blocks += `  ⚠️ CHAQUE produit ci-dessus DOIT apparaître dans "produits[]" avec les prix/volumes indiqués.\n`;
    blocks += `  ⚠️ JAMAIS de prix_unitaire = 0. Les valeurs ci-dessus sont PRÉ-CALCULÉES.\n`;
  }

  blocks += `
⚠️⚠️⚠️ INSTRUCTION CRITIQUE — PRODUITS / ACTIVITÉS ⚠️⚠️⚠️

Tu DOIS identifier TOUTES les activités de l'entreprise en lisant ATTENTIVEMENT :
1. Le RAPPORT D'ACTIVITÉS — liste explicitement les branches d'activité avec leurs CA
2. Le BMC (flux de revenus) — décrit les produits/services et leur pricing
3. Le PITCH DECK / PRÉSENTATION — décrit le business model
4. Les ÉTATS FINANCIERS — ventilation du CA par nature

RÈGLES ABSOLUES :
- Générer AU MINIMUM 3 produits/services si les documents en montrent 3+
- Utiliser les VRAIS NOMS des activités (pas des noms génériques)
- Si une activité a un CA dans les documents → l'inclure avec ce CA exact
- Si une activité est mentionnée mais sans CA chiffré → estimer depuis les proportions BMC et marquer estimation.niveau = 4
- La SOMME des CA de tous les produits DOIT = CA total du CdR (±5%)
- Pour chaque produit : préciser s'il est PRODUCTION, DISTRIBUTION, ou SERVICE
- NE PAS fusionner des activités distinctes en un seul produit
- NE PAS ignorer une activité sous prétexte qu'elle est petite

Exemple pour une entreprise avec 3 activités :
  produits[0] = {nom: "Distribution marchandises", prix_unitaire: ..., volume_annuel: ..., part_ca: 0.52}
  produits[1] = {nom: "Transport logistique", prix_unitaire: ..., volume_annuel: ..., part_ca: 0.35}
  produits[2] = {nom: "Production œufs de table", prix_unitaire: 10000, volume_annuel: 4200, part_ca: 0.13}
`;

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

  // Pre-screening insights (risques, classification, activités)
  if (preScreen && typeof preScreen === "object" && Object.keys(preScreen).length > 5) {
    blocks += `\nPRÉ-SCREENING (analyse préliminaire — calibre tes hypothèses) :\n`;
    if (preScreen.classification) blocks += `  Classification: ${preScreen.classification}\n`;
    if (preScreen.score) blocks += `  Score pré-screening: ${preScreen.score}/100\n`;
    if (preScreen.activites_identifiees?.length) {
      blocks += `  Activités identifiées:\n`;
      for (const a of preScreen.activites_identifiees.slice(0, 6)) {
        const nom = typeof a === 'string' ? a : a.nom || a.name || JSON.stringify(a);
        const ca = typeof a === 'object' ? a.ca_estime || a.ca || '' : '';
        blocks += `    - ${nom}${ca ? ` (CA≈${ca})` : ''}\n`;
      }
    }
    if (preScreen.forces?.length) {
      blocks += `  Forces: ${preScreen.forces.slice(0, 4).map((f: any) => typeof f === 'string' ? f : f.titre || f.description || '').join(' | ')}\n`;
    }
    if (preScreen.risques?.length) {
      blocks += `  Risques: ${preScreen.risques.slice(0, 4).map((r: any) => typeof r === 'string' ? r : r.titre || r.description || '').join(' | ')}\n`;
    }
    if (preScreen.kpis_extraits || preScreen.chiffres_cles) {
      const kpis = preScreen.kpis_extraits || preScreen.chiffres_cles;
      blocks += `  Chiffres clés: ${JSON.stringify(kpis).slice(0, 500)}\n`;
    }
    blocks += `  ⚠️ Utilise ces insights pour calibrer les taux de croissance et les risques.\n`;
  }

  // JSON schema to produce
  blocks += `
PRODUIS LE JSON SUIVANT (toutes les clés sont obligatoires) :

{
  "synthese": {
    "avis": "PARAGRAPHE DÉTAILLÉ (8-12 lignes) : analyse complète de la situation financière, forces et faiblesses, comparaison aux benchmarks sectoriels, potentiel de croissance, risques principaux, et recommandations. Citer les chiffres réels avec sources.",
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
    "taux_croissance_ca": [<5 valeurs décimales — CALCULÉES selon l'historique et le secteur, PAS copiées>],
    "taux_croissance_prix": <décimale — basée sur l'inflation du pays + positionnement prix>,
    "taux_croissance_opex": <décimale — cohérente avec la croissance CA>,
    "taux_croissance_salariale": <décimale — basée sur le marché du travail local>,
    "taux_cogs_cible": [<5 valeurs — basées sur la marge brute actuelle et les économies d'échelle>],
    "inflation": <décimale — inflation réelle du pays, pas un défaut>,
    "justification": "OBLIGATOIRE — 3-5 phrases expliquant POURQUOI ces taux spécifiques pour CETTE entreprise. Cite l'historique de croissance, le secteur, le pays, les contraintes identifiées."
  },
  ⚠️ HYPOTHÈSES — NE PAS COPIER L'EXEMPLE CI-DESSUS :
  - Si l'entreprise a un historique (CA N-2 → N-1 → N), CALCULER le taux de croissance historique et l'utiliser comme base
  - Si le CA a BAISSÉ dans l'historique, les taux doivent refléter un scénario de redressement progressif (pas 20%/an immédiatement)
  - Si le secteur a une croissance max de X%/an (voir benchmarks), ne pas dépasser
  - L'inflation doit être celle du PAYS réel (pas 3% par défaut)
  - Les taux COGS doivent refléter la marge brute ACTUELLE de l'entreprise, pas une valeur générique
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
- Chaque estimation porte son objet "estimation" avec niveau, méthode, sources, confiance

RAPPEL FINAL : Ta réponse doit être UNIQUEMENT un objet JSON valide commençant par { — aucun texte explicatif, aucune introduction, aucun markdown.`;

  return blocks;
}

// ─────────────────────────────────────────────────────────────────
// CELL MAP SYSTEM PROMPT (Opus 4.6 direct Excel mapping)
// ─────────────────────────────────────────────────────────────────

const CELL_MAP_SYSTEM_PROMPT = `Tu es un expert en finance d'entreprise africaine et en remplissage de templates Excel OVO.
Tu reçois les données financières d'une entreprise et tu dois produire un JSON qui mappe DIRECTEMENT chaque donnée vers sa cellule dans le template Excel OVO.

=== TEMPLATE OVO — CELL MAP ===

FEUILLE "InputsData":
J5=nom entreprise, J6=pays, J8=devise, J9=taux change EUR, J12=TVA (décimal), J14=inflation (décimal), J17=régime fiscal 1, J18=régime fiscal 2
J24=première année historique (ex: 2022), J25=J24+1, J26-J28=CY, J29-J33=forecasts
H36-H55=noms produits (20 slots, "-" si vide), I36-I55=flag actif (1/0)
H58-H67=noms services, I58-I67=flag actif
J70=gamme1, J71=gamme2, J72=gamme3, J75=canal1, J76=canal2
Produit flags: row 79+i → F=gamme1, G=gamme2, H=gamme3, I=canal1, J=canal2
Staff: row 113+i → H=catégorie, I=département, J=taux charges sociales
Prêts: I125=taux OVO, J125=durée OVO, I126=taux famille, J126=durée, I127=taux banque, J127=durée
Scénarios (H=worst, I=typical, J=best): 130-142

FEUILLE "RevenueData":
Produit N: base_row = 9 + (N-1)*16. Offsets: +0=Y-2, +1=Y-1, +2=CY, +3=Y+1, +4=Y+2, +5=Y+3, +6=Y+4, +7=Y+5
Colonnes: L=prix R1, M=prix R2, N=prix R3, P=mix R1, Q=mix R2, S=COGS R1, T=COGS R2, U=COGS R3
W=mix canal1 R1, X=mix canal1 R2, Y=mix canal1 R3
Historique (offsets 0-3): AE=Q1, AF=Q2, AG=Q3, AH=Q4
Projeté (offsets 4-7): AI=volume total annuel
⚠️ NE JAMAIS écrire R, Z, AA, AB (formules)

FEUILLE "FinanceData":
Colonnes: O=Y-2, P=Y-1, Q=H1, R=H2, T=Y+1, U=Y+2, V=Y+3, W=Y+4, X=Y+5
⚠️ COLONNE S = FORMULE, NE JAMAIS ÉCRIRE
Staff: Cat0: 213=effectif, 214=salaire, 215=primes, 216=SS. Cat1: 220-223. Cat2: 227-230. Cat3: 234-237. Cat4: 241-244. Cat5: 248-251. Cat6: 255-258. Cat7: 262-265. Cat8: 269-272. Cat9: 276-279
OPEX Marketing: 201=research, 202=studies, 203=receptions, 204=documentation, 205=advertising
Taxes: 283-286. Office: 294-303. Other: 311-314. Travel: 322=headcount, 323=cost. Insurance: 326-327. Maintenance: 335-337. Third Parties: 345-352
CAPEX (J=label, K=année, L=valeur, M=taux amort): Office 408-414, Production 450-456, Other 462-468, Intangible 486-490, Startup 493-497
Working Capital: 693=stock_days, 697=DSO, 701=DPO
Cash position (O,P): 773. Loans (S-X): 785=OVO, 786=famille, 787=banque
ReadMe: L3="French"

=== RÈGLES ===
1. NE JAMAIS écrire colonne S de FinanceData ni R/Z/AA/AB de RevenueData
2. Valeurs monétaires = NOMBRES ENTIERS (pas de string)
3. Taux = DÉCIMAUX (0.18 pas 18%)
4. N'inclure QUE les cellules ayant une valeur non-nulle
5. Inclure TOUTES les données disponibles

Réponds UNIQUEMENT avec un JSON valide :
{"cell_values": {"InputsData!J5": "nom", "RevenueData!L9": 9000, ...}, "stats": {"total_cells": 500}}`;
