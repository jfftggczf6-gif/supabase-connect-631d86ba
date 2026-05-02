// render-document — Proxy d'authentification + builder de payload pour le service esono-render.
//
// Flow :
//   1) Auth user (JWT)
//   2) Charge la donnée depuis Postgres (deal, memo, valuation, findings DD…)
//   3) Construit le payload formaté (chiffres formatés en M/Md FCFA, %, etc.)
//   4) POST → esono-render avec Bearer RENDER_API_KEY (shared secret)
//   5) Stream le fichier au client avec Content-Type approprié
//
// Secrets requis (Supabase → Functions → Secrets) :
//   RENDER_URL         : URL du service esono-render (local: http://host.docker.internal:3001)
//   RENDER_API_KEY     : shared secret avec le service esono-render

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "../_shared/helpers_v5.ts";
import { fetchSections, getLatestVersion } from "../_shared/memo-helpers.ts";

type RenderKind = 'memo_ic1' | 'valuation' | 'pre_screening' | 'dd_report';
type RenderFormat = 'docx' | 'pptx' | 'xlsx' | 'pdf';

interface RequestBody {
  deal_id: string;
  kind: RenderKind;
  format: RenderFormat;
}

// ─── Formatters partagés ────────────────────────────────────────────────────

function fmtMoney(v: number | null | undefined, currency = 'FCFA'): string {
  if (v == null || isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(2)} Md ${currency}`;
  if (abs >= 1) return `${Math.round(v)} M ${currency}`;
  if (abs >= 0.001) return `${Math.round(v * 1000)} K ${currency}`;
  return `${Math.round(v * 1_000_000)} ${currency}`;
}
function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || isNaN(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtX(v: number | null | undefined, digits = 1): string {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(digits)}x`;
}

// ─── Builder : memo_ic1 ─────────────────────────────────────────────────────

const SECTION_ORDER = [
  'executive_summary', 'shareholding_governance', 'top_management', 'services',
  'competition_market', 'unit_economics', 'financials_pnl', 'financials_balance',
  'investment_thesis', 'support_requested', 'esg_risks', 'annexes',
];

const STAGE_LABEL: Record<string, string> = {
  pre_screening: 'Pré-screening',
  note_ic1: 'IC1',
  note_ic_finale: 'IC finale',
  closing: 'Closing',
  portfolio: 'Portfolio',
};

async function buildMemoIc1Payload(supabase: any, dealId: string) {
  const { data: deal } = await supabase
    .from('pe_deals')
    .select('id, organization_id, deal_ref, stage, currency, ticket_demande, lead_analyst_id, enterprise_id, enterprises(legal_name, country)')
    .eq('id', dealId)
    .single();
  if (!deal) throw new Error('Deal introuvable');

  let leadName = '—';
  if (deal.lead_analyst_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', deal.lead_analyst_id)
      .maybeSingle();
    leadName = prof?.full_name ?? '—';
  }

  // Memo le plus avancé en status=ready
  const { data: memo } = await supabase
    .from('investment_memos')
    .select('id')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (!memo) throw new Error("Aucun memo IC pour ce deal");

  let version: any = null;
  for (const stage of ['note_ic_finale', 'note_ic1', 'pre_screening']) {
    version = await getLatestVersion(supabase, dealId, stage, 'ready');
    if (version) break;
  }
  if (!version) throw new Error("Aucune version de memo prête");

  const sections = await fetchSections(supabase, version.id);
  const byCode: Record<string, any> = {};
  for (const s of sections) byCode[s.section_code] = s;

  const sectionsPayload: Record<string, any> = {};
  for (const code of SECTION_ORDER) {
    const s = byCode[code];
    sectionsPayload[code] = {
      status_label: s?.status === 'validated' ? 'Validée' : s?.status === 'rejected' ? 'À retravailler' : 'Brouillon',
      score: s?.content_json?.section_score ?? '—',
      content_md: s?.content_md ?? '',
    };
  }

  // Findings DD intégrés au memo (applied_to_memo_at NOT NULL)
  const { data: findings } = await supabase
    .from('pe_dd_findings')
    .select('title, body, severity, finding_type, source_paragraph, source_page, source_doc_id')
    .eq('deal_id', dealId)
    .not('applied_to_memo_at', 'is', null)
    .order('severity');

  const finding_type_labels: Record<string, string> = {
    confirmation: 'Confirmation', adjustment: 'Ajustement', red_flag: 'Red flag', informative: 'Info',
  };
  const findings_applied = (findings ?? []).map((f: any) => ({
    title: f.title,
    body: f.body,
    severity: f.severity,
    finding_type_label: finding_type_labels[f.finding_type] ?? 'Info',
    source_paragraph: f.source_paragraph ?? '',
    source_filename: '', // resolved below
  }));

  // Resolve source_doc_id → filename
  const docIds = (findings ?? []).map((f: any) => f.source_doc_id).filter(Boolean);
  if (docIds.length) {
    const { data: docs } = await supabase.from('pe_deal_documents').select('id, filename').in('id', docIds);
    const docMap: Record<string, string> = {};
    (docs ?? []).forEach((d: any) => docMap[d.id] = d.filename);
    findings_applied.forEach((fa, i) => {
      const sdid = (findings ?? [])[i].source_doc_id;
      if (sdid && docMap[sdid]) fa.source_filename = docMap[sdid];
    });
  }

  // Valuation (light) pour la slide synthèse PPT
  const { data: val } = await supabase
    .from('pe_valuation')
    .select('synthesis, currency')
    .eq('deal_id', dealId)
    .maybeSingle();

  const currency = (val as any)?.currency ?? deal.currency ?? 'FCFA';
  const syn = (val as any)?.synthesis ?? {};
  const valuation = {
    pre_money_label: fmtMoney(syn.pre_money_recommended, currency),
    ticket_label: fmtMoney(syn.ticket_recommended, currency),
    weighted_ev_label: fmtMoney(syn.weighted_ev, currency),
    equity_stake_pct_label: syn.equity_stake_pct != null ? fmtPct(syn.equity_stake_pct, 1) : '—',
    exit_horizon_years: syn.exit_horizon_years ?? 5,
    weights: {
      dcf_pct: fmtPct(syn.weights?.dcf, 0),
      multiples_pct: fmtPct(syn.weights?.multiples, 0),
      ancc_pct: fmtPct(syn.weights?.ancc, 0),
    },
    range: {
      bear_label: fmtMoney(syn.range?.bear, currency),
      base_label: fmtMoney(syn.range?.base, currency),
      bull_label: fmtMoney(syn.range?.bull, currency),
    },
    moic: {
      bear_label: fmtX(syn.moic_bear), base_label: fmtX(syn.moic_base), bull_label: fmtX(syn.moic_bull),
    },
    irr: {
      bear_label: fmtPct(syn.irr_bear, 0), base_label: fmtPct(syn.irr_base, 0), bull_label: fmtPct(syn.irr_bull, 0),
    },
    justification: syn.justification ?? '',
  };

  return {
    payload: {
      generated_at: new Date().toISOString().slice(0, 10),
      deal: {
        deal_ref: deal.deal_ref,
        currency,
        ticket_demande: deal.ticket_demande != null ? fmtMoney(deal.ticket_demande, currency) : '—',
        stage_label: STAGE_LABEL[deal.stage] ?? deal.stage,
        lead_analyst_name: leadName,
      },
      enterprise: {
        legal_name: (deal as any).enterprises?.legal_name ?? deal.deal_ref,
        country: (deal as any).enterprises?.country ?? '—',
      },
      memo: {
        overall_score: version.overall_score ?? '—',
        classification: version.classification ?? 'Pending',
        verdict_summary: byCode.executive_summary?.content_md?.slice(0, 800) ?? '',
      },
      sections: sectionsPayload,
      valuation,
      findings_applied,
    },
    organizationId: deal.organization_id,
    dealRef: deal.deal_ref,
  };
}

// ─── Builder : valuation ────────────────────────────────────────────────────

async function buildValuationPayload(supabase: any, dealId: string) {
  const { data: deal } = await supabase
    .from('pe_deals')
    .select('id, organization_id, deal_ref, currency, enterprise_id, enterprises(legal_name)')
    .eq('id', dealId)
    .single();
  if (!deal) throw new Error('Deal introuvable');

  const { data: val } = await supabase
    .from('pe_valuation')
    .select('*')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (!val) throw new Error("Aucune valuation pour ce deal — génère-la d'abord");

  const currency = val.currency ?? deal.currency ?? 'FCFA';

  // Dé-flatten projections : array d'objets → arrays parallèles indexées
  const proj: any[] = Array.isArray(val.dcf_projections) ? val.dcf_projections : [];
  while (proj.length < 7) proj.push({ year: 0, revenue: 0, ebitda: 0, ebit: 0, capex: 0, nwc_change: 0, fcf: 0 });
  const proj_years = proj.slice(0, 7).map(p => p.year);
  const proj_revenue = proj.slice(0, 7).map(p => p.revenue);
  const proj_ebitda = proj.slice(0, 7).map(p => p.ebitda);
  const proj_ebit = proj.slice(0, 7).map(p => p.ebit);
  const proj_capex = proj.slice(0, 7).map(p => p.capex);
  const proj_nwc_change = proj.slice(0, 7).map(p => p.nwc_change);
  const proj_fcf = proj.slice(0, 7).map(p => p.fcf);

  // Sensitivity matrix → un array par row
  const sens = val.dcf_outputs?.sensitivity_matrix ?? [];
  const dcf_sensitivity_0 = sens[0] ?? [0, 0, 0, 0, 0];
  const dcf_sensitivity_1 = sens[1] ?? [0, 0, 0, 0, 0];
  const dcf_sensitivity_2 = sens[2] ?? [0, 0, 0, 0, 0];
  const dcf_sensitivity_3 = sens[3] ?? [0, 0, 0, 0, 0];
  const dcf_sensitivity_4 = sens[4] ?? [0, 0, 0, 0, 0];

  const wacc_axis: number[] = val.dcf_outputs?.wacc_axis ?? [];
  const g_axis: number[] = val.dcf_outputs?.g_axis ?? [];
  const dcf_outputs = {
    ...val.dcf_outputs,
    wacc_axis_pct: wacc_axis.map(v => fmtPct(v, 1)),
    g_axis_pct: g_axis.map(v => fmtPct(v, 1)),
  };

  const dcf_inputs = {
    ...val.dcf_inputs,
    wacc_pct: fmtPct(val.dcf_inputs?.wacc, 1),
    terminal_growth_rate_pct: fmtPct(val.dcf_inputs?.terminal_growth_rate, 1),
    tax_rate_pct: fmtPct(val.dcf_inputs?.tax_rate, 0),
  };

  const synthesis = {
    ...val.synthesis,
    weights: {
      ...(val.synthesis?.weights ?? {}),
      dcf_pct: fmtPct(val.synthesis?.weights?.dcf, 0),
      multiples_pct: fmtPct(val.synthesis?.weights?.multiples, 0),
      ancc_pct: fmtPct(val.synthesis?.weights?.ancc, 0),
    },
    irr_bear_pct: fmtPct(val.synthesis?.irr_bear, 0),
    irr_base_pct: fmtPct(val.synthesis?.irr_base, 0),
    irr_bull_pct: fmtPct(val.synthesis?.irr_bull, 0),
    equity_stake_pct_label: fmtPct(val.synthesis?.equity_stake_pct, 1),
  };

  return {
    payload: {
      generated_at: new Date().toISOString().slice(0, 10),
      currency,
      deal: { deal_ref: deal.deal_ref },
      enterprise: { legal_name: (deal as any).enterprises?.legal_name ?? deal.deal_ref },
      synthesis,
      dcf_inputs,
      dcf_outputs,
      proj_years, proj_revenue, proj_ebitda, proj_ebit, proj_capex, proj_nwc_change, proj_fcf,
      dcf_sensitivity_0, dcf_sensitivity_1, dcf_sensitivity_2, dcf_sensitivity_3, dcf_sensitivity_4,
      comparables: val.multiples_comparables ?? [],
      multiples_outputs: val.multiples_outputs ?? {},
      ancc_assets: val.ancc_assets ?? [],
      ancc_liabilities: val.ancc_liabilities ?? [],
      ancc_outputs: val.ancc_outputs ?? {},
    },
    organizationId: deal.organization_id,
    dealRef: deal.deal_ref,
  };
}

// ─── Serve ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RENDER_URL = Deno.env.get("RENDER_URL") ?? "http://host.docker.internal:3001";
    const RENDER_API_KEY = Deno.env.get("RENDER_API_KEY") ?? "dev-key-change-me";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return errorResponse("Unauthenticated", 401);

    const body = await req.json() as RequestBody;
    if (!body.deal_id || !body.kind || !body.format) return errorResponse("deal_id, kind, format required", 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Vérifie que l'user a accès au deal (RLS-style check via la fonction can_see_pe_deal)
    const { data: canSee } = await userClient.rpc('can_see_pe_deal', { p_deal_id: body.deal_id, p_user_id: user.id });
    if (!canSee) return errorResponse("Accès refusé à ce deal", 403);

    let payload: any, organizationId: string, dealRef: string;
    if (body.kind === 'memo_ic1') {
      ({ payload, organizationId, dealRef } = await buildMemoIc1Payload(adminClient, body.deal_id));
    } else if (body.kind === 'valuation') {
      ({ payload, organizationId, dealRef } = await buildValuationPayload(adminClient, body.deal_id));
    } else {
      return errorResponse(`Kind not yet supported: ${body.kind}`, 400);
    }

    const filename = `${dealRef}-${body.kind}-${new Date().toISOString().slice(0, 10)}.${body.format}`;

    const renderResp = await fetch(`${RENDER_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RENDER_API_KEY}`,
      },
      body: JSON.stringify({
        kind: body.kind,
        format: body.format,
        org_id: organizationId,
        payload,
        filename,
      }),
    });

    if (!renderResp.ok) {
      const text = await renderResp.text();
      console.error(`[render-document] esono-render error ${renderResp.status}: ${text}`);
      return errorResponse(`Service de rendu indisponible : ${text.slice(0, 200)}`, 502);
    }

    const buf = await renderResp.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': renderResp.headers.get('Content-Type') ?? 'application/octet-stream',
        'Content-Disposition': renderResp.headers.get('Content-Disposition') ?? `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('[render-document] error:', e);
    return errorResponse(`Erreur : ${(e as Error).message}`, 500);
  }
});
