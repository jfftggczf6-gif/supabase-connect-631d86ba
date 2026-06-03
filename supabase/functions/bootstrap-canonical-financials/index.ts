/**
 * bootstrap-canonical-financials
 *
 * Brief 0.5 — Refonte SSOT.
 *
 * Migration one-shot des entreprises existantes vers la SSOT enterprise_financial_canonical.
 *
 * Pour chaque entreprise ayant au moins un deliverable plan_financier OU valuation
 * (et plus tard les nouvelles s'inscrivent automatiquement via brief 0.6), lit les
 * deliverables.data, mappe vers le schéma canonical, upsert.
 *
 * Auth : service_role uniquement, via header X-Service-Token (cohérent avec
 * admin-bulk-cleanup-legacy déjà déployé). Pas de JWT user — c'est admin only.
 *
 * Body :
 *   { enterprise_ids?: string[] }  // si fourni, ne traite que ces enterprises
 *
 * Réponse :
 *   { ok, scanned, canonicalized, skipped, errors[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";
import { upsertCanonicalFinancials, type CanonicalFinancials, type ProjectionsY5 } from "../_shared/canonical-financials.ts";

function jsonResp(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const safe = (v: any): number | null => {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

function toProjY5(arr: any[] | undefined | null, field: string): ProjectionsY5 | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out: ProjectionsY5 = {};
  let i = 0;
  for (const row of arr) {
    if (row && (row.is_reel === false || row.is_reel === undefined)) {
      i++;
      if (i > 5) break;
      const key = `y${i}` as keyof ProjectionsY5;
      const v = safe(row[field]);
      if (v != null) out[key] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

function mapPlanFinancierToCanonical(planData: any): Partial<CanonicalFinancials> {
  if (!planData || typeof planData !== "object") return {};
  const kpis = planData.kpis || {};
  const hist = planData.historique || {};
  const sf = planData.sante_financiere || {};
  const projections: any[] = Array.isArray(planData.projections) ? planData.projections : [];
  const reel = projections.filter((p: any) => p?.is_reel);
  const proj = projections.filter((p: any) => !p?.is_reel);
  const reelByYear = (idx: number) => reel[reel.length - 1 - idx] || null;

  const out: Partial<CanonicalFinancials> = {
    currency: planData.devise || planData.currency || "FCFA",
    currency_iso: planData.currency_iso || planData.devise || "XOF",
    base_year: safe(planData.base_year || planData.annee_base || new Date().getFullYear()) || new Date().getFullYear(),
    // Historique : on prend les 3 dernières années réelles si disponibles
    ca_y: safe(reelByYear(0)?.ca ?? hist.ca_n ?? kpis.ca),
    ca_y_minus_1: safe(reelByYear(1)?.ca ?? hist.ca_n_moins_1),
    ca_y_minus_2: safe(reelByYear(2)?.ca ?? hist.ca_n_moins_2),
    ebitda_y: safe(reelByYear(0)?.ebitda ?? hist.ebitda_n ?? kpis.ebitda),
    ebitda_y_minus_1: safe(reelByYear(1)?.ebitda ?? hist.ebitda_n_moins_1),
    ebitda_y_minus_2: safe(reelByYear(2)?.ebitda ?? hist.ebitda_n_moins_2),
    resultat_net_y: safe(reelByYear(0)?.resultat_net ?? hist.resultat_net_n),
    resultat_net_y_minus_1: safe(reelByYear(1)?.resultat_net ?? hist.resultat_net_n_moins_1),
    resultat_net_y_minus_2: safe(reelByYear(2)?.resultat_net ?? hist.resultat_net_n_moins_2),
    tresorerie_actuelle: safe(sf?.liquidite?.tresorerie ?? kpis.tresorerie),
    dette_financiere_actuelle: safe(sf?.endettement?.dette_totale ?? kpis.dette_totale),
    capitaux_propres_actuels: safe(sf?.endettement?.capitaux_propres ?? kpis.capitaux_propres),
    // Projections Y+1 → Y+5
    ca_projected: toProjY5(proj, "ca") || (proj.length ? { y1: safe(proj[0]?.ca) ?? undefined, y2: safe(proj[1]?.ca) ?? undefined, y3: safe(proj[2]?.ca) ?? undefined, y4: safe(proj[3]?.ca) ?? undefined, y5: safe(proj[4]?.ca) ?? undefined } : null),
    ebitda_projected: toProjY5(proj, "ebitda"),
    cashflow_projected: toProjY5(proj, "cashflow") || toProjY5(proj, "fcf"),
    resultat_net_projected: toProjY5(proj, "resultat_net"),
    inflation_used: safe(planData.hypotheses_ia?.inflation ?? planData.hypotheses?.inflation),
    // Investissement
    besoin_financement_total: safe(planData.besoin_financement?.total ?? planData.financement?.besoin_total),
    capex_prevu: safe(planData.capex?.total ?? planData.investissement?.capex),
    bfr_initial: safe(planData.bfr?.initial ?? planData.investissement?.bfr),
    restructuration_dette: safe(planData.financement?.restructuration_dette),
    financement_deja_obtenu: safe(planData.financement?.deja_obtenu),
    composition_besoin: planData.composition_besoin || planData.financement?.composition || null,
    zone_monetaire: planData.zone_monetaire || null,
  };
  return out;
}

function mapValuationToCanonical(valData: any): Partial<CanonicalFinancials> {
  if (!valData || typeof valData !== "object") return {};
  const synthesis = valData.synthesis || {};
  const dcfIn = valData.dcf_inputs || {};
  const dcfOut = valData.dcf_outputs || {};
  const dcfTerm = valData.dcf_terminal || {};
  const mulOut = valData.multiples_outputs || {};
  const indic = valData.indicateurs || valData.indicators || {};

  const out: Partial<CanonicalFinancials> = {
    // WACC
    wacc_pct: safe(dcfIn.wacc ? dcfIn.wacc * 100 : dcfIn.wacc_pct ?? valData.wacc_pct),
    wacc_raw: safe(valData.wacc_raw),
    wacc_capped: !!valData.wacc_capped,
    wacc_components: {
      risk_free_rate: safe(dcfIn.risk_free_rate),
      equity_risk_premium: safe(dcfIn.equity_risk_premium),
      cost_of_debt: safe(dcfIn.cost_of_debt),
      debt_to_capital: safe(dcfIn.debt_to_capital),
      tax_rate: safe(dcfIn.tax_rate),
      beta: safe(dcfIn.beta),
    },
    // DCF
    equity_value_dcf: safe(dcfOut.equity_value),
    enterprise_value_dcf: safe(dcfOut.enterprise_value),
    terminal_value: safe(dcfTerm.tv ?? dcfTerm.terminal_value),
    // Multiples
    multiple_ebitda_retenu: safe(mulOut.selected_ev_ebitda),
    multiple_ca_retenu: safe(mulOut.selected_ev_sales),
    valeur_par_ebitda: safe(mulOut.ev_from_ebitda),
    valeur_par_ca: safe(mulOut.ev_from_sales),
    // Synthèse
    valorisation_basse: safe(synthesis.range?.bear),
    valorisation_mediane: safe(synthesis.range?.base ?? synthesis.weighted_ev),
    valorisation_haute: safe(synthesis.range?.bull),
    methode_privilegiee: synthesis.method_privileged || synthesis.methode_privilegiee || null,
    // Indicateurs de décision
    van: safe(indic.van ?? valData.van),
    tri_pct: safe((indic.tri ?? valData.tri) != null ? (indic.tri ?? valData.tri) * 100 : indic.tri_pct ?? valData.tri_pct),
    payback_years: safe(indic.payback ?? indic.payback_years ?? valData.payback_years),
    dscr_moyen: safe(indic.dscr_moyen ?? indic.dscr ?? valData.dscr_moyen),
    duree_pret_utilisee_dscr: safe(indic.duree_pret_dscr ?? indic.duree_pret_utilisee_dscr),
    roi_pct: safe((indic.roi ?? valData.roi) != null ? (indic.roi ?? valData.roi) * 100 : indic.roi_pct ?? valData.roi_pct),
    runway_mois: safe(indic.runway_mois ?? valData.runway_mois),
    couverture_interets: safe(indic.couverture_interets ?? valData.couverture_interets),
    cycle_tresorerie_jours: safe(indic.cycle_tresorerie ?? indic.cycle_tresorerie_jours),
  };
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminToken = Deno.env.get("ADMIN_BULK_TOKEN") || Deno.env.get("EF_SERVICE_TOKEN");
    if (!adminToken) return jsonResp({ error: "ADMIN_BULK_TOKEN / EF_SERVICE_TOKEN non configuré" }, 500);
    const hdr = req.headers.get("X-Admin-Token") || req.headers.get("X-EF-Service-Token");
    if (hdr !== adminToken) return jsonResp({ error: "Forbidden" }, 403);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const targetIds: string[] | undefined = Array.isArray(body.enterprise_ids) ? body.enterprise_ids : undefined;
    const limit = Math.min(Number(body.limit) || 1000, 5000);

    // Liste les entreprises ayant au moins un deliverable plan_financier ou valuation.
    let entIds: string[] = [];
    if (targetIds && targetIds.length > 0) {
      entIds = targetIds;
    } else {
      const { data: rows } = await admin
        .from("deliverables")
        .select("enterprise_id")
        .in("type", ["plan_financier", "valuation"]);
      const uniq = new Set<string>();
      for (const r of rows || []) {
        const id = (r as any).enterprise_id;
        if (id) uniq.add(id);
      }
      entIds = Array.from(uniq).slice(0, limit);
    }

    const results: Array<{ enterprise_id: string; status: "canonicalized" | "skipped" | "error"; version?: number; detail?: string }> = [];

    for (const enterpriseId of entIds) {
      try {
        // Charge tout ce qui sert à dériver les NOT NULL (currency, base_year)
        const [{ data: ent }, { data: delivs }] = await Promise.all([
          admin.from("enterprises").select("id, name, country, organization_id").eq("id", enterpriseId).maybeSingle(),
          admin
            .from("deliverables")
            .select("id, type, data, updated_at")
            .eq("enterprise_id", enterpriseId)
            .in("type", ["plan_financier", "valuation", "inputs_data"]),
        ]);

        const plan = (delivs || []).find((d: any) => d.type === "plan_financier") as any;
        const val = (delivs || []).find((d: any) => d.type === "valuation") as any;
        const inputs = (delivs || []).find((d: any) => d.type === "inputs_data") as any;

        if (!plan && !val) {
          results.push({ enterprise_id: enterpriseId, status: "skipped", detail: "no plan_financier nor valuation" });
          continue;
        }

        // ── Dérivation des NOT NULL (currency, currency_iso, base_year) ─────
        // Chaîne de fallback : plan.devise → plan.currency → inputs.devise → enterprise.country → "FCFA"
        const planCurr = plan?.data?.devise || plan?.data?.currency || null;
        const planCurrIso = plan?.data?.currency_iso || plan?.data?.devise || null;
        const inputsCurr = inputs?.data?.devise || inputs?.data?.currency || null;
        const country = (ent?.country || "").toLowerCase();
        let derivedCurr = planCurr || inputsCurr || null;
        let derivedCurrIso = planCurrIso || inputsCurr || null;
        if (!derivedCurr) {
          // Heuristique pays → devise
          if (country.includes("rdc") || country.includes("congo") || country.includes("kinshasa")) {
            derivedCurr = "USD";
            derivedCurrIso = "USD";
          } else if (country.includes("rwanda")) {
            derivedCurr = "RWF";
            derivedCurrIso = "RWF";
          } else if (country.includes("kenya")) {
            derivedCurr = "KES";
            derivedCurrIso = "KES";
          } else if (country.includes("nigeria")) {
            derivedCurr = "NGN";
            derivedCurrIso = "NGN";
          } else if (country.includes("ghana")) {
            derivedCurr = "GHS";
            derivedCurrIso = "GHS";
          } else {
            // Défaut UEMOA/CEMAC
            derivedCurr = "FCFA";
            derivedCurrIso = "XOF";
          }
        }
        if (!derivedCurrIso) derivedCurrIso = derivedCurr;
        const derivedBaseYear = Number(plan?.data?.base_year ?? plan?.data?.annee_base ?? inputs?.data?.annee_n ?? new Date().getFullYear());

        const planMap = plan ? mapPlanFinancierToCanonical(plan.data) : {};
        const valMap = val ? mapValuationToCanonical(val.data) : {};

        const sourceMeta = {
          plan_financier_id: plan?.id ?? null,
          plan_financier_at: plan?.updated_at ?? null,
          valuation_id: val?.id ?? null,
          valuation_at: val?.updated_at ?? null,
        };

        // Injecté systématiquement pour satisfaire les NOT NULL.
        const requiredScaffold = {
          currency: derivedCurr!,
          currency_iso: derivedCurrIso!,
          base_year: derivedBaseYear,
        };

        // 1) On écrit d'abord la couche plan_financier (avec scaffold + sa source)
        if (plan) {
          const r = await upsertCanonicalFinancials(
            admin as any,
            enterpriseId,
            { ...requiredScaffold, ...planMap, source_deliverables: sourceMeta },
            "generate-plan-financier",
          );
          if (!r.ok) {
            results.push({ enterprise_id: enterpriseId, status: "error", detail: r.error });
            continue;
          }
        }

        // 2) Puis on patche la couche valuation (avec scaffold pour le cas plan absent)
        if (val) {
          const r = await upsertCanonicalFinancials(
            admin as any,
            enterpriseId,
            { ...requiredScaffold, ...valMap, source_deliverables: sourceMeta },
            "generate-valuation",
          );
          if (!r.ok) {
            results.push({ enterprise_id: enterpriseId, status: "error", detail: r.error });
            continue;
          }
        }

        // Récupère la version finale
        const { data: row } = await admin
          .from("enterprise_financial_canonical")
          .select("version")
          .eq("enterprise_id", enterpriseId)
          .maybeSingle();
        results.push({
          enterprise_id: enterpriseId,
          status: "canonicalized",
          version: (row as any)?.version ?? null,
          detail: `plan=${!!plan} valuation=${!!val}`,
        });
        console.log(`✓ Canonicalized ${enterpriseId} version=${(row as any)?.version}`);
      } catch (e: any) {
        results.push({ enterprise_id: enterpriseId, status: "error", detail: e?.message || String(e) });
      }
    }

    const summary = {
      ok: true,
      scanned: results.length,
      canonicalized: results.filter((r) => r.status === "canonicalized").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      details: results,
    };
    return jsonResp(summary);
  } catch (e: any) {
    return jsonResp({ error: e?.message || "Unknown error" }, 500);
  }
});
