// v5 — moteur déterministe + analyse IA qualitative 2026-03-21
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable,
  jsonResponse, errorResponse, getCoachingContext,
} from "../_shared/helpers_v5.ts";
import { getValuationBenchmarksPrompt } from "../_shared/financial-knowledge.ts";
import { computeValuation, extractValuationInputs } from "../_shared/valuation-engine.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { getKnowledgeForAgent } from "../_shared/helpers_v5.ts";
import { getCanonicalFinancials, upsertCanonicalFinancials } from "../_shared/canonical-financials.ts";

const ANALYSIS_PROMPT = `Tu es un analyste senior en valorisation d'entreprises, spécialisé dans le private equity africain (I&P, Partech, Phatisa, AfricInvest). 15 ans d'expérience.

On te fournit les RÉSULTATS CALCULÉS d'une valorisation (DCF, multiples, décotes, synthèse). Les chiffres sont déjà calculés et corrects — NE LES MODIFIE PAS.

Tu dois produire une ANALYSE QUALITATIVE DÉTAILLÉE et PÉDAGOGIQUE. Le lecteur est un coach ou un entrepreneur qui n'est pas forcément financier — il doit COMPRENDRE pourquoi l'entreprise vaut ce montant.

SECTIONS À PRODUIRE (concis, percutant, pas de remplissage) :

1. Note méthodologique DCF (60-100 mots) — explique le DCF, justifie le WACC, compare au marché
2. Justification des multiples (60-100 mots) — cite des transactions comparables africaines, explique le multiple retenu
3. Justification des décotes/primes (50-80 mots) — explique chaque ajustement
4. Note analyste (120-180 mots) — synthèse, forces/limites, fourchette crédible, facteurs de variation
5. Implications investissement — scénarios concrets de levée, sortie, IRR (concis)

RÈGLE ABSOLUE — CITATIONS DE SOURCES :
- INTERDIT d'écrire "(source: ...)", "(d'après ...)", "(réf: ...)", "selon le rapport X" DANS LE CORPS DES TEXTES.
- Toutes les sources externes (transactions comparables, benchmarks) vont UNIQUEMENT dans le champ dédié "sources_consultees" (array d'objets {source, used_for, section}).
- Les textes restent fluides sans parenthèses bibliographiques.

IMPORTANT:
- NE CHANGE PAS les chiffres calculés
- Réponds UNIQUEMENT en JSON valide
- Concis, factuel, professionnel — pas de prose inutile`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // ─── Brief 0.7 : précondition canonical WACC ─────────────────────
    // La Valuation ne peut tourner qu'après le plan financier (canonical.wacc_pct).
    // Évite la divergence historique (Valuation 60.3% RDC vs plan-financier 25%) :
    // un seul WACC fait foi, et c'est celui du plan-financier qui a la vue
    // intégrée des hypothèses (inflation, croissance, structure coûts).
    const canonical = await getCanonicalFinancials(ctx.supabase, ctx.enterprise_id);
    if (!canonical || canonical.wacc_pct == null) {
      return errorResponse(
        "Plan financier doit être généré avant la Valuation (WACC canonique manquant).",
        412,
      );
    }
    console.log(`[valuation] Using canonical WACC: ${canonical.wacc_pct}% (from ${canonical.last_updated_by})`);

    // 1. Charger les livrables
    const { data: deliverables } = await ctx.supabase
      .from("deliverables").select("type, data")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDeliv = (type: string) => deliverables?.find((d: any) => d.type === type)?.data || null;
    const planOvo = getDeliv("plan_financier") || getDeliv("plan_ovo");
    const inputsData = getDeliv("inputs_data");
    const frameworkData = getDeliv("framework_data");

    // 2. Extraire les inputs
    const valInputs = extractValuationInputs(planOvo, inputsData, frameworkData, ent);

    console.log("[valuation] Inputs:", {
      ca: valInputs.ca_dernier_exercice,
      ebitda: valInputs.ebitda_dernier_exercice,
      cashflows: valInputs.cashflows_projetes.length,
      pays: valInputs.pays,
      secteur: valInputs.secteur,
      gouvernance: valInputs.has_gouvernance_formelle,
      audit: valInputs.has_audit_externe,
    });

    // 2bis. Récupérer les paramètres risque pays (Damodaran) depuis knowledge_risk_params
    //       — évite de tomber sur les constantes hardcodées UEMOA/CEMAC si on a des valeurs à jour
    const paysKey = (ent.country || "").toLowerCase().replace(/[\s'']/g, '_').replace(/côte_d_ivoire|cote_divoire/i, 'cote_d_ivoire');
    const { data: riskParamsDB } = await ctx.supabase
      .from('knowledge_risk_params')
      .select('risk_free_rate, equity_risk_premium, country_risk_premium, size_premium_micro, size_premium_small, size_premium_medium, illiquidity_premium_min, illiquidity_premium_max, cost_of_debt, tax_rate')
      .eq('pays', paysKey)
      .maybeSingle();

    if (riskParamsDB) {
      console.log("[valuation] Risk params from DB:", { rf: riskParamsDB.risk_free_rate, erp: riskParamsDB.equity_risk_premium, crp: riskParamsDB.country_risk_premium });
    } else {
      console.log("[valuation] No risk_params in DB for", paysKey, "→ fallback sur constantes par zone");
    }

    // 3. CALCUL DÉTERMINISTE — Brief 0.7 : WACC vient désormais de canonical.wacc_pct
    // (riskParamsDB reste passé : computeWACC interne tourne en parallèle pour
    // traçabilité dans wacc_internal_computed → valuation_engine_would_have_used)
    const calcResult = computeValuation(valInputs, riskParamsDB, canonical.wacc_pct);

    console.log("[valuation] Calculated:", {
      dcf_equity: calcResult.dcf.equity_value,
      mult_ebitda: calcResult.multiples.valeur_par_ebitda,
      mult_ca: calcResult.multiples.valeur_par_ca,
      synthese_basse: calcResult.synthese.valeur_basse,
      synthese_mediane: calcResult.synthese.valeur_mediane,
      synthese_haute: calcResult.synthese.valeur_haute,
    });

    // 4. KB context
    const kbContext = await getKnowledgeForAgent(ctx.supabase, ent.country || "", ent.sector || "", "valuation", undefined, ctx.organization_id);

    // 5. Appel IA pour l'analyse qualitative
    const devise = inputsData?.devise || frameworkData?.devise || "";
    const internalWacc = calcResult.dcf.wacc_internal_computed;
    const waccChallengeBlock = `
═══ WACC CANONIQUE (FOURNI PAR LE PLAN FINANCIER) ═══
Le WACC utilisé pour ce DCF est ${canonical.wacc_pct}% — il provient du plan financier
qui a une vue intégrée des hypothèses (inflation, croissance, structure de coûts).
${internalWacc ? `À titre d'audit, le moteur de valorisation aurait calculé seul : ${internalWacc.wacc}%
(risk-free ${internalWacc.risk_free_rate}%, ERP ${internalWacc.equity_risk_premium}%,
size ${internalWacc.size_premium}%, illiq ${internalWacc.illiquidity_premium}%).
Ne pas appliquer ces composantes au DCF — uniquement utilisées pour la traçabilité.` : ''}

Tu peux le DISCUTER dans ta NOTE MÉTHODOLOGIQUE :
- Si tu le trouves trop conservateur : suggérer une fourchette plus basse + justification
- Si tu le trouves trop optimiste : suggérer une fourchette plus haute + justification
- Si tu le trouves juste : confirmer

MAIS : utilise ce WACC pour le DCF. Si tu le challenges, c'est documenté dans la note
qualitative, pas appliqué silencieusement dans les chiffres.
`;

    const analysisInput = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || 'Non spécifié'}
PAYS : ${ent.country || ''}
DEVISE : ${devise}
EFFECTIFS : ${ent.employees_count || 'Non spécifié'}
${waccChallengeBlock}
═══ RÉSULTATS CALCULÉS (NE PAS MODIFIER) ═══
DCF :
  WACC = ${calcResult.dcf.wacc_pct}%
  Enterprise Value = ${calcResult.dcf.enterprise_value.toLocaleString()} ${devise}
  Equity Value = ${calcResult.dcf.equity_value.toLocaleString()} ${devise}
  Terminal Value = ${calcResult.dcf.terminal_value.toLocaleString()} ${devise}
  Cashflows projetés : ${calcResult.dcf.projections_cashflow.map(p => `${p.annee}=${p.fcf.toLocaleString()}`).join(', ')}

Multiples :
  EBITDA ${calcResult.multiples.ebitda_dernier_exercice.toLocaleString()} × ${calcResult.multiples.multiple_ebitda_retenu} = ${calcResult.multiples.valeur_par_ebitda.toLocaleString()} ${devise}
  CA ${calcResult.multiples.ca_dernier_exercice.toLocaleString()} × ${calcResult.multiples.multiple_ca_retenu} = ${calcResult.multiples.valeur_par_ca.toLocaleString()} ${devise}

Décotes/Primes : ${calcResult.decotes_primes.ajustement_total_pct}%
  ${calcResult.decotes_primes.detail.join('\n  ')}

Synthèse : ${calcResult.synthese.valeur_basse.toLocaleString()} — ${calcResult.synthese.valeur_mediane.toLocaleString()} — ${calcResult.synthese.valeur_haute.toLocaleString()} ${devise}

═══ BENCHMARKS ═══
${getValuationBenchmarksPrompt()}

═══ INSTRUCTIONS ═══
Produis l'analyse qualitative en JSON :
{
  "note_methodologique_dcf": "string — 200+ mots : explication pédagogique du DCF, justification du WACC, comparaison marché",
  "justification_multiples": "string — 200+ mots : transactions comparables avec noms de fonds et montants",
  "comparables_references": ["string — transactions réelles : 'I&P a investi dans X en 2023 à 5.2x EBITDA'"],
  "justification_decotes": "string — 150+ mots : explication de chaque décote/prime en langage simple",
  "note_analyste": "string — 300+ mots : synthèse complète, forces et limites, fourchette crédible",
  "methode_privilegiee_justification": "string — 100+ mots : pourquoi DCF ou Multiples est plus fiable ici",
  "implications_investissement": {
    "pre_money_estime": <number>,
    "si_levee_100m": "string — dilution %, valorisation post-money, parts fondateur",
    "si_levee_500m": "string — idem pour un ticket plus gros",
    "multiple_sortie_estime": "string — hypothèse de sortie à 5-7 ans avec justification",
    "irr_investisseur_estime": "string — TRI brut et net, comparaison rendements PE Afrique (15-25%)",
    "scenario_sortie": "string — mécanismes de sortie possibles (cession, MBO, IPO régionale)"
  },
  "score": <0-100 — qualité et fiabilité de la valorisation>
}`;

    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);

    // Pre-screening insights for risk calibration
    let preScreenContext = "";
    const preScreen = ctx.deliverableMap["pre_screening"];
    if (preScreen && typeof preScreen === "object" && preScreen.score) {
      preScreenContext = `\nPré-screening: score=${preScreen.score}, classification=${preScreen.classification || "N/A"}`;
      if (preScreen.risques?.length) preScreenContext += `, risques: ${preScreen.risques.slice(0,3).map((r: any) => typeof r === 'string' ? r : r.titre || r).join("; ")}`;
      preScreenContext += "\n";
    }

    const aiAnalysis = await callAI(injectGuardrails(ANALYSIS_PROMPT, ent.country), analysisInput + kbContext + coachingContext + preScreenContext, 8192, undefined, 0.1, { functionName: "generate-valuation", enterpriseId: ctx.enterprise_id });

    // 5. Fusionner calculs + analyse IA
    const finalData = {
      score: aiAnalysis.score || 70,
      devise: inputsData?.devise || frameworkData?.devise || "",

      // CALCULÉ (déterministe)
      dcf: {
        ...calcResult.dcf,
        note_methodologique: aiAnalysis.note_methodologique_dcf || '',
      },
      multiples: {
        ...calcResult.multiples,
        justification_multiples: aiAnalysis.justification_multiples || '',
        comparables_references: aiAnalysis.comparables_references || [],
      },
      decotes_primes: {
        ...calcResult.decotes_primes,
        justification: aiAnalysis.justification_decotes || '',
      },
      synthese_valorisation: {
        ...calcResult.synthese,
        methode_privilegiee: calcResult.synthese.methode_privilegiee,
        justification_methode: aiAnalysis.methode_privilegiee_justification || '',
        note_analyste: aiAnalysis.note_analyste || '',
      },

      // IA (qualitatif)
      implications_investissement: {
        ...(aiAnalysis.implications_investissement || {}),
        scenario_sortie: aiAnalysis.implications_investissement?.scenario_sortie || '',
      },

      // Métadonnées
      _engine: {
        version: '2.0',
        calcul_deterministe: true,
        inputs_quality: calcResult.metadata.inputs_quality,
        methodes: calcResult.metadata.methodes_applicables,
      },
    };

    // Sanitize: strip inline source citations + aggregate into sources_consultees
    const SOURCE_PATTERNS = [
      /\(\s*(?:source|réf|ref|cf\.?|d['\u2019]après|selon|d'apr\u00E8s)\s*[:\-]?\s*([^)]+)\)/gi,
      /\s+(?:source|réf|ref)\s*[:\-]\s*([^.,;\n]+)/gi,
    ];
    const collectedSources: { source: string; used_for: string; section: string }[] = [];
    const stripInlineSources = (text: string, sectionPath: string): string => {
      let out = text;
      for (const re of SOURCE_PATTERNS) {
        out = out.replace(re, (_m, captured) => {
          const src = String(captured || '').trim().replace(/^[:\-\s]+|[:\-\s]+$/g, '');
          if (src && src.length > 2 && src.length < 200) {
            collectedSources.push({ source: src, used_for: 'Citation inline extraite', section: sectionPath });
          }
          return '';
        });
      }
      return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
    };
    const walkAndStrip = (obj: any, path = ''): void => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        const childPath = path ? `${path}.${key}` : key;
        const v = obj[key];
        if (key === 'sources_consultees' || key === 'source' || key === 'comparables_references') continue;
        if (typeof v === 'string') obj[key] = stripInlineSources(v, childPath);
        else if (Array.isArray(v)) {
          v.forEach((item, i) => {
            if (typeof item === 'string') v[i] = stripInlineSources(item, `${childPath}[${i}]`);
            else walkAndStrip(item, `${childPath}[${i}]`);
          });
        } else if (typeof v === 'object') walkAndStrip(v, childPath);
      }
    };
    walkAndStrip(finalData);
    if (collectedSources.length > 0) {
      const existing = Array.isArray((finalData as any).sources_consultees) ? (finalData as any).sources_consultees : [];
      const seen = new Set(existing.map((s: any) => (s.source || '').toLowerCase()));
      for (const s of collectedSources) {
        if (!seen.has(s.source.toLowerCase())) { existing.push(s); seen.add(s.source.toLowerCase()); }
      }
      (finalData as any).sources_consultees = existing;
    }

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "valuation", finalData, "valuation");

    // ─── Brief 0.7 : écriture canonical (colonnes valorisation uniquement) ──
    // On ne MODIFIE PAS wacc_pct (déjà canonique depuis plan-financier).
    // wacc_components contient la traçabilité : source + ce que computeWACC
    // aurait calculé seul (pour audit / comparaison).
    try {
      const internal = calcResult.dcf.wacc_internal_computed;
      const r = await upsertCanonicalFinancials(ctx.supabase, ctx.enterprise_id, {
        wacc_pct: canonical.wacc_pct, // confirmation, identique
        wacc_components: {
          source: "plan-financier-canonical",
          valuation_engine_would_have_used: internal ? {
            wacc: internal.wacc,
            risk_free_rate: internal.risk_free_rate,
            equity_risk_premium: internal.equity_risk_premium,
            size_premium: internal.size_premium,
            illiquidity_premium: internal.illiquidity_premium,
            cost_of_equity: internal.cost_of_equity,
            cost_of_debt: internal.cost_of_debt,
            debt_to_capital: internal.debt_weight,
          } : null,
        } as any,
        equity_value_dcf: calcResult.dcf.equity_value,
        enterprise_value_dcf: calcResult.dcf.enterprise_value,
        terminal_value: calcResult.dcf.terminal_value,
        multiple_ebitda_retenu: (calcResult.multiples as any).multiple_ebitda_retenu ?? (calcResult.multiples as any).ebitda_multiple ?? null,
        multiple_ca_retenu: (calcResult.multiples as any).multiple_ca_retenu ?? (calcResult.multiples as any).ca_multiple ?? null,
        valeur_par_ebitda: calcResult.multiples.valeur_par_ebitda,
        valeur_par_ca: calcResult.multiples.valeur_par_ca,
        valorisation_basse: calcResult.synthese.valeur_basse,
        valorisation_mediane: calcResult.synthese.valeur_mediane,
        valorisation_haute: calcResult.synthese.valeur_haute,
        methode_privilegiee: (calcResult.synthese as any).methode_privilegiee ?? (calcResult.synthese as any).methode_retenue ?? null,
      }, "generate-valuation");
      if (r.ok) {
        console.log(`[valuation] canonical valuation columns updated (version ${r.version})`);
      } else {
        console.error(`[valuation] canonical write failed (non-blocking): ${r.error}`);
      }
    } catch (e) {
      console.error("[valuation] canonical write failed (non-blocking):", e);
    }

    return jsonResponse({ success: true, data: finalData, score: finalData.score });

  } catch (e: any) {
    console.error("generate-valuation error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
