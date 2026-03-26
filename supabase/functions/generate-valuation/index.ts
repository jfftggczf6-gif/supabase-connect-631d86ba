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

const ANALYSIS_PROMPT = `Tu es un analyste senior en valorisation d'entreprises, spécialisé dans le private equity africain (I&P, Partech, Phatisa, AfricInvest). 15 ans d'expérience.

On te fournit les RÉSULTATS CALCULÉS d'une valorisation (DCF, multiples, décotes, synthèse). Les chiffres sont déjà calculés et corrects — NE LES MODIFIE PAS.

Tu dois produire une ANALYSE QUALITATIVE DÉTAILLÉE et PÉDAGOGIQUE. Le lecteur est un coach ou un entrepreneur qui n'est pas forcément financier — il doit COMPRENDRE pourquoi l'entreprise vaut ce montant.

SECTIONS À PRODUIRE (chacune doit être un vrai paragraphe explicatif, pas juste une phrase) :

1. Note méthodologique DCF (200+ mots) — explique le DCF en langage accessible, justifie le WACC, compare avec le marché
2. Justification des multiples (200+ mots) — cite des transactions comparables récentes en Afrique, explique le multiple retenu
3. Justification des décotes/primes (150+ mots) — explique chaque ajustement en langage simple
4. Note analyste (300+ mots) — synthèse complète, forces et limites, fourchette crédible, facteurs de variation
5. Implications investissement — scénarios concrets de levée, sortie, IRR

IMPORTANT:
- NE CHANGE PAS les chiffres calculés
- Réponds UNIQUEMENT en JSON valide
- Sois EXPLICATIF et PÉDAGOGIQUE — le lecteur doit comprendre, pas juste voir des chiffres`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

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
    });

    // 3. CALCUL DÉTERMINISTE
    const calcResult = computeValuation(valInputs);

    console.log("[valuation] Calculated:", {
      dcf_equity: calcResult.dcf.equity_value,
      mult_ebitda: calcResult.multiples.valeur_par_ebitda,
      mult_ca: calcResult.multiples.valeur_par_ca,
      synthese_basse: calcResult.synthese.valeur_basse,
      synthese_mediane: calcResult.synthese.valeur_mediane,
      synthese_haute: calcResult.synthese.valeur_haute,
    });

    // 4. KB context
    const kbContext = await getKnowledgeForAgent(ctx.supabase, ent.country || "", ent.sector || "", "valuation");

    // 5. Appel IA pour l'analyse qualitative
    const analysisInput = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || 'Non spécifié'}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS : ${ent.employees_count || 'Non spécifié'}

═══ RÉSULTATS CALCULÉS (NE PAS MODIFIER) ═══
DCF :
  WACC = ${calcResult.dcf.wacc_pct}%
  Enterprise Value = ${calcResult.dcf.enterprise_value.toLocaleString()} FCFA
  Equity Value = ${calcResult.dcf.equity_value.toLocaleString()} FCFA
  Terminal Value = ${calcResult.dcf.terminal_value.toLocaleString()} FCFA
  Cashflows projetés : ${calcResult.dcf.projections_cashflow.map(p => `${p.annee}=${p.fcf.toLocaleString()}`).join(', ')}

Multiples :
  EBITDA ${calcResult.multiples.ebitda_dernier_exercice.toLocaleString()} × ${calcResult.multiples.multiple_ebitda_retenu} = ${calcResult.multiples.valeur_par_ebitda.toLocaleString()} FCFA
  CA ${calcResult.multiples.ca_dernier_exercice.toLocaleString()} × ${calcResult.multiples.multiple_ca_retenu} = ${calcResult.multiples.valeur_par_ca.toLocaleString()} FCFA

Décotes/Primes : ${calcResult.decotes_primes.ajustement_total_pct}%
  ${calcResult.decotes_primes.detail.join('\n  ')}

Synthèse : ${calcResult.synthese.valeur_basse.toLocaleString()} — ${calcResult.synthese.valeur_mediane.toLocaleString()} — ${calcResult.synthese.valeur_haute.toLocaleString()} FCFA

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

    const aiAnalysis = await callAI(injectGuardrails(ANALYSIS_PROMPT), analysisInput + kbContext + coachingContext + preScreenContext, 8192, undefined, 0.4);

    // 5. Fusionner calculs + analyse IA
    const finalData = {
      score: aiAnalysis.score || 70,
      devise: inputsData?.devise || frameworkData?.devise || "FCFA",

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

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "valuation", finalData, "valuation");
    return jsonResponse({ success: true, data: finalData, score: finalData.score });

  } catch (e: any) {
    console.error("generate-valuation error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
