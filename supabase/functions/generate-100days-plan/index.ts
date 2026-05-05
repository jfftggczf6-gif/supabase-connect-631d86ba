// generate-100days-plan
// ----------------------------------------------------------------------------
// À l'entrée d'un deal en stage 'closing' ou 'portfolio', extrait les actions
// du plan 100 jours à partir de la section "support_requested" (Accompagnement /
// Value creation) du memo IC finale, et crée des entrées pe_action_plans.
//
// Idempotent : skip si plan déjà généré pour ce deal (sauf force=true).
// ----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { fetchSections, getLatestVersion } from "../_shared/memo-helpers.ts";

interface RequestBody {
  deal_id: string;
  force?: boolean;
}

const ACTION_CATEGORIES = [
  'recrutement', 'gouvernance', 'reporting', 'quick_win',
  'compliance', 'finance', 'commercial', 'operationnel', 'autre',
];

const EXTRACT_SCHEMA = `{
  "actions": [
    {
      "label": "<string court — verbe à l'infinitif. Ex: 'Recruter un DAF'>",
      "description": "<string optionnel — détail si nécessaire>",
      "category": "<recrutement|gouvernance|reporting|quick_win|compliance|finance|commercial|operationnel|autre>",
      "priority": <int 1-10, 1=haute>,
      "due_days_from_closing": <int — délai en jours depuis le closing, ex 30 90 180>,
      "memo_section_code": "<code section qui mentionne cette action>"
    }
  ]
}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // 1) Charger le deal
    const { data: deal } = await adminClient
      .from("pe_deals")
      .select("id, organization_id, deal_ref, stage, enterprises(name, country, sector)")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal introuvable", 404);

    // 2) Idempotence : si déjà des actions et !force → skip
    if (!body.force) {
      const { count: existing } = await adminClient
        .from("pe_action_plans")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", deal.id)
        .eq("source", "memo_extracted");
      if ((existing ?? 0) > 0) {
        return jsonResponse({
          success: true,
          skipped: true,
          reason: "Plan 100 jours déjà généré (passe force=true pour régénérer)",
          existing_count: existing,
        });
      }
    }

    // 3) Charger memo IC finale (ou IC1 si IC finale absent)
    const finalVersion =
      await getLatestVersion(adminClient, deal.id, "note_ic_finale", "ready") ??
      await getLatestVersion(adminClient, deal.id, "note_ic_finale", "validated") ??
      await getLatestVersion(adminClient, deal.id, "note_ic1", "ready") ??
      await getLatestVersion(adminClient, deal.id, "note_ic1", "validated");

    if (!finalVersion) {
      return errorResponse("Aucune version de memo IC1/IC finale ready disponible", 400);
    }

    const sections = await fetchSections(adminClient, finalVersion.id);
    const supportRequested = sections.find((s: any) => s.section_code === 'support_requested');
    const investmentThesis = sections.find((s: any) => s.section_code === 'investment_thesis');

    const memoBlock = [
      supportRequested
        ? `### SUPPORT REQUESTED (accompagnement)\n${supportRequested.content_md ?? ''}\n${supportRequested.content_json ? JSON.stringify(supportRequested.content_json, null, 2).slice(0, 5000) : ''}`
        : '',
      investmentThesis
        ? `### INVESTMENT THESIS (créateurs de valeur identifiés)\n${investmentThesis.content_md ?? ''}\n${investmentThesis.content_json ? JSON.stringify(investmentThesis.content_json, null, 2).slice(0, 3000) : ''}`
        : '',
    ].filter(Boolean).join('\n\n');

    if (!memoBlock.trim()) {
      return errorResponse("Sections support_requested et investment_thesis absentes du memo", 400);
    }

    const ent = (deal as any).enterprises;
    const taskPrompt = `Tu es un Investment Manager dans un fonds de Private Equity en Afrique. Tu prépares le plan d'exécution 100 jours pour la cible "${ent?.name}" (${ent?.sector}, ${ent?.country}, deal ${deal.deal_ref}) qui vient d'être validée pour closing.

À partir du memo IC ci-dessous, extrais les actions concrètes à exécuter dans les 100 premiers jours après closing pour activer la création de valeur.

═══ MEMO IC ═══
${memoBlock.slice(0, 30000)}

═══ FORMAT DE SORTIE — JSON STRICT, RIEN D'AUTRE ═══
${EXTRACT_SCHEMA}

═══ RÈGLES ═══
1. 5 à 12 actions concrètes. Pas plus, pas moins.
2. Chaque action commence par un verbe à l'infinitif (Recruter, Mettre en place, Formaliser, Auditer…).
3. Réparties par catégorie : majoritairement recrutement / gouvernance / reporting / quick_win.
4. due_days_from_closing : 30 pour quick wins, 60-90 pour recrutements et gouvernance, 100 max.
5. Priority : 1-3 = critiques (gouvernance, recrutements clés), 4-7 = importantes, 8-10 = nice-to-have.
6. memo_section_code : utilise les codes valides (executive_summary, support_requested, investment_thesis, top_management, esg_risks, etc.)
7. JSON strict. Pas de markdown fences.`;

    const aiResponse = await callAI(
      taskPrompt,
      `Génère maintenant le plan 100 jours pour ${ent?.name}.`,
      4000,
      undefined,
      0.2,
      { functionName: "generate-100days-plan", enterpriseId: (deal as any).enterprise_id ?? undefined },
    );

    let parsed: any;
    try {
      const cleaned = aiResponse.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e: any) {
      console.error("[generate-100days-plan] JSON parse error:", e.message, aiResponse.slice(0, 500));
      return errorResponse(`Synthèse IA non parsable : ${e.message}`, 500);
    }

    if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      return errorResponse("L'IA n'a pas extrait d'actions", 500);
    }

    // 4) Insert dans pe_action_plans (avec calcul des due_date depuis aujourd'hui)
    const today = new Date();
    const rows = parsed.actions.map((a: any, i: number) => {
      const days = Number(a.due_days_from_closing ?? 90);
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + days);
      const category = ACTION_CATEGORIES.includes(a.category) ? a.category : 'autre';
      return {
        deal_id: deal.id,
        organization_id: deal.organization_id,
        action_label: String(a.label).slice(0, 200),
        description: a.description ? String(a.description).slice(0, 1000) : null,
        category,
        priority: Math.max(1, Math.min(10, Number(a.priority ?? 5))),
        due_date: dueDate.toISOString().slice(0, 10),
        status: 'todo',
        source: 'memo_extracted',
        memo_section_code: a.memo_section_code ?? null,
      };
    });

    const { data: inserted, error: insertErr } = await adminClient
      .from("pe_action_plans")
      .insert(rows)
      .select();

    if (insertErr) {
      return errorResponse(`Insert pe_action_plans échoué : ${insertErr.message}`, 500);
    }

    return jsonResponse({
      success: true,
      actions_created: inserted?.length ?? 0,
      actions: inserted,
    });

  } catch (e: any) {
    console.error("[generate-100days-plan] error:", e);
    return errorResponse(e.message || "Erreur interne", 500);
  }
});
