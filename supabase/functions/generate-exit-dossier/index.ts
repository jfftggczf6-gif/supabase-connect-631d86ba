// generate-exit-dossier
// ----------------------------------------------------------------------------
// Génère le dossier de sortie d'une participation. Synthétise tout l'historique
// du deal : entrée → monitoring → sortie. Compare la thèse initiale au réalisé.
//
// Pipeline :
//   1. Charge tout l'historique : term sheet + memo IC final + rapports trimestriels
//      + scoring history + valuations périodiques + alertes résolues
//   2. Demande à Claude :
//      - vendor_dd_synthesis (résumé exécutif vendable)
//      - these_initiale vs these_realise + alignment_pct
//      - drivers_de_valeur + ratees
//      - 2-3 scénarios de sortie avec valuations
//      - potential_buyers types
//   3. Calcule MOIC/IRR réalisé + holding_period
//   4. Insert pe_exit_dossiers (status='preparing')
//
// À la finalisation (status='closed'), déclenche capitalisation dans la KB
// propriétaire du fonds via ingest-deal-learnings.
// ----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { fetchSections, getLatestVersion } from "../_shared/memo-helpers.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";

interface RequestBody {
  deal_id: string;
  scenario_target?: 'trade_sale' | 'secondary' | 'ipo_brvm' | 'ipo_other' | 'mbo' | 'other';
  force?: boolean;
}

const EXIT_SCHEMA = `{
  "vendor_dd_synthesis": "<string ~500 mots — synthèse vendable de la participation : historique investissement, performance, équipe, marché, perspectives>",
  "these_initiale": "<string 2-3 phrases — ce qui était promis dans le memo IC final>",
  "these_realise": "<string 2-3 phrases — ce qui a été accompli>",
  "these_alignment_pct": <int 0-100 — % de la thèse qui s'est matérialisée>,
  "drivers_de_valeur": [
    { "driver": "<string ex: 'Croissance organique sur le marché ivoirien'>", "impact_pct": <int>, "explanation": "<string>" }
  ],
  "ratees": [
    { "driver": "<string>", "explanation": "<string>" }
  ],
  "scenarios": [
    {
      "name": "<string ex: 'Trade sale industriel local'>",
      "type": "<trade_sale|secondary|ipo_brvm|ipo_other|mbo|other>",
      "valuation_estimee": <number en devise — pour l'entreprise complète>,
      "multiple_estimee": <number — sur EBITDA actuel>,
      "probability_pct": <int 0-100>,
      "conditions": ["<string>"],
      "buyers_potentiels": [{ "type": "<industriel|fonds|autre>", "nom": "<string>", "rationale": "<string>" }]
    }
  ],
  "scenario_recommandee": "<string — nom du scénario>",
  "moic_estime": <number — sur capital initial>,
  "irr_estime": <number 0-1>,
  "holding_period_months": <int>,
  "narrative_perspectives": "<string 2-3 phrases — vue à présenter aux acheteurs>"
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

    // 1) Idempotence
    if (!body.force) {
      const { data: existing } = await adminClient
        .from("pe_exit_dossiers")
        .select("id")
        .eq("deal_id", body.deal_id)
        .maybeSingle();
      if (existing) {
        return jsonResponse({
          success: true,
          skipped: true,
          reason: "Dossier de sortie existe déjà (passe force=true pour régénérer)",
          existing_id: existing.id,
        });
      }
    }

    // 2) Charger deal + entreprise
    const { data: deal } = await adminClient
      .from("pe_deals")
      .select(`
        id, organization_id, deal_ref, currency, ticket_demande,
        enterprise_id, enterprises(name, sector, country)
      `)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal introuvable", 404);
    const ent = (deal as any).enterprises;

    // 3) Charger term sheet (entrée + capital initial)
    const { data: termSheet } = await adminClient
      .from("pe_term_sheets")
      .select("*")
      .eq("deal_id", deal.id)
      .maybeSingle();

    // 4) Memo IC final (thèse initiale)
    const finalVersion =
      await getLatestVersion(adminClient, deal.id, "note_ic_finale", "ready") ??
      await getLatestVersion(adminClient, deal.id, "note_ic_finale", "validated") ??
      await getLatestVersion(adminClient, deal.id, "note_ic1", "ready");

    let memoBlock = '';
    if (finalVersion) {
      const sections = await fetchSections(adminClient, finalVersion.id);
      const wanted = ['executive_summary', 'investment_thesis', 'unit_economics', 'financials_pnl', 'esg_risks'];
      memoBlock = sections
        .filter((s: any) => wanted.includes(s.section_code))
        .map((s: any) => `### ${s.section_code}\n${s.content_md ?? ''}\n${s.content_json ? JSON.stringify(s.content_json, null, 2).slice(0, 2500) : ''}`)
        .join('\n\n');
    }

    // 5) Rapports trimestriels (tous, ordre chronologique)
    const { data: reports } = await adminClient
      .from("pe_quarterly_reports")
      .select("period, period_end, pnl_data, kpi_data, narrative")
      .eq("deal_id", deal.id)
      .order("period_end", { ascending: true });

    // 6) Score history complet
    const { data: scoreHistory } = await adminClient
      .from("pe_score_history")
      .select("period, period_end, score_total, drivers")
      .eq("deal_id", deal.id)
      .order("period_end", { ascending: true });

    // 7) Valuations périodiques
    const { data: valuations } = await adminClient
      .from("pe_periodic_valuations")
      .select("period, period_end, nav_amount, moic_to_date, irr_to_date, bridge_de_valeur")
      .eq("deal_id", deal.id)
      .order("period_end", { ascending: true });

    // 8) Alertes résolues (incidents passés)
    const { data: resolvedAlerts } = await adminClient
      .from("pe_alert_signals")
      .select("severity, title, message, period")
      .eq("deal_id", deal.id)
      .not("resolved_at", "is", null)
      .order("period");

    // 9) Build agent context (full stack)
    const ctx = await buildAgentContext(adminClient, deal.organization_id, {
      deliverableType: 'investment_memo',
      country: ent?.country ?? null,
      sector: ent?.sector ?? null,
      enterpriseId: deal.enterprise_id,
    });

    // Calcul holding period
    let holdingMonths: number | null = null;
    if (termSheet?.signed_at) {
      const start = new Date(termSheet.signed_at);
      const now = new Date();
      holdingMonths = Math.round((now.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000));
    }

    const lastVal = (valuations ?? [])[(valuations ?? []).length - 1];

    const taskPrompt = `Tu prépares le dossier de sortie d'une participation PE pour le fonds. La cible est "${ent?.name}" (${ent?.sector}, ${ent?.country}, deal ${deal.deal_ref}). Le scénario cible est "${body.scenario_target ?? 'trade_sale'}".

═══ ENTRÉE ═══
${termSheet ? `Date entrée : ${termSheet.signed_at}\nTicket : ${termSheet.total_amount} ${termSheet.devise} pour ${termSheet.equity_stake_pct}%\nValuation post-money à l'entrée : ${termSheet.post_money_valuation}` : '(pas de term sheet)'}
${holdingMonths ? `Durée portage actuelle : ${holdingMonths} mois (~${(holdingMonths / 12).toFixed(1)} ans)` : ''}

═══ THÈSE INITIALE (memo IC final) ═══
${memoBlock.slice(0, 20000) || '(memo non disponible)'}

═══ HISTORIQUE MONITORING ═══
Rapports trimestriels (${reports?.length ?? 0}) :
${(reports ?? []).map((r: any) => `${r.period} : CA ${r.pnl_data?.ca ?? 'n/d'}, EBITDA ${r.pnl_data?.ebitda ?? 'n/d'}. ${r.narrative ? r.narrative.slice(0, 200) : ''}`).join('\n')}

Évolution scoring (${scoreHistory?.length ?? 0}) :
${(scoreHistory ?? []).map((s: any) => `${s.period} : ${s.score_total}/100`).join(' · ')}

NAV périodiques (${valuations?.length ?? 0}) :
${(valuations ?? []).map((v: any) => `${v.period} : NAV ${v.nav_amount}, MOIC ${v.moic_to_date}, IRR ${v.irr_to_date}`).join('\n')}

Dernière NAV : ${lastVal ? `${lastVal.period} → ${lastVal.nav_amount} (MOIC ${lastVal.moic_to_date}, IRR ${(Number(lastVal.irr_to_date) * 100).toFixed(1)}%)` : 'n/d'}

═══ INCIDENTS RÉSOLUS ═══
${(resolvedAlerts ?? []).map((a: any) => `[${a.severity}] ${a.title} (${a.period})`).join('\n')}

═══ TA MISSION ═══
1. Synthèse vendor DD : ~500 mots, ton "investor relations", équilibré (forces ET points d'attention).
2. Bilan thèse : compare initiale vs réalisée. these_alignment_pct = 0 (raté complet) à 100 (parfaitement matérialisé).
3. Drivers de valeur : 3-5 vrais leviers qui ont marché (croissance, marge, multiple, expansion…) avec impact_pct.
4. Ratées : 0-3 promesses non tenues (sans embellir).
5. Scénarios de sortie : 2-3 options réalistes pour le marché africain (trade sale industriel local prioritaire, secondary à un autre fonds PE, IPO BRVM rare mais possible). Probabilité honnête.
6. Buyers potentiels : noms types (pas de noms réels — listes génériques par catégorie).
7. MOIC/IRR estimés à la sortie envisagée (cohérents avec le scénario recommandé).

═══ FORMAT JSON STRICT ═══
${EXIT_SCHEMA}

Pas de markdown fences. JSON strict.`;

    const aiText = await callAI(ctx.composeSystemPrompt(taskPrompt),
      `Génère le dossier de sortie pour ${ent?.name}.`,
      8000, undefined, 0.3,
      { functionName: "generate-exit-dossier", enterpriseId: deal.enterprise_id });

    let parsed: any;
    try {
      parsed = JSON.parse(aiText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
    } catch (e: any) {
      console.error("[generate-exit-dossier] parse error:", e.message);
      return errorResponse(`Synthèse IA non parsable : ${e.message}`, 500);
    }

    // 10) Insert/upsert pe_exit_dossiers
    const recommendedScenario = (parsed.scenarios ?? []).find((s: any) => s.name === parsed.scenario_recommandee) ?? (parsed.scenarios ?? [])[0];

    const dossierData = {
      deal_id: deal.id,
      organization_id: deal.organization_id,
      scenario: recommendedScenario?.type ?? body.scenario_target ?? 'trade_sale',
      status: 'preparing' as const,
      exit_valuation: recommendedScenario?.valuation_estimee ?? null,
      exit_devise: termSheet?.devise ?? deal.currency ?? 'EUR',
      fund_proceeds: termSheet?.equity_stake_pct && recommendedScenario?.valuation_estimee
        ? Number(recommendedScenario.valuation_estimee) * (Number(termSheet.equity_stake_pct) / 100)
        : null,
      exit_multiple: parsed.moic_estime ?? null,
      exit_irr: parsed.irr_estime ?? null,
      holding_period_months: parsed.holding_period_months ?? holdingMonths,
      scenarios_data: parsed.scenarios ?? [],
      these_initiale: parsed.these_initiale ?? null,
      these_realise: parsed.these_realise ?? null,
      these_alignment_pct: typeof parsed.these_alignment_pct === 'number' ? parsed.these_alignment_pct : null,
      drivers_de_valeur: parsed.drivers_de_valeur ?? [],
      ratees: parsed.ratees ?? [],
      vendor_dd_synthesis: parsed.vendor_dd_synthesis ?? null,
      potential_buyers: (parsed.scenarios ?? []).flatMap((s: any) => s.buyers_potentiels ?? []),
      ai_generated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await adminClient
      .from("pe_exit_dossiers")
      .upsert(dossierData, { onConflict: 'deal_id' })
      .select()
      .single();

    if (insertErr) return errorResponse(`Insert/upsert échoué : ${insertErr.message}`, 500);

    return jsonResponse({ success: true, dossier: inserted });

  } catch (e: any) {
    console.error("[generate-exit-dossier] error:", e);
    return errorResponse(e.message || "Erreur interne", 500);
  }
});
