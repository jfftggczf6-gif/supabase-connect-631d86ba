import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse,
} from "../_shared/helpers.ts";
import { normalizeScreeningReport } from "../_shared/normalizers.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt, getValidationRulesPrompt } from "../_shared/financial-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un analyste financier senior spécialisé dans le screening de PME africaines pour des programmes de financement (DFI, fonds d'impact, incubateurs, banques).

TON RÔLE :
1. Détecter les INCOHÉRENCES FINANCIÈRES dans les documents et données fournis
2. Évaluer la QUALITÉ DOCUMENTAIRE du dossier
3. Produire un VERDICT de screening rapide pour un bailleur
4. Comparer le dossier aux CRITÈRES DU PROGRAMME si fournis

TYPES D'INCOHÉRENCES À DÉTECTER :
- Bilan déséquilibré (Total Actif ≠ Total Passif, écart > 2%)
- CA déclaré vs relevés bancaires (écart > 20% = red flag)
- Charges personnel à 0 avec effectif > 0 déclaré
- Marges irréalistes pour le secteur (marge brute > 80% en commerce par ex.)
- Résultat net positif mais trésorerie négative sans explication
- Créances clients > 50% du CA (risque d'impayés)
- Ratio d'endettement > 80% sans plan de remboursement
- Incohérence entre dates des documents et exercice déclaré
- CA en croissance mais effectif en baisse (contradictoire)
- Chiffres ronds suspects (tout en millions exacts = probable estimation)
- Documents datés de périodes différentes présentés comme un même exercice

CROSS-VALIDATION ENTRE DOCUMENTS :
- Comparer le CA du bilan/CdR avec la somme des factures uploadées
- Comparer les charges personnel avec les bulletins de paie si présents
- Comparer la trésorerie du bilan avec le solde du dernier relevé bancaire
- Vérifier que le RCCM correspond au nom de l'entreprise et au pays

CLASSIFICATION DES ANOMALIES :
- 🔴 BLOQUANT : incohérence qui invalide le dossier (fraude possible, données contradictoires majeures)
- 🟡 ATTENTION : anomalie à vérifier mais pas bloquante (estimation probable, données partielles)
- 🟢 NOTE : observation mineure, information contextuelle

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const SCREENING_SCHEMA = `{
  "screening_score": <0-100>,
  "verdict": "ELIGIBLE | CONDITIONNEL | NON_ELIGIBLE | INSUFFISANT",
  "verdict_summary": "string — 2-3 phrases résumant le verdict pour le bailleur",

  "anomalies": [
    {
      "severity": "bloquant | attention | note",
      "category": "finance | documents | coherence | completude",
      "title": "string — titre court de l'anomalie",
      "detail": "string — explication détaillée",
      "source_documents": ["string — quels documents sont concernés"],
      "recommendation": "string — que doit faire l'entrepreneur pour corriger"
    }
  ],

  "cross_validation": {
    "ca_coherent": true|false,
    "ca_declared": <number ou null>,
    "ca_from_documents": <number ou null>,
    "ca_ecart_pct": <number ou null>,
    "bilan_equilibre": true|false,
    "bilan_ecart": <number ou null>,
    "charges_personnel_coherent": true|false,
    "tresorerie_coherent": true|false,
    "notes": ["string — observations sur la cross-validation"]
  },

  "document_quality": {
    "total_documents": <number>,
    "documents_exploitables": <number>,
    "documents_illisibles": <number>,
    "couverture": {
      "legal": true|false,
      "finance": true|false,
      "commercial": true|false
    },
    "documents_manquants_critiques": ["string — document manquant"],
    "anciennete_documents": "string — ex: 'Documents de 2024, cohérents avec exercice déclaré'"
  },

  "financial_health": {
    "marge_brute_pct": <number ou null>,
    "marge_nette_pct": <number ou null>,
    "ratio_endettement_pct": <number ou null>,
    "ratio_liquidite": <number ou null>,
    "bfr_jours": <number ou null>,
    "benchmark_sector": "string — comparaison aux normes du secteur",
    "health_label": "Saine | Fragile | Critique | Non évaluable"
  },

  "programme_match": null | {
    "programme_name": "string",
    "match_score": <0-100>,
    "criteres_ok": ["string — critère satisfait"],
    "criteres_ko": ["string — critère non satisfait"],
    "criteres_partiels": ["string — critère partiellement satisfait"],
    "recommandation": "string — verdict par rapport au programme"
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // Optional: programme criteria from body
    let programmeCriteria: any = null;
    try {
      const body = await req.clone().json().catch(() => ({}));
      programmeCriteria = body.programme_criteria || null;
    } catch (_) { /* ignore */ }

    // Gather existing deliverables for cross-validation
    const { data: existingDeliverables } = await ctx.supabase
      .from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDelivData = (type: string) => {
      const d = existingDeliverables?.find((del: any) => del.type === type);
      return d?.data && typeof d.data === "object" ? d.data : null;
    };

    const inputsData = getDelivData("inputs_data");
    const bmcData = getDelivData("bmc_analysis");
    const sicData = getDelivData("sic_analysis");
    const frameworkData = getDelivData("framework_data");
    const planOvoData = getDelivData("plan_ovo");
    const diagnosticData = getDelivData("diagnostic_data");

    const ragContext = await buildRAGContext(
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"]
    );

    // Build deliverables summary for context
    const delivSummary = [];
    if (inputsData) delivSummary.push(`DONNÉES FINANCIÈRES (inputs_data):\n${JSON.stringify(inputsData).substring(0, 5000)}`);
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 2000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 2000)}`);
    if (frameworkData) delivSummary.push(`FRAMEWORK FINANCIER:\n${JSON.stringify(frameworkData).substring(0, 3000)}`);
    if (planOvoData) delivSummary.push(`PLAN OVO:\n${JSON.stringify(planOvoData).substring(0, 3000)}`);
    if (diagnosticData) delivSummary.push(`DIAGNOSTIC:\n${JSON.stringify(diagnosticData).substring(0, 2000)}`);

    const programmeSection = programmeCriteria
      ? `\n══════ CRITÈRES DU PROGRAMME ══════\n${JSON.stringify(programmeCriteria, null, 2)}\nCompare le dossier à ces critères et remplis la section programme_match.`
      : `\nAucun critère programme fourni — laisse programme_match à null.`;

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS DÉCLARÉS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
DESCRIPTION : ${ent.description || "Non spécifié"}

══════ DOCUMENTS UPLOADÉS ══════
${ctx.documentContent || "(Aucun document uploadé)"}

══════ LIVRABLES EXISTANTS ══════
${delivSummary.length > 0 ? delivSummary.join("\n\n") : "(Aucun livrable généré)"}

══════ BENCHMARKS SECTORIELS ══════
${getSectorKnowledgePrompt(ent.sector || "services_b2b")}

══════ CRITÈRES BAILLEURS DE RÉFÉRENCE ══════
${getDonorCriteriaPrompt()}

══════ RÈGLES DE VALIDATION CROISÉE ══════
${getValidationRulesPrompt()}

${ragContext}
${programmeSection}

══════ INSTRUCTIONS ══════
Analyse TOUT le dossier ci-dessus. Détecte les incohérences, évalue la qualité documentaire, produis un verdict de screening.
Cross-valide les données entre les différentes sources (documents vs livrables vs déclarations).
Le screening_score reflète la fiabilité globale du dossier pour un bailleur.

Réponds en JSON selon ce schéma :
${SCREENING_SCHEMA}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 12288);

    // Save as screening_report deliverable
    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "screening_report", rawData, "diagnostic");

    // Update enterprise score_ir
    if (rawData.screening_score) {
      await ctx.supabase.from("enterprises").update({
        score_ir: rawData.screening_score,
        last_activity: new Date().toISOString(),
      }).eq("id", ctx.enterprise_id);
    }

    return jsonResponse({ success: true, data: rawData, score: rawData.screening_score || 0 });
  } catch (e: any) {
    console.error("generate-screening-report error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
