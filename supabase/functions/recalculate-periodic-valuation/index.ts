// recalculate-periodic-valuation
// ----------------------------------------------------------------------------
// Recalcule la NAV (Net Asset Value) d'une participation à partir des données
// réelles du monitoring (vs projections initiales du memo).
//
// Pipeline :
//   1. Charge deal + term sheet (capital initial)
//   2. Charge derniers rapports trimestriels (PnL/bilan/KPI réels)
//   3. Demande à Claude de recalculer DCF + multiples + ANCC avec les vrais chiffres
//   4. Calcule MOIC/IRR à date
//   5. Génère bridge de valeur (waterfall : croissance CA + marge + multiple)
//   6. Insert pe_periodic_valuations
//
// Standards IPEV.
// ----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";

interface RequestBody {
  deal_id: string;
  period: string;
  period_start: string;
  period_end: string;
  force?: boolean;
}

const VALUATION_SCHEMA = `{
  "dcf_inputs": {
    "wacc": <number 0-1>,
    "terminal_growth_rate": <number 0-1>,
    "tax_rate": <number 0-1>
  },
  "dcf_outputs": {
    "enterprise_value": <number en M devise>,
    "equity_value": <number en M devise>,
    "net_debt": <number>
  },
  "multiples_outputs": {
    "ev_ebitda_applied": <number>,
    "implied_ev": <number en M devise>,
    "implied_equity_value": <number en M devise>
  },
  "ancc_outputs": {
    "actif_net_corrige": <number en M devise>
  },
  "weighting": { "dcf": <0-1>, "multiples": <0-1>, "ancc": <0-1> },
  "nav_amount": <number en devise réelle (pas en millions)>,
  "nav_method": "<dcf|multiples|weighted|ancc|cost>",
  "moic_to_date": <number — ex 1.45>,
  "irr_to_date": <number 0-1 — ex 0.187 = 18.7%>,
  "tvpi": <number — total value to paid-in>,
  "comparison_entry": {
    "entry_valuation": <number>,
    "current_valuation": <number>,
    "delta_pct": <number>
  },
  "comparison_n_minus_1": {
    "previous_valuation": <number ou null>,
    "current_valuation": <number>,
    "delta_pct": <number ou null>
  },
  "bridge_de_valeur": [
    { "item": "<string ex: 'Croissance CA'>", "impact_pct": <number signed>, "amount": <number signed>, "explanation": "<string>" }
  ],
  "ai_justification": "<string 3-5 phrases>",
  "methodology_notes": "<string — méthodo IPEV utilisée>"
}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    if (!body.deal_id || !body.period || !body.period_start || !body.period_end) {
      return errorResponse("deal_id, period, period_start, period_end required", 400);
    }

    // 1) Idempotence
    if (!body.force) {
      const { data: existing } = await adminClient
        .from("pe_periodic_valuations")
        .select("id")
        .eq("deal_id", body.deal_id)
        .eq("period", body.period)
        .maybeSingle();
      if (existing) {
        return jsonResponse({
          success: true,
          skipped: true,
          reason: "Valuation déjà calculée pour cette période (force=true pour régénérer)",
          existing_id: existing.id,
        });
      }
    }

    // 2) Charger deal
    const { data: deal } = await adminClient
      .from("pe_deals")
      .select(`
        id, organization_id, deal_ref, currency, ticket_demande,
        enterprise_id, enterprises(name, country, sector)
      `)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal introuvable", 404);

    // 3) Term sheet (entrée)
    const { data: termSheet } = await adminClient
      .from("pe_term_sheets")
      .select("total_amount, devise, equity_stake_pct, post_money_valuation, signed_at")
      .eq("deal_id", deal.id)
      .maybeSingle();

    // 4) Derniers rapports trimestriels (jusqu'à 8 = 2 ans de monitoring)
    const { data: reports } = await adminClient
      .from("pe_quarterly_reports")
      .select("period, period_end, pnl_data, bilan_data, kpi_data")
      .eq("deal_id", deal.id)
      .order("period_end", { ascending: false })
      .limit(8);

    if (!reports || reports.length === 0) {
      return errorResponse("Aucun rapport trimestriel — impossible de recalculer la valuation", 400);
    }

    // 5) Valuation période N-1 (pour comparison_n_minus_1)
    const { data: previousValuation } = await adminClient
      .from("pe_periodic_valuations")
      .select("nav_amount, period")
      .eq("deal_id", deal.id)
      .lt("period_end", body.period_end)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6) Build agent context (tone PE + benchmarks valuation + RAG)
    const ent = (deal as any).enterprises;
    const ctx = await buildAgentContext(adminClient, deal.organization_id, {
      deliverableType: 'valuation',
      country: ent?.country ?? null,
      sector: ent?.sector ?? null,
      enterpriseId: deal.enterprise_id,
    });

    const taskPrompt = `Tu es un Investment Manager qui recalcule la NAV (Net Asset Value) d'une participation pour une période de reporting LP. Tu utilises les données RÉELLES du monitoring (pas les projections initiales).

═══ PARTICIPATION ═══
${ent?.name} (${ent?.sector}, ${ent?.country}) — deal ${deal.deal_ref}
Entrée : ${termSheet ? `${termSheet.total_amount} ${termSheet.devise} pour ${termSheet.equity_stake_pct}% le ${termSheet.signed_at} (post-money ${termSheet.post_money_valuation})` : '(pas de term sheet)'}

═══ PÉRIODE NAV ═══
${body.period} (${body.period_start} → ${body.period_end})

═══ DONNÉES RÉELLES ${reports.length} TRIMESTRES ═══
${reports.map((r: any) => `Période ${r.period} (jusqu'au ${r.period_end}) :\nPnL : ${JSON.stringify(r.pnl_data)}\nBilan : ${JSON.stringify(r.bilan_data)}\nKPI : ${JSON.stringify(r.kpi_data)}`).join('\n\n')}

═══ VALUATION N-1 ═══
${previousValuation ? `Période ${previousValuation.period} : NAV ${previousValuation.nav_amount}` : '(pas de valuation précédente — c\'est la 1ère)'}

═══ TA MISSION ═══
1. Recalcule DCF avec WACC actualisé (peut avoir évolué : taux d'intérêt, secteur)
2. Multiples comparables : applique les multiples sectoriels actuels (peuvent avoir contracté ou expandé)
3. ANCC à partir du dernier bilan
4. Pondération : par défaut 50/35/15 (DCF/Multiples/ANCC), ajuste selon nature de l'entreprise
5. NAV finale = Equity value pondéré × % détention du fonds
6. MOIC à date = NAV / Capital_initial_décaissé
7. IRR à date : utilise formule IRR avec cash flows réels (entrée négative au signing, NAV positive aujourd'hui)
8. Bridge de valeur : décompose le delta vs entrée (croissance CA, amélioration marge, multiple expansion/contraction, distributions reçues si applicable)
9. ai_justification : 3-5 phrases qui résument la méthode et la confiance
10. methodology_notes : référencer IPEV guidelines

═══ EXIGENCES UNITÉS ═══
- DCF/multiples outputs en MILLIONS de devise
- nav_amount en devise RÉELLE (pas en millions)
- Taux et ratios en décimal (0-1)
- MOIC en ratio (1.45 = 145%)

═══ FORMAT JSON STRICT ═══
${VALUATION_SCHEMA}

Pas de markdown fences. JSON strict.`;

    const aiText = await callAI(ctx.composeSystemPrompt(taskPrompt),
      `Recalcule la NAV ${body.period} pour ${ent?.name}.`,
      6000, undefined, 0.2,
      { functionName: "recalculate-periodic-valuation", enterpriseId: deal.enterprise_id });

    let parsed: any;
    try {
      parsed = JSON.parse(aiText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
    } catch (e: any) {
      console.error("[recalculate-periodic-valuation] parse error:", e.message, aiText.slice(0, 500));
      return errorResponse(`Synthèse IA non parsable : ${e.message}`, 500);
    }

    // 7) Insert
    const { data: inserted, error: insertErr } = await adminClient
      .from("pe_periodic_valuations")
      .insert({
        deal_id: deal.id,
        organization_id: deal.organization_id,
        period: body.period,
        period_start: body.period_start,
        period_end: body.period_end,
        devise: termSheet?.devise ?? deal.currency ?? 'EUR',
        dcf_inputs: parsed.dcf_inputs ?? {},
        dcf_outputs: parsed.dcf_outputs ?? {},
        multiples_comparables: [],
        multiples_outputs: parsed.multiples_outputs ?? {},
        ancc_outputs: parsed.ancc_outputs ?? {},
        weighting: parsed.weighting ?? {},
        nav_amount: parsed.nav_amount ?? null,
        nav_method: parsed.nav_method ?? 'weighted',
        comparison_entry: parsed.comparison_entry ?? null,
        comparison_n_minus_1: parsed.comparison_n_minus_1 ?? null,
        bridge_de_valeur: parsed.bridge_de_valeur ?? [],
        moic_to_date: parsed.moic_to_date ?? null,
        irr_to_date: parsed.irr_to_date ?? null,
        tvpi: parsed.tvpi ?? null,
        methodology_notes: parsed.methodology_notes ?? null,
        ai_justification: parsed.ai_justification ?? null,
      })
      .select()
      .single();

    if (insertErr) return errorResponse(`Insert échoué : ${insertErr.message}`, 500);

    return jsonResponse({ success: true, valuation: inserted });

  } catch (e: any) {
    console.error("[recalculate-periodic-valuation] error:", e);
    return errorResponse(e.message || "Erreur interne", 500);
  }
});
