// generate-pe-valuation — Génère une valuation détaillée pour un deal PE selon 3 méthodes :
//   1) DCF (7 ans + sensibilité WACC×g)
//   2) Multiples comparables (EV/EBITDA, EV/Sales, P/E)
//   3) ANCC (Actif Net Comptable Corrigé)
// + Synthèse pondérée avec scénarios bear/base/bull et MOIC/IRR.
//
// UPSERT pe_valuation (1 row par deal). Synchronise ensuite la section investment_thesis
// du memo avec les chiffres clés pour garder le memo cohérent.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";
import { fetchSections, getLatestVersion } from "../_shared/memo-helpers.ts";

interface RequestBody {
  deal_id: string;
}

const VALUATION_SCHEMA = `{
  "currency": "FCFA",
  "dcf_inputs": {
    "wacc": 0.18,                    // taux d'actualisation (0.10-0.30 typique Afrique)
    "terminal_growth_rate": 0.025,   // g (0.01-0.04 typique)
    "tax_rate": 0.25,                // IS (Côte d'Ivoire 25%)
    "beta": 1.1,
    "risk_free_rate": 0.07,          // taux sans risque local
    "equity_risk_premium": 0.08,
    "cost_of_debt": 0.10,
    "debt_to_capital": 0.30
  },
  "dcf_projections": [               // 7 ans à partir de l'année actuelle
    { "year": 2026, "revenue": 0, "ebitda": 0, "ebit": 0, "capex": 0, "nwc_change": 0, "fcf": 0 }
  ],
  "dcf_terminal": {
    "method": "gordon",              // ou "exit_multiple"
    "tv": 0,                         // valeur terminale brute
    "pv_tv": 0,                      // valeur terminale actualisée
    "exit_multiple": null,           // si method=exit_multiple
    "exit_year": 2032
  },
  "dcf_outputs": {
    "enterprise_value": 0,
    "net_debt": 0,
    "minority_interests": 0,
    "equity_value": 0,
    "wacc_axis": [0.14, 0.16, 0.18, 0.20, 0.22],   // 5 valeurs (sensibilité)
    "g_axis": [0.015, 0.020, 0.025, 0.030, 0.035], // 5 valeurs
    "sensitivity_matrix": [                         // matrice 5×5 EV en M FCFA
      [0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]
    ]
  },
  "multiples_comparables": [          // 5-8 comparables réalistes
    {
      "company": "<nom comparable>",
      "country": "<pays>",
      "sector": "<secteur>",
      "source_year": 2025,
      "ev_ebitda": 7.5,
      "ev_sales": 1.2,
      "pe": 12,
      "currency": "FCFA"
    }
  ],
  "multiples_outputs": {
    "selected_ev_ebitda": 7.5,        // médiane retenue
    "selected_ev_sales": 1.2,
    "selected_pe": 12,
    "ebitda_year_n": 0,               // EBITDA actuel ou +1 année
    "revenue_year_n": 0,
    "ev_from_ebitda": 0,
    "ev_from_sales": 0,
    "blended_ev": 0,                  // moyenne pondérée des EV des 3 multiples
    "justification": "<court : pourquoi ces multiples retenus>"
  },
  "ancc_assets": [
    { "label": "<libellé poste>", "book_value": 0, "adjustment": 0, "adjusted_value": 0, "note": "<courte note>" }
  ],
  "ancc_liabilities": [
    { "label": "<libellé poste>", "book_value": 0, "adjustment": 0, "adjusted_value": 0, "note": "<courte note>" }
  ],
  "ancc_outputs": {
    "total_assets_adjusted": 0,
    "total_liabilities_adjusted": 0,
    "anc_corrected": 0,                // = actifs ajustés - passifs ajustés
    "justification": "<courte note>"
  },
  "synthesis": {
    "weights": { "dcf": 0.50, "multiples": 0.35, "ancc": 0.15 },
    "method_evs": { "dcf": 0, "multiples": 0, "ancc": 0 },
    "weighted_ev": 0,
    "range": { "bear": 0, "base": 0, "bull": 0 },
    "pre_money_recommended": 0,        // EV - net_debt = pre-money equity
    "post_money_recommended": 0,       // pre_money + ticket
    "ticket_recommended": 0,
    "equity_stake_pct": 0.20,          // 0.05-0.40 typique
    "moic_bear": 1.5,
    "moic_base": 2.5,
    "moic_bull": 4.0,
    "irr_bear": 0.10,
    "irr_base": 0.20,
    "irr_bull": 0.30,
    "exit_horizon_years": 5,
    "justification": "<résumé court : pourquoi cette pondération + ce range>"
  },
  "ai_justification": "<résumé global 3-5 phrases : confiance dans la valuation, principaux drivers, principaux risques>"
}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return errorResponse("Unauthenticated", 401);

    const body = await req.json() as RequestBody;
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1) Deal + org
    const { data: deal, error: dealErr } = await adminClient
      .from("pe_deals")
      .select("id, organization_id, deal_ref, currency, ticket_demande, enterprise_id, enterprises(legal_name, country)")
      .eq("id", body.deal_id)
      .single();
    if (dealErr || !deal) return errorResponse("Deal introuvable", 404);

    // 2) Memo : on prend la version la plus récente (live)
    const { data: memo } = await adminClient
      .from("investment_memos")
      .select("id")
      .eq("deal_id", body.deal_id)
      .maybeSingle();
    if (!memo) return errorResponse("Aucun memo pour ce deal — génère le memo IC1 avant de lancer la valuation", 400);

    // Stage le plus avancé (note_ic_finale > note_ic1 > pre_screening)
    const STAGES = ["note_ic_finale", "note_ic1", "pre_screening"];
    let version: any = null;
    for (const s of STAGES) {
      version = await getLatestVersion(adminClient, body.deal_id, s, "ready");
      if (version) break;
    }
    if (!version) return errorResponse("Aucune version de memo prête (status=ready)", 400);

    const sections = await fetchSections(adminClient, version.id);
    const sectionsByCode: Record<string, any> = {};
    for (const s of sections) sectionsByCode[s.section_code] = s;

    // 3) Construire le contexte memo (sections clés pour valuation)
    const contextSections = ["services", "competition_market", "unit_economics", "financials_pnl", "financials_balance", "investment_thesis"];
    const memoContext = contextSections.map(code => {
      const s = sectionsByCode[code];
      if (!s) return "";
      const json = s.content_json ? JSON.stringify(s.content_json, null, 2) : "";
      const md = s.content_md ?? "";
      return `═══ ${code.toUpperCase()} ═══\n${md}\n${json ? "JSON: " + json : ""}\n`;
    }).filter(Boolean).join("\n");

    const enterprise = (deal as any).enterprises;
    const dealRef = (deal as any).deal_ref;
    const country = enterprise?.country ?? "Côte d'Ivoire";
    const currency = (deal as any).currency ?? "FCFA";
    const ticket = (deal as any).ticket_demande ?? null;

    // 4) Prompt
    const tone = buildToneForAgent({ agent: "managing_director", segment: "pe" });
    const prompt = `${tone}

═══ MISSION : VALUATION DÉTAILLÉE ${enterprise?.legal_name ?? dealRef} (${country}) ═══

Tu produis une analyse de valuation rigoureuse selon 3 méthodes pour un deal PE en Afrique francophone.
Devise : ${currency}.${ticket ? ` Ticket demandé : ${ticket} ${currency}.` : ""}

═══ MÉTHODE 1 — DCF (Discounted Cash Flows) ═══
- WACC : 14-22% typique en Afrique francophone (PME industrielle)
- Croissance terminale g : 1.5-3.5% (inflation long terme + croissance secteur)
- 7 ans de projection (year_1 = année actuelle + 1)
- Sensibilité : matrice 5×5 WACC × g, valeurs en EV (M ${currency})
- Equity Value = EV − Net Debt − Minority Interests

═══ MÉTHODE 2 — MULTIPLES COMPARABLES ═══
- Sélectionne 5-8 comparables réalistes du secteur (priorité : Afrique de l'Ouest, sinon Afrique, sinon émergents).
- Multiples : EV/EBITDA (principal), EV/Sales (secondaire), P/E (tertiaire).
- Médiane (pas moyenne) pour neutraliser outliers.
- Si peu de comparables : retiens des cabinets connus (KPMG/PWC) ou des transactions M&A publiques en Afrique.

═══ MÉTHODE 3 — ANCC (Actif Net Comptable Corrigé) ═══
- Re-évaluation des actifs (immobilier, stocks, créances douteuses) et des passifs (dettes hors bilan, provisions sous-évaluées).
- Lis attentivement le bilan dans memo financials_balance.
- Justifie chaque ajustement (ligne par ligne, montant + raison).

═══ SYNTHÈSE ═══
- Pondération : par défaut 50% DCF / 35% multiples / 15% ANCC pour une PME en croissance.
  Si entreprise très asset-heavy (immobilier, fonds de commerce) → augmente ANCC (jusqu'à 30%).
  Si entreprise immatérielle (tech/services) → réduis ANCC (5-10%).
- Range : bear = floor (DCF avec WACC haut + g bas), base = pondération synthétique, bull = ceiling (multiples top quartile).
- Pre-money equity = Weighted EV − Net Debt.
- Ticket recommandé : si ticket_demande connu, vérifie cohérence ; sinon propose 15-30% du pre-money.
- MOIC bear/base/bull sur horizon 5 ans (typique PE Afrique). IRR cohérent avec MOIC.

═══ EXIGENCES — UNITÉS ═══
- TOUS les montants monétaires (revenue, ebitda, ebit, fcf, capex, nwc_change, tv, pv_tv, enterprise_value, equity_value, net_debt, ev_from_*, blended_ev, book_value, adjustment, adjusted_value, totals, weighted_ev, range, pre_money, post_money, ticket, sensitivity_matrix) sont en MILLIONS de ${currency}.
  Exemple : un EBITDA de 475 M FCFA s'écrit 475 (pas 475000000, pas 0.475).
- Les multiples (ev_ebitda, ev_sales, pe) sont des ratios sans unité.
- Les taux (wacc, terminal_growth_rate, tax_rate, equity_stake_pct, irr_*) sont des décimaux entre 0 et 1 (ex: 0.18 = 18%).
- MOIC en ratio (ex: 2.5).

═══ EXIGENCES ═══
- Pas d'inventer : si une donnée n'est pas dans le memo, marque-la comme estimation et explique l'hypothèse.
- Justifications courtes (1-2 phrases) sur chaque méthode.
- ai_justification global : 3-5 phrases qui résument la confiance, drivers, risques.

═══ FORMAT DE RETOUR — JSON STRICT, RIEN D'AUTRE ═══
${VALUATION_SCHEMA}

═══ MEMO IC EXISTANT (extraits clés) ═══
${memoContext.slice(0, 80000)}

═══ CONSIGNE ═══
Retourne UNIQUEMENT le JSON, sans bloc markdown, sans commentaire avant/après.`;

    // 5) Call AI
    const ai = await callAI({
      prompt,
      maxTokens: 12000,
      temperature: 0.2,
      label: `generate-pe-valuation:${dealRef}`,
    });

    if (!ai?.text) {
      return errorResponse(`AI a renvoyé un résultat vide`, 500);
    }

    // 6) Parse JSON
    let parsed: any;
    try {
      const cleaned = ai.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("[generate-pe-valuation] JSON parse error:", e, "raw:", ai.text.slice(0, 500));
      return errorResponse(`Parsing JSON IA échoué : ${(e as Error).message}`, 500);
    }

    // 7) UPSERT pe_valuation
    const valuationRow = {
      deal_id: body.deal_id,
      organization_id: (deal as any).organization_id,
      currency: parsed.currency ?? currency,
      dcf_inputs: parsed.dcf_inputs ?? {},
      dcf_projections: parsed.dcf_projections ?? [],
      dcf_terminal: parsed.dcf_terminal ?? {},
      dcf_outputs: parsed.dcf_outputs ?? {},
      multiples_comparables: parsed.multiples_comparables ?? [],
      multiples_outputs: parsed.multiples_outputs ?? {},
      ancc_assets: parsed.ancc_assets ?? [],
      ancc_liabilities: parsed.ancc_liabilities ?? [],
      ancc_outputs: parsed.ancc_outputs ?? {},
      synthesis: parsed.synthesis ?? {},
      ai_justification: parsed.ai_justification ?? null,
      status: "ready",
      generated_at: new Date().toISOString(),
      generated_by_user_id: user.id,
      generated_by_agent: "managing_director",
      error_message: null,
    };

    const { error: upsertErr } = await adminClient
      .from("pe_valuation")
      .upsert(valuationRow, { onConflict: "deal_id" });

    if (upsertErr) {
      console.error("[generate-pe-valuation] upsert failed:", upsertErr);
      return errorResponse(`UPSERT pe_valuation échoué : ${upsertErr.message}`, 500);
    }

    // 8) Sync memo investment_thesis content_json — on patch les champs clés
    const thesisSection = sectionsByCode["investment_thesis"];
    if (thesisSection && parsed.synthesis) {
      const oldJson = thesisSection.content_json ?? {};
      const newJson = {
        ...oldJson,
        valuation_synced_at: new Date().toISOString(),
        valuation: {
          method: "weighted_3_methods",
          pre_money: parsed.synthesis.pre_money_recommended ?? null,
          post_money: parsed.synthesis.post_money_recommended ?? null,
          ticket_recommended: parsed.synthesis.ticket_recommended ?? null,
          equity_stake_pct: parsed.synthesis.equity_stake_pct ?? null,
          range: parsed.synthesis.range ?? null,
          moic: {
            bear: parsed.synthesis.moic_bear ?? null,
            base: parsed.synthesis.moic_base ?? null,
            bull: parsed.synthesis.moic_bull ?? null,
          },
          irr: {
            bear: parsed.synthesis.irr_bear ?? null,
            base: parsed.synthesis.irr_base ?? null,
            bull: parsed.synthesis.irr_bull ?? null,
          },
          exit_horizon_years: parsed.synthesis.exit_horizon_years ?? null,
          weights: parsed.synthesis.weights ?? null,
          weighted_ev: parsed.synthesis.weighted_ev ?? null,
          currency: parsed.currency ?? currency,
        },
      };
      const { error: syncErr } = await adminClient
        .from("memo_sections")
        .update({ content_json: newJson, last_edited_at: new Date().toISOString(), last_edited_by: user.id })
        .eq("id", thesisSection.id);
      if (syncErr) console.error("[generate-pe-valuation] sync memo investment_thesis failed:", syncErr);
    }

    return jsonResponse({
      success: true,
      deal_id: body.deal_id,
      synthesis: parsed.synthesis,
      ai_justification: parsed.ai_justification,
      generated_at: valuationRow.generated_at,
    });
  } catch (e) {
    console.error("[generate-pe-valuation] error:", e);
    return errorResponse(`Erreur : ${(e as Error).message}`, 500);
  }
});
