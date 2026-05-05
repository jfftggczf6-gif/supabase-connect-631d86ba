// generate-lp-report
// ----------------------------------------------------------------------------
// Génère un rapport périodique pour les LPs du fonds.
//
// 2 formats :
//   - 'participation' : fiche pour 1 deal (KPIs + NAV + IRR/MOIC + faits + risques)
//     → input : deal_id + period
//   - 'portfolio' : agrégat fonds (NAV totale, IRR net, TVPI, DPI, perf secteur/pays)
//     → input : organization_id + period
//
// Pipeline :
//   1. Charge les données (deal+memo+monitoring+valuation, ou agrégation portfolio)
//   2. Synthèse Claude pour rédiger les "faits marquants" et "risques" en ton LP
//   3. Insert pe_lp_reports (status draft) avec data JSONB structuré
//   4. Caller peut ensuite appeler render-document pour générer PDF/PPTX
// ----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";

interface RequestBody {
  format: 'participation' | 'portfolio';
  period: string;
  period_start: string;
  period_end: string;
  deal_id?: string;            // requis si format=participation
  organization_id?: string;    // requis si format=portfolio
}

const PARTICIPATION_NARRATIVE_SCHEMA = `{
  "executive_summary": "<string 3-5 phrases — synthèse de la période, ton sobre LP>",
  "faits_marquants": ["<string court>", "..."],
  "risques": [
    { "title": "<string>", "severity": "<faible|moyen|élevé>", "description": "<string>", "mitigation": "<string optionnel>" }
  ],
  "actions_prises": ["<string>", "..."],
  "perspectives": "<string 2-3 phrases — vue prospective>"
}`;

const PORTFOLIO_NARRATIVE_SCHEMA = `{
  "executive_summary": "<string 3-5 phrases — synthèse globale du portefeuille>",
  "highlights": ["<string court>", "..."],
  "top_performers": [
    { "deal_ref": "<string>", "raison": "<string>" }
  ],
  "underperformers": [
    { "deal_ref": "<string>", "raison": "<string>", "actions": "<string>" }
  ],
  "pipeline_sorties": "<string 1-2 phrases — sorties prévues>",
  "perspectives": "<string 2-3 phrases>"
}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    if (!body.format || !['participation', 'portfolio'].includes(body.format)) {
      return errorResponse("format must be 'participation' or 'portfolio'", 400);
    }
    if (!body.period || !body.period_start || !body.period_end) {
      return errorResponse("period, period_start, period_end required", 400);
    }

    if (body.format === 'participation') {
      return await generateParticipation(adminClient, body);
    } else {
      return await generatePortfolio(adminClient, body);
    }

  } catch (e: any) {
    console.error("[generate-lp-report] error:", e);
    return errorResponse(e.message || "Erreur interne", 500);
  }
});

async function generateParticipation(adminClient: any, body: RequestBody) {
  if (!body.deal_id) return errorResponse("deal_id required for participation format", 400);

  // 1) Charge deal + entreprise
  const { data: deal } = await adminClient
    .from("pe_deals")
    .select(`
      id, organization_id, deal_ref, stage, ticket_demande, currency,
      enterprise_id, enterprises(name, sector, country)
    `)
    .eq("id", body.deal_id)
    .maybeSingle();
  if (!deal) return errorResponse("Deal introuvable", 404);

  const ent = (deal as any).enterprises;

  // 2) Charge dernière valuation périodique (NAV)
  const { data: lastValuation } = await adminClient
    .from("pe_periodic_valuations")
    .select("*")
    .eq("deal_id", deal.id)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3) Charge dernier rapport trimestriel (KPIs récents)
  const { data: lastReport } = await adminClient
    .from("pe_quarterly_reports")
    .select("*")
    .eq("deal_id", deal.id)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4) Charge dernier score
  const { data: lastScore } = await adminClient
    .from("pe_score_history")
    .select("*")
    .eq("deal_id", deal.id)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5) Alertes ouvertes
  const { data: openAlerts } = await adminClient
    .from("pe_alert_signals")
    .select("title, severity, message")
    .eq("deal_id", deal.id)
    .is("resolved_at", null)
    .order("severity")
    .limit(10);

  // 6) Term sheet pour ticket initial
  const { data: termSheet } = await adminClient
    .from("pe_term_sheets")
    .select("total_amount, devise, equity_stake_pct, post_money_valuation, signed_at")
    .eq("deal_id", deal.id)
    .maybeSingle();

  // 7) Synthèse Claude — narrative LP
  const ctx = await buildAgentContext(adminClient, deal.organization_id, {
    deliverableType: 'investment_memo',
    country: ent?.country ?? null,
    sector: ent?.sector ?? null,
    enterpriseId: deal.enterprise_id,
  });

  const taskPrompt = `Tu rédiges la partie narrative d'un rapport LP (Limited Partner) pour la participation "${ent?.name}" sur la période ${body.period} (${body.period_start} → ${body.period_end}).

═══ CONTEXTE PARTICIPATION ═══
Cible : ${ent?.name} (${ent?.sector}, ${ent?.country})
Deal ref : ${deal.deal_ref}
Stage : ${deal.stage}
${termSheet ? `Investissement : ${termSheet.total_amount} ${termSheet.devise} pour ${termSheet.equity_stake_pct}% en ${termSheet.signed_at}` : ''}

═══ DERNIÈRE VALORISATION (NAV) ═══
${lastValuation ? JSON.stringify(lastValuation, null, 2).slice(0, 2000) : '(pas encore de valuation périodique)'}

═══ DERNIER RAPPORT TRIMESTRIEL ═══
${lastReport ? `Période : ${lastReport.period}\nPnL : ${JSON.stringify(lastReport.pnl_data)}\nKPI : ${JSON.stringify(lastReport.kpi_data)}\nNarratif : ${lastReport.narrative ?? ''}` : '(pas de rapport)'}

═══ DERNIER SCORE 6 DIM ═══
${lastScore ? `Total : ${lastScore.score_total}/100 (delta entrée : ${lastScore.delta_vs_entry > 0 ? '+' : ''}${lastScore.delta_vs_entry})` : '(pas de scoring)'}

═══ ALERTES OUVERTES (${openAlerts?.length ?? 0}) ═══
${(openAlerts ?? []).map((a: any) => `[${a.severity}] ${a.title} : ${a.message}`).join('\n')}

═══ FORMAT JSON STRICT ═══
${PARTICIPATION_NARRATIVE_SCHEMA}

═══ TON ═══
Sobre, factuel, professionnel. Style "investor relations" pour LP institutionnels (banques, family offices). Pas d'enthousiasme excessif. Soulève les risques honnêtement. JSON strict, pas de markdown fences.`;

  const aiText = await callAI(ctx.composeSystemPrompt(taskPrompt),
    `Rédige la narrative LP pour ${ent?.name} période ${body.period}.`,
    4000, undefined, 0.3,
    { functionName: "generate-lp-report:participation", enterpriseId: deal.enterprise_id });

  let narrative: any;
  try {
    narrative = JSON.parse(aiText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
  } catch (e: any) {
    console.error("[generate-lp-report] parse error:", e.message, aiText.slice(0, 500));
    return errorResponse(`Synthèse IA non parsable : ${e.message}`, 500);
  }

  // 8) Build le data JSONB final
  const reportData = {
    deal: {
      ref: deal.deal_ref,
      name: ent?.name,
      sector: ent?.sector,
      country: ent?.country,
      stage: deal.stage,
    },
    investment: termSheet ? {
      ticket: termSheet.total_amount,
      devise: termSheet.devise,
      equity_stake_pct: termSheet.equity_stake_pct,
      signed_at: termSheet.signed_at,
      post_money_at_entry: termSheet.post_money_valuation,
    } : null,
    valuation_current: lastValuation,
    moic_to_date: lastValuation?.moic_to_date ?? null,
    irr_to_date: lastValuation?.irr_to_date ?? null,
    nav_amount: lastValuation?.nav_amount ?? null,
    last_quarterly: lastReport,
    last_score: lastScore,
    open_alerts_count: openAlerts?.length ?? 0,
    narrative,
  };

  // 9) Insert pe_lp_reports
  const { data: { user } } = await adminClient.auth.admin.listUsers();
  const { data: report, error: insertErr } = await adminClient
    .from("pe_lp_reports")
    .insert({
      organization_id: deal.organization_id,
      deal_id: deal.id,
      format: 'participation',
      period: body.period,
      period_start: body.period_start,
      period_end: body.period_end,
      status: 'draft',
      data: reportData,
    })
    .select()
    .single();
  if (insertErr) return errorResponse(`Insert échoué : ${insertErr.message}`, 500);

  return jsonResponse({ success: true, report });
}

async function generatePortfolio(adminClient: any, body: RequestBody) {
  if (!body.organization_id) return errorResponse("organization_id required for portfolio format", 400);

  // 1) Liste tous les deals en portfolio + closing (deals actifs)
  const { data: deals } = await adminClient
    .from("pe_deals")
    .select(`
      id, deal_ref, stage, currency, ticket_demande,
      enterprises(name, sector, country)
    `)
    .eq("organization_id", body.organization_id)
    .in("stage", ['closing', 'portfolio']);

  if (!deals || deals.length === 0) {
    return errorResponse("Aucun deal en portfolio", 400);
  }

  const dealIds = deals.map((d: any) => d.id);

  // 2) Dernières valorisations
  const { data: valuations } = await adminClient
    .from("pe_periodic_valuations")
    .select("*")
    .in("deal_id", dealIds)
    .order("period_end", { ascending: false });

  // Dedup : 1 valuation la plus récente par deal
  const valByDeal: Record<string, any> = {};
  (valuations ?? []).forEach((v: any) => {
    if (!valByDeal[v.deal_id]) valByDeal[v.deal_id] = v;
  });

  // 3) Term sheets pour le coût total investi
  const { data: termSheets } = await adminClient
    .from("pe_term_sheets")
    .select("deal_id, total_amount, devise")
    .in("deal_id", dealIds);
  const tsByDeal: Record<string, any> = {};
  (termSheets ?? []).forEach((t: any) => { tsByDeal[t.deal_id] = t; });

  // 4) Derniers scores
  const { data: scores } = await adminClient
    .from("pe_score_history")
    .select("*")
    .in("deal_id", dealIds)
    .order("period_end", { ascending: false });
  const scoreByDeal: Record<string, any> = {};
  (scores ?? []).forEach((s: any) => {
    if (!scoreByDeal[s.deal_id]) scoreByDeal[s.deal_id] = s;
  });

  // 5) Alertes critiques ouvertes
  const { count: critAlertsCount } = await adminClient
    .from("pe_alert_signals")
    .select("id", { count: 'exact', head: true })
    .in("deal_id", dealIds)
    .eq("severity", "critical")
    .is("resolved_at", null);

  // 6) Agrégats fonds
  let totalInvested = 0;
  let totalNav = 0;
  const moics: number[] = [];
  const irrs: number[] = [];

  const participations = deals.map((d: any) => {
    const ts = tsByDeal[d.id];
    const v = valByDeal[d.id];
    const score = scoreByDeal[d.id];
    if (ts?.total_amount) totalInvested += Number(ts.total_amount);
    if (v?.nav_amount) totalNav += Number(v.nav_amount);
    if (typeof v?.moic_to_date === 'number') moics.push(v.moic_to_date);
    if (typeof v?.irr_to_date === 'number') irrs.push(v.irr_to_date);
    return {
      deal_ref: d.deal_ref,
      name: (d as any).enterprises?.name,
      sector: (d as any).enterprises?.sector,
      country: (d as any).enterprises?.country,
      ticket: ts?.total_amount,
      nav: v?.nav_amount,
      moic: v?.moic_to_date,
      irr: v?.irr_to_date,
      score: score?.score_total,
      delta_score: score?.delta_vs_entry,
    };
  });

  const avgMoic = moics.length ? moics.reduce((a, b) => a + b, 0) / moics.length : null;
  const avgIrr = irrs.length ? irrs.reduce((a, b) => a + b, 0) / irrs.length : null;
  const tvpi = totalInvested > 0 ? totalNav / totalInvested : null;

  // 7) Synthèse Claude — narrative portfolio
  const ctx = await buildAgentContext(adminClient, body.organization_id, {
    deliverableType: 'investment_memo',
    country: null,
    sector: null,
    enterpriseId: null,
  });

  const taskPrompt = `Tu rédiges la narrative d'un rapport LP portfolio agrégé pour le fonds sur la période ${body.period} (${body.period_start} → ${body.period_end}).

═══ AGRÉGAT FONDS ═══
Nombre de participations actives : ${deals.length}
Total investi (cumulé) : ${totalInvested.toLocaleString()}
NAV totale actuelle : ${totalNav.toLocaleString()}
TVPI (Total Value to Paid-In) : ${tvpi?.toFixed(2) ?? 'n/d'}
MOIC moyen : ${avgMoic?.toFixed(2) ?? 'n/d'}
IRR moyen : ${avgIrr ? (avgIrr * 100).toFixed(1) + '%' : 'n/d'}
Alertes critiques ouvertes : ${critAlertsCount ?? 0}

═══ PARTICIPATIONS ═══
${participations.map(p => `- ${p.deal_ref} (${p.name}, ${p.sector}, ${p.country}) — Ticket ${p.ticket?.toLocaleString() ?? 'n/d'} · NAV ${p.nav?.toLocaleString() ?? 'n/d'} · MOIC ${p.moic ?? 'n/d'} · Score ${p.score ?? 'n/d'}/100 (delta entrée ${p.delta_score ?? 0})`).join('\n')}

═══ FORMAT JSON STRICT ═══
${PORTFOLIO_NARRATIVE_SCHEMA}

═══ TON ═══
Sobre, professionnel, ton "GP→LP". Identifie 2-3 top performers et 1-2 underperformers (sans masquer les difficultés). JSON strict.`;

  const aiText = await callAI(ctx.composeSystemPrompt(taskPrompt),
    `Rédige la narrative portfolio pour ${body.period}.`,
    4000, undefined, 0.3,
    { functionName: "generate-lp-report:portfolio" });

  let narrative: any;
  try {
    narrative = JSON.parse(aiText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
  } catch (e: any) {
    return errorResponse(`Synthèse IA non parsable : ${e.message}`, 500);
  }

  // 8) Build data + insert
  const reportData = {
    metrics: {
      participations_count: deals.length,
      total_invested: totalInvested,
      total_nav: totalNav,
      tvpi,
      avg_moic: avgMoic,
      avg_irr: avgIrr,
      critical_alerts_count: critAlertsCount ?? 0,
    },
    participations,
    narrative,
  };

  const { data: report, error: insertErr } = await adminClient
    .from("pe_lp_reports")
    .insert({
      organization_id: body.organization_id,
      deal_id: null,
      format: 'portfolio',
      period: body.period,
      period_start: body.period_start,
      period_end: body.period_end,
      status: 'draft',
      data: reportData,
    })
    .select()
    .single();
  if (insertErr) return errorResponse(`Insert échoué : ${insertErr.message}`, 500);

  return jsonResponse({ success: true, report });
}
