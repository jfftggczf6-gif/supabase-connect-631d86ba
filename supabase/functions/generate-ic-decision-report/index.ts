// generate-ic-decision-report — Auto-generate Investment Committee Decision Report
// Synthesis of compliance + financial + impact for IC decision
// Visible only in programme manager space
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable,
  jsonResponse, errorResponse
} from "../_shared/helpers_v5.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { buildOvoRedFlagsPromptContext, buildOvoImpactPromptContext } from "../_shared/ovo-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un analyste senior préparant un Investment Committee Decision Report pour OVO (Ondernemers voor Ondernemers).

Ce rapport est la synthèse finale présentée au Comité d'Investissement pour décision de prêt.

STRUCTURE DU RAPPORT :
1. **resume_executif** — Résumé en 3-4 phrases du projet et de la recommandation
2. **entreprise** — Nom, secteur, pays, date création, effectif, CA actuel
3. **projet_investissement** — Description de l'investissement demandé, montant, utilisation prévue
4. **analyse_financiere** — Résumé du plan financier : CA, marge, EBITDA, rentabilité, capacité de remboursement (DSCR), VAN, TRI
5. **analyse_risques** — Risques identifiés classés par sévérité, avec mesures d'atténuation
6. **compliance_status** — Résumé du compliance report : points conformes, points à clarifier, bloquants
7. **impact_odd** — Contribution aux ODD, indicateurs clés, score impact
8. **recommandation_ic** — Verdict recommandé : APPROUVER / APPROUVER SOUS CONDITIONS / REPORTER / REJETER
9. **conditions** — Si approuvé sous conditions, liste des conditions à remplir
10. **vote_suggere** — Résumé pour faciliter le vote du comité

RÈGLES :
- Sois concis et factuel — le IC n'a pas le temps de lire 10 pages
- Mets en avant les red flags critiques
- La recommandation doit être claire et justifiée
- Retourne UNIQUEMENT du JSON valide`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { enterprise_id } = body;
    if (!enterprise_id) return errorResponse("enterprise_id requis", 400);

    const ctx = await verifyAndGetContext(req, body);
    const { supabase, enterprise: ent } = ctx;

    // Check role — only managers, owners, admins, super_admins
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", ctx.user.id)
      .eq("organization_id", ctx.organization_id || "")
      .eq("is_active", true)
      .maybeSingle();

    const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", ctx.user.id);
    const isSA = (userRoles || []).some((r: any) => r.role === "super_admin");
    const orgRole = orgMember?.role;
    if (!isSA && !["owner", "admin", "manager"].includes(orgRole || "")) {
      return errorResponse("Accès réservé aux managers et super_admins", 403);
    }

    // Fetch all deliverables
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", enterprise_id);

    const delivMap: Record<string, any> = {};
    (deliverables || []).forEach((d: any) => { delivMap[d.type] = d.data; });

    const complianceData = delivMap.compliance_report || {};
    const planFinData = delivMap.plan_financier || {};
    const oddData = delivMap.odd_analysis || {};
    const bpData = delivMap.business_plan || {};
    const valuationData = delivMap.valuation || {};
    const preScreening = delivMap.pre_screening || {};

    const userPrompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "N/A"}
PAYS : ${ent.country || "N/A"}
SCORE IR : ${ent.score_ir || "N/A"}

═══ COMPLIANCE REPORT ═══
${JSON.stringify(complianceData, null, 1).slice(0, 8000)}

═══ PLAN FINANCIER (résumé) ═══
${JSON.stringify({
  kpis: planFinData.kpis,
  analyse: planFinData.analyse,
  sante_financiere: planFinData.sante_financiere,
  indicateurs_decision: planFinData.indicateurs_decision,
}, null, 1).slice(0, 6000)}

═══ VALORISATION ═══
${JSON.stringify({
  synthese: valuationData.synthese,
  methodes: valuationData.methodes,
  score: valuationData.score,
}, null, 1).slice(0, 3000)}

═══ ODD ═══
${JSON.stringify({
  odd_principaux: oddData.odd_principaux,
  synthese: oddData.synthese,
  score: oddData.score,
}, null, 1).slice(0, 3000)}

═══ PRE-SCREENING ═══
Score: ${preScreening.pre_screening_score || "N/A"}
${preScreening.synthese_executive || ""}

${buildOvoRedFlagsPromptContext()}
${buildOvoImpactPromptContext()}

Génère le IC Decision Report au format JSON :
{
  "enterprise_name": "...",
  "report_date": "YYYY-MM-DD",
  "resume_executif": "...",
  "entreprise": { "nom": "...", "secteur": "...", "pays": "...", "date_creation": "...", "effectif": 0, "ca_actuel": 0 },
  "projet_investissement": { "description": "...", "montant_demande": 0, "devise": "EUR", "utilisation": ["..."] },
  "analyse_financiere": { "ca": 0, "marge_brute_pct": 0, "ebitda": 0, "resultat_net": 0, "dscr": 0, "van": 0, "tri": 0, "payback": 0, "commentaire": "..." },
  "analyse_risques": [{ "risque": "...", "severite": "critique|haute|moyenne|faible", "mitigation": "..." }],
  "compliance_status": { "score": 0, "conforme": ["..."], "a_clarifier": ["..."], "bloquants": ["..."] },
  "impact_odd": { "odd_principaux": ["..."], "score_impact": 0, "indicateurs_cles": ["..."] },
  "recommandation_ic": "APPROUVER | APPROUVER_SOUS_CONDITIONS | REPORTER | REJETER",
  "conditions": ["..."],
  "vote_suggere": "..."
}`;

    const rawData = await callAI(
      injectGuardrails(SYSTEM_PROMPT, ent.country),
      userPrompt,
      8192,
      "claude-sonnet-4-20250514",
      0.2,
      { functionName: "generate-ic-decision-report", enterpriseId: enterprise_id }
    );

    const data = {
      ...rawData,
      _metadata: {
        generated_by: "compliance_officer",
        generated_at: new Date().toISOString(),
        enterprise_name: ent.name,
        requires_compliance_report: !complianceData?.sections,
      },
    };

    await saveDeliverable(supabase, enterprise_id, "ic_decision_report" as any, data, "ic_decision");

    // Activity log
    await supabase.from("activity_log").insert({
      enterprise_id,
      organization_id: ctx.organization_id || null,
      actor_id: ctx.user.id,
      actor_role: orgRole || "manager",
      action: "generate",
      resource_type: "deliverable",
      deliverable_type: "ic_decision_report",
      metadata: { recommandation: rawData.recommandation_ic },
    });

    return jsonResponse({
      success: true,
      data,
      recommandation: rawData.recommandation_ic,
    });

  } catch (err: any) {
    console.error("[generate-ic-decision-report] Error:", err);
    return errorResponse(err.message || "Erreur interne", err.status || 500);
  }
});
