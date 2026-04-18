// generate-compliance-report — Auto-generate OVO Compliance Feedback Report
// Template: 7 sections (Project Description, Financial, Legal, IP, Social & Environmental, HR, Insurance)
// Each section: Observations clés, À clarifier, Recommandations
// Visible only in programme manager space
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable,
  jsonResponse, errorResponse, getDocumentContentForAgent, getCoachingContext
} from "../_shared/helpers_v5.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import {
  OVO_COMPLIANCE_SECTIONS, OVO_RED_FLAGS, buildOvoRedFlagsPromptContext,
  buildOvoCompliancePromptContext, MINIMUM_WAGES_BY_COUNTRY
} from "../_shared/ovo-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un compliance officer senior pour OVO (Ondernemers voor Ondernemers), une organisation belge qui finance des PME africaines via des prêts (jusqu'à €250,000).

Tu dois rédiger un COMPLIANCE FEEDBACK REPORT structuré pour préparer le dossier au Comité d'Investissement (IC).

STRUCTURE EXACTE DU RAPPORT (7 sections) :

1. **Project Description** — Résumé du projet, cohérence BP vs plan financier, utilisation du prêt, qualité du rapport coach
2. **Financial Documentation** — Analyse détaillée : salaires réalistes, coûts complets, hypothèses vérifiées, cohérence chiffres, plan d'investissement
3. **Legal Documentation** — Enregistrement, permis, contrats, structure actionnariale, conformité activités
4. **Intellectual Property** — Brevets, marques, certifications
5. **Social & Environmental** — ODD avec preuves, HACCP, salaires minimum, sécurité, gestion déchets/eau/énergie
6. **HR & Other** — Plan RH, emplois, formation, indexation salariale
7. **Insurance Policies** — Assurances opérationnelles, risk management

Pour CHAQUE section, tu dois fournir :
- **observations_cles** : ce qui a été trouvé (positif et négatif)
- **a_clarifier** : ce qui manque ou nécessite des précisions
- **recommandations** : ce qu'il faut corriger ou améliorer

Tu dois aussi fournir :
- **conclusion** : verdict global + liste numérotée d'actions prioritaires avant soumission au CI
- **red_flags** : patterns de risque détectés (basés sur l'analyse de 60 projets OVO)
- **score_compliance** : score de compliance de 0 à 100

RÈGLES :
- Sois factuel et précis — cite les chiffres exacts du BP et du plan financier
- Compare les données entre documents (BP, plan financier, rapport coach) — signale les incohérences
- Vérifie les normes locales (salaire minimum, cotisations, réglementations sectorielles)
- Retourne UNIQUEMENT du JSON valide, pas de markdown`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { enterprise_id } = body;
    if (!enterprise_id) return errorResponse("enterprise_id requis", 400);

    const ctx = await verifyAndGetContext(req, body);
    const { supabase, enterprise: ent } = ctx;

    // Check role — only managers, owners, admins, super_admins
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.user.id);
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", ctx.user.id)
      .eq("organization_id", ctx.organization_id || "")
      .eq("is_active", true)
      .maybeSingle();

    const userRoles = (roles || []).map((r: any) => r.role);
    const orgRole = orgMember?.role;
    const isAllowed = userRoles.includes("super_admin") || ["owner", "admin", "manager"].includes(orgRole || "");
    if (!isAllowed) return errorResponse("Seuls les managers et super_admins peuvent générer un compliance report", 403);

    // Fetch all deliverables for this enterprise
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", enterprise_id);

    const delivMap: Record<string, any> = {};
    (deliverables || []).forEach((d: any) => { delivMap[d.type] = d.data; });

    const bpData = delivMap.business_plan || {};
    const planFinData = delivMap.plan_financier || {};
    const oddData = delivMap.odd_analysis || {};
    const preScreening = delivMap.pre_screening || {};
    const diagnosticData = delivMap.diagnostic_data || {};
    const inputsData = delivMap.inputs_data || {};
    const valuationData = delivMap.valuation || {};

    // Get documents content + coaching context
    const agentDocs = getDocumentContentForAgent(ent, "compliance", 60_000);
    const coachingContext = await getCoachingContext(supabase, enterprise_id);

    // Build minimum wage context
    const minWage = MINIMUM_WAGES_BY_COUNTRY[ent.country] || null;
    const minWageContext = minWage
      ? `\nSalaire minimum ${ent.country}: ${minWage.monthly} ${minWage.currency}/mois (${minWage.source})`
      : "";

    const userPrompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Non spécifié"}
${minWageContext}

═══ BUSINESS PLAN ═══
${JSON.stringify(bpData, null, 1).slice(0, 15000)}

═══ PLAN FINANCIER (résumé) ═══
${JSON.stringify({
  kpis: planFinData.kpis,
  analyse: planFinData.analyse,
  sante_financiere: planFinData.sante_financiere,
  indicateurs_decision: planFinData.indicateurs_decision,
  hypotheses: planFinData.hypotheses,
  projections: planFinData.projections?.slice(0, 3),
}, null, 1).slice(0, 10000)}

═══ INPUTS DATA (résumé) ═══
${JSON.stringify({
  compte_resultat: inputsData.compte_resultat,
  bilan: inputsData.bilan,
  effectif: inputsData.effectif,
  salaire_dirigeant: inputsData.salaire_dirigeant,
  score_confiance: inputsData.score_confiance,
}, null, 1).slice(0, 5000)}

═══ ANALYSE ODD ═══
${JSON.stringify({
  odd_principaux: oddData.odd_principaux,
  synthese: oddData.synthese,
  score: oddData.score,
  evaluation_cibles_odd: oddData.evaluation_cibles_odd?.slice(0, 5),
}, null, 1).slice(0, 5000)}

═══ PRE-SCREENING ═══
${JSON.stringify({
  synthese: preScreening.synthese_executive,
  risques: preScreening.risques,
  score: preScreening.pre_screening_score,
}, null, 1).slice(0, 3000)}

═══ DIAGNOSTIC ═══
${JSON.stringify({
  synthese: diagnosticData.synthese_executive,
  alertes: diagnosticData.alertes,
  score: diagnosticData.score_global,
}, null, 1).slice(0, 3000)}

═══ DOCUMENTS UPLOADÉS ═══
${agentDocs.slice(0, 5000)}

═══ NOTES DE COACHING ═══
${coachingContext.slice(0, 3000)}

${buildOvoRedFlagsPromptContext()}
${buildOvoCompliancePromptContext()}

Génère le Compliance Feedback Report au format JSON avec cette structure exacte :
{
  "enterprise_name": "...",
  "report_date": "YYYY-MM-DD",
  "sections": {
    "project_description": {
      "observations_cles": ["..."],
      "a_clarifier": ["..."],
      "recommandations": ["..."]
    },
    "financial_documentation": { ... même structure ... },
    "legal_documentation": { ... },
    "intellectual_property": { ... },
    "social_environmental": { ... },
    "hr": { ... },
    "insurance": { ... }
  },
  "red_flags": [
    { "id": "one_man_show", "severity": "critical", "details": "..." }
  ],
  "conclusion": {
    "verdict": "prêt | presque_prêt | non_prêt",
    "summary": "...",
    "actions_prioritaires": ["1. ...", "2. ...", "3. ..."]
  },
  "score_compliance": 65
}`;

    const rawData = await callAI(
      injectGuardrails(SYSTEM_PROMPT, ent.country),
      userPrompt,
      16384,
      "claude-sonnet-4-20250514",
      0.2,
      { functionName: "generate-compliance-report", enterpriseId: enterprise_id }
    );

    // Save as deliverable
    const data = {
      ...rawData,
      _metadata: {
        generated_by: "compliance_officer",
        generated_at: new Date().toISOString(),
        enterprise_name: ent.name,
        enterprise_country: ent.country,
        enterprise_sector: ent.sector,
      },
    };

    await saveDeliverable(supabase, enterprise_id, "compliance_report" as any, data, "compliance");

    // Activity log
    await supabase.from("activity_log").insert({
      enterprise_id,
      organization_id: ctx.organization_id || null,
      actor_id: ctx.user.id,
      actor_role: orgRole || "manager",
      action: "generate",
      resource_type: "deliverable",
      deliverable_type: "compliance_report",
      metadata: { score_compliance: rawData.score_compliance },
    });

    return jsonResponse({
      success: true,
      data,
      score: rawData.score_compliance,
      verdict: rawData.conclusion?.verdict,
    });

  } catch (err: any) {
    console.error("[generate-compliance-report] Error:", err);
    return errorResponse(err.message || "Erreur interne", err.status || 500);
  }
});
