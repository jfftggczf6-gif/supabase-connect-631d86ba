// analyze-quarterly-data
// ----------------------------------------------------------------------------
// Pipeline d'analyse d'un rapport trimestriel reçu :
//   1. Charge le rapport (pe_quarterly_reports)
//   2. Compare aux projections du memo IC finale (sections financials_pnl + investment_thesis)
//   3. Recalcule scoring 6 dimensions (financier, marché, mgmt, gouvernance, modèle, ESG)
//   4. Insert pe_score_history avec deltas vs N-1 et entrée
//   5. Génère pe_alert_signals si seuils breached (CA < 80% projection, EBITDA en chute, etc.)
//
// Idempotent : si déjà analysé pour cette période, skip sauf force=true.
// ----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { fetchSections, getLatestVersion } from "../_shared/memo-helpers.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";

interface RequestBody {
  quarterly_report_id: string;
  force?: boolean;
}

const ANALYSIS_SCHEMA = `{
  "scoring": {
    "score_total": <int 0-100>,
    "score_financier": <int 0-100>,
    "score_marche": <int 0-100>,
    "score_management": <int 0-100>,
    "score_gouvernance": <int 0-100>,
    "score_modele": <int 0-100>,
    "score_esg": <int 0-100>,
    "drivers": "<string court — qu'est-ce qui a changé vs trimestre précédent>"
  },
  "alerts": [
    {
      "severity": "<info|warning|critical>",
      "category": "<financier|operationnel|commercial|rh|gouvernance|esg|compliance|autre>",
      "title": "<string court>",
      "message": "<string explicatif>",
      "threshold_label": "<string ex: 'EBITDA < 80% projection'>",
      "actual_value": <number ou null>,
      "expected_value": <number ou null>,
      "delta_pct": <number ou null>
    }
  ],
  "narrative_synthesis": "<string 2-4 phrases — résumé de la situation>"
}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    if (!body.quarterly_report_id) return errorResponse("quarterly_report_id required", 400);

    // 1) Charger rapport
    const { data: qr } = await adminClient
      .from("pe_quarterly_reports")
      .select(`
        id, deal_id, organization_id, period, period_start, period_end,
        pnl_data, bilan_data, kpi_data, narrative
      `)
      .eq("id", body.quarterly_report_id)
      .maybeSingle();
    if (!qr) return errorResponse("Rapport trimestriel introuvable", 404);

    // 2) Idempotence : si déjà un score pour cette période, skip sauf force
    if (!body.force) {
      const { data: existing } = await adminClient
        .from("pe_score_history")
        .select("id")
        .eq("deal_id", qr.deal_id)
        .eq("period", qr.period)
        .maybeSingle();
      if (existing) {
        return jsonResponse({
          success: true,
          skipped: true,
          reason: "Analyse déjà faite pour cette période (passe force=true pour régénérer)",
          score_id: existing.id,
        });
      }
    }

    // 3) Charger deal + entreprise (pour pays/secteur dans le contexte agent)
    const { data: deal } = await adminClient
      .from("pe_deals")
      .select("id, organization_id, deal_ref, enterprise_id, enterprises(name, country, sector)")
      .eq("id", qr.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal introuvable", 404);
    const ent = (deal as any).enterprises;

    // 4) Charger memo IC finale (pour comparer aux projections)
    const finalVersion =
      await getLatestVersion(adminClient, qr.deal_id, "note_ic_finale", "ready") ??
      await getLatestVersion(adminClient, qr.deal_id, "note_ic_finale", "validated") ??
      await getLatestVersion(adminClient, qr.deal_id, "note_ic1", "ready");

    let memoBlock = '';
    if (finalVersion) {
      const sections = await fetchSections(adminClient, finalVersion.id);
      const wanted = ['executive_summary', 'financials_pnl', 'unit_economics', 'investment_thesis', 'esg_risks'];
      memoBlock = sections
        .filter((s: any) => wanted.includes(s.section_code))
        .map((s: any) => `### ${s.section_code}\n${s.content_md ?? ''}\n${s.content_json ? JSON.stringify(s.content_json, null, 2).slice(0, 3000) : ''}`)
        .join('\n\n');
    }

    // 5) Charger derniers scores pour deltas
    const { data: previousScore } = await adminClient
      .from("pe_score_history")
      .select("*")
      .eq("deal_id", qr.deal_id)
      .lt("period_end", qr.period_end)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: entryScore } = await adminClient
      .from("pe_score_history")
      .select("*")
      .eq("deal_id", qr.deal_id)
      .order("period_end", { ascending: true })
      .limit(1)
      .maybeSingle();

    // 6) Build agent context (tone PE + KB + benchmarks sectoriels du pays)
    const agentCtx = await buildAgentContext(adminClient, deal.organization_id, {
      deliverableType: 'investment_memo',
      country: ent?.country ?? null,
      sector: ent?.sector ?? null,
      enterpriseId: deal.enterprise_id ?? null,
    });

    const taskPrompt = `Tu es un Investment Manager qui analyse un rapport trimestriel d'une participation en portefeuille (3-7 ans post-closing). La cible est "${ent?.name}" (${ent?.sector}, ${ent?.country}, deal ${deal.deal_ref}).

═══ RAPPORT TRIMESTRIEL — Période ${qr.period} (${qr.period_start} → ${qr.period_end}) ═══
PnL :
${JSON.stringify(qr.pnl_data, null, 2)}

Bilan :
${JSON.stringify(qr.bilan_data, null, 2)}

KPIs :
${JSON.stringify(qr.kpi_data, null, 2)}

Commentaire dirigeant/IM :
${qr.narrative ?? '(pas de commentaire)'}

═══ MEMO IC (projections d'entrée) ═══
${memoBlock || '(memo non disponible)'}

═══ SCORES PRÉCÉDENTS ═══
${previousScore ? `Trimestre N-1 (${previousScore.period}) : ${previousScore.score_total}/100 (financier ${previousScore.score_financier}, marché ${previousScore.score_marche}, mgmt ${previousScore.score_management}, gouvernance ${previousScore.score_gouvernance}, modèle ${previousScore.score_modele}, ESG ${previousScore.score_esg})` : '(aucun trimestre précédent)'}
${entryScore ? `Score d'entrée (${entryScore.period}) : ${entryScore.score_total}/100` : ''}

═══ TA MISSION ═══
1. Recalcule le scoring 6 dimensions (0-100 chaque dimension + score_total moyen pondéré).
2. Identifie les signaux d'alerte (seuils breached vs projections du memo) :
   - CA réel < 80% projection annuelle prorata = warning
   - EBITDA en chute > 15% vs N-1 = warning
   - Marge brute en chute > 5pts vs N-1 = critical
   - Effectifs en chute brutale = warning
   - Concentration client aggravée = warning
   - DSO ou DPO dégradés = warning
   - Dette/EBITDA > 4x = critical
   - Tout point soulevé dans le narratif comme problème = au moins warning
3. Si tout va bien (proche ou au-dessus des projections) : aucune alerte, juste 1 alerte "info" pour confirmer.
4. Drivers : 1-2 phrases qui résument POURQUOI le score a évolué.

═══ FORMAT JSON STRICT ═══
${ANALYSIS_SCHEMA}

Pas de markdown fences. JSON strict.`;

    const systemPrompt = agentCtx.composeSystemPrompt(taskPrompt);
    const aiText = await callAI(
      systemPrompt,
      `Analyse maintenant le rapport ${qr.period} pour ${ent?.name}.`,
      6000,
      undefined,
      0.2,
      { functionName: "analyze-quarterly-data", enterpriseId: deal.enterprise_id ?? undefined },
    );

    let parsed: any;
    try {
      const cleaned = aiText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e: any) {
      console.error("[analyze-quarterly-data] JSON parse error:", e.message, aiText.slice(0, 500));
      return errorResponse(`Synthèse IA non parsable : ${e.message}`, 500);
    }

    const sc = parsed.scoring;
    if (!sc || typeof sc.score_total !== 'number') {
      return errorResponse("L'IA n'a pas produit un scoring valide", 500);
    }

    // 7) Insert score_history
    const deltaPrev = previousScore ? sc.score_total - previousScore.score_total : null;
    const deltaEntry = entryScore ? sc.score_total - entryScore.score_total : null;

    const { data: scoreInserted, error: scErr } = await adminClient
      .from("pe_score_history")
      .insert({
        deal_id: qr.deal_id,
        organization_id: qr.organization_id,
        period: qr.period,
        period_end: qr.period_end,
        score_total: sc.score_total,
        score_financier: sc.score_financier ?? null,
        score_marche: sc.score_marche ?? null,
        score_management: sc.score_management ?? null,
        score_gouvernance: sc.score_gouvernance ?? null,
        score_modele: sc.score_modele ?? null,
        score_esg: sc.score_esg ?? null,
        delta_vs_previous: deltaPrev,
        delta_vs_entry: deltaEntry,
        drivers: { narrative_synthesis: parsed.narrative_synthesis, drivers_text: sc.drivers },
      })
      .select()
      .single();

    if (scErr) console.warn("[analyze-quarterly-data] score insert failed:", scErr.message);

    // 8) Insert alerts
    const VALID_SEVERITIES = ['info', 'warning', 'critical'];
    const VALID_CATS = ['financier', 'operationnel', 'commercial', 'rh', 'gouvernance', 'esg', 'compliance', 'autre'];

    const alertsToInsert = (parsed.alerts ?? [])
      .filter((a: any) => a && a.title && a.message)
      .map((a: any) => ({
        deal_id: qr.deal_id,
        organization_id: qr.organization_id,
        quarterly_report_id: qr.id,
        period: qr.period,
        severity: VALID_SEVERITIES.includes(a.severity) ? a.severity : 'warning',
        category: VALID_CATS.includes(a.category) ? a.category : 'autre',
        title: String(a.title).slice(0, 200),
        message: String(a.message).slice(0, 1000),
        threshold_label: a.threshold_label ?? null,
        actual_value: typeof a.actual_value === 'number' ? a.actual_value : null,
        expected_value: typeof a.expected_value === 'number' ? a.expected_value : null,
        delta_pct: typeof a.delta_pct === 'number' ? a.delta_pct : null,
      }));

    let alertsInserted = 0;
    if (alertsToInsert.length > 0) {
      const { data: alIns } = await adminClient
        .from("pe_alert_signals")
        .insert(alertsToInsert)
        .select();
      alertsInserted = alIns?.length ?? 0;
    }

    return jsonResponse({
      success: true,
      score: scoreInserted,
      alerts_count: alertsInserted,
      narrative_synthesis: parsed.narrative_synthesis,
    });

  } catch (e: any) {
    console.error("[analyze-quarterly-data] error:", e);
    return errorResponse(e.message || "Erreur interne", 500);
  }
});
