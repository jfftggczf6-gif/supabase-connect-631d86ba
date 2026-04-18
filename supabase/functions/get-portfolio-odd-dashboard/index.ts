// Feature I1 — Portfolio ODD Dashboard: data aggregation (NO AI)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, jsonResponse, errorResponse,
} from "../_shared/helpers_v5.ts";
import { OVO_IMPACT_KPIS, OVO_FOCUS_SDGS } from "../_shared/ovo-knowledge.ts";

serve(async (req) => {
  console.log("[get-portfolio-odd-dashboard] loaded");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Non autorisé", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return errorResponse("Non autorisé", 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Role check
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const role = roleData?.role;
    if (!["super_admin", "admin", "manager", "owner"].includes(role)) {
      return errorResponse("Accès réservé aux propriétaires, admins et managers", 403);
    }

    const { programme_id } = await req.json();
    if (!programme_id) return errorResponse("programme_id requis", 400);

    // Get programme
    const { data: programme } = await supabase.from("programmes").select("id, name, status").eq("id", programme_id).single();
    if (!programme) return errorResponse("Programme non trouvé", 404);

    // Get selected candidatures -> enterprise_ids
    const { data: candidatures } = await supabase
      .from("candidatures")
      .select("enterprise_id")
      .eq("programme_id", programme_id)
      .eq("status", "selected");

    const enterpriseIds = (candidatures || []).map(c => c.enterprise_id).filter(Boolean);

    if (!enterpriseIds.length) {
      return jsonResponse({
        success: true,
        programme: { name: programme.name, status: programme.status },
        kpis: OVO_IMPACT_KPIS.map(k => ({ ...k, value: 0, enterprises_with_data: 0 })),
        odd_coverage: OVO_FOCUS_SDGS.map(s => ({ ...s, enterprises_count: 0, enterprises: [] })),
        enterprises_count: 0,
        evolution: [],
      });
    }

    // Batch fetch enterprises + relevant deliverables
    const [entRes, oddRes, planFinRes, baselineRes] = await Promise.all([
      supabase.from("enterprises").select("id, name, sector, country, employees_count").in("id", enterpriseIds),
      supabase.from("deliverables").select("enterprise_id, data, score").in("enterprise_id", enterpriseIds).eq("type", "odd_analysis"),
      supabase.from("deliverables").select("enterprise_id, data, score").in("enterprise_id", enterpriseIds).eq("type", "plan_financier"),
      supabase.from("deliverables").select("enterprise_id, data, score").in("enterprise_id", enterpriseIds).eq("type", "odd_baseline"),
    ]);

    const enterprises = entRes.data || [];
    const oddDeliverables = oddRes.data || [];
    const planFinDeliverables = planFinRes.data || [];
    const baselineDeliverables = baselineRes.data || [];

    // Build maps
    const oddMap: Record<string, any> = {};
    for (const d of oddDeliverables) oddMap[d.enterprise_id] = d.data;

    const planFinMap: Record<string, any> = {};
    for (const d of planFinDeliverables) planFinMap[d.enterprise_id] = d.data;

    const baselineMap: Record<string, any> = {};
    for (const d of baselineDeliverables) baselineMap[d.enterprise_id] = d.data;

    // ═══ AGGREGATE KPIs ═══
    let totalDecentJobs = 0;
    let totalDecentJobsWomen = 0;
    let totalDecentJobsYouth = 0;
    let totalMargeBrute = 0;
    let totalEmplois = 0;
    let totalWasteReduction = 0;
    let wasteCount = 0;
    let totalPartnershipsTaxes = 0;

    const entWithDecentJobs: string[] = [];
    const entWithWomen: string[] = [];
    const entWithYouth: string[] = [];
    const entWithMargin: string[] = [];
    const entWithWaste: string[] = [];
    const entWithTaxes: string[] = [];

    // ODD coverage tracking
    const oddCoverageMap: Record<number, { enterprises: string[] }> = {};
    for (const sdg of OVO_FOCUS_SDGS) {
      oddCoverageMap[sdg.sdg] = { enterprises: [] };
    }

    for (const ent of enterprises) {
      const pf = planFinMap[ent.id];
      const odd = oddMap[ent.id];

      // decent_jobs_total: from plan_financier effectif or enterprise employees_count
      const effectif = pf?.effectifs?.total || pf?.effectif_total || pf?.emplois_total || ent.employees_count || 0;
      if (effectif > 0) {
        totalDecentJobs += effectif;
        entWithDecentJobs.push(ent.id);
      }

      // decent_jobs_women: from odd_analysis
      if (odd) {
        const womenJobs = odd.emplois_femmes || odd.decent_jobs_women || odd.jobs_women || 0;
        if (womenJobs > 0) {
          totalDecentJobsWomen += womenJobs;
          entWithWomen.push(ent.id);
        }

        const youthJobs = odd.emplois_jeunes || odd.decent_jobs_youth || odd.jobs_youth || 0;
        if (youthJobs > 0) {
          totalDecentJobsYouth += youthJobs;
          entWithYouth.push(ent.id);
        }

        // waste_reduction
        const waste = odd.waste_reduction || odd.dechets_reduits || 0;
        if (waste > 0) {
          totalWasteReduction += waste;
          wasteCount++;
          entWithWaste.push(ent.id);
        }

        // ODD coverage: check which SDGs are addressed
        const sdgsAddressed = odd.sdgs || odd.odds || odd.objectifs_dd || [];
        if (Array.isArray(sdgsAddressed)) {
          for (const sdg of sdgsAddressed) {
            const sdgNum = typeof sdg === "number" ? sdg : (sdg?.sdg || sdg?.numero || parseInt(sdg));
            if (oddCoverageMap[sdgNum]) {
              oddCoverageMap[sdgNum].enterprises.push(ent.name);
            }
          }
        }
      }

      // gross_margin: from plan_financier
      if (pf) {
        const margeBrute = pf.marge_brute || pf.gross_margin || pf.compte_resultat?.marge_brute || 0;
        if (margeBrute > 0 && effectif > 0) {
          totalMargeBrute += margeBrute;
          totalEmplois += effectif;
          entWithMargin.push(ent.id);
        }

        // partnerships_taxes: cotisations + impots
        const cotisations = pf.cotisations_sociales || pf.charges_sociales || pf.cotisations || 0;
        const impots = pf.impots || pf.impot_societe || pf.taxes || 0;
        const taxTotal = cotisations + impots;
        if (taxTotal > 0) {
          totalPartnershipsTaxes += taxTotal;
          entWithTaxes.push(ent.id);
        }
      }
    }

    const grossMarginPerEmployee = totalEmplois > 0 ? Math.round(totalMargeBrute / totalEmplois) : 0;

    // Build KPIs output
    const kpis = [
      {
        ...OVO_IMPACT_KPIS[0], // decent_jobs_total
        value: totalDecentJobs,
        enterprises_with_data: entWithDecentJobs.length,
      },
      {
        ...OVO_IMPACT_KPIS[1], // decent_jobs_women
        value: totalDecentJobsWomen,
        enterprises_with_data: entWithWomen.length,
      },
      {
        ...OVO_IMPACT_KPIS[2], // decent_jobs_youth
        value: totalDecentJobsYouth,
        enterprises_with_data: entWithYouth.length,
      },
      {
        ...OVO_IMPACT_KPIS[3], // gross_margin_per_employee
        value: grossMarginPerEmployee,
        enterprises_with_data: entWithMargin.length,
      },
      {
        ...OVO_IMPACT_KPIS[4], // waste_reduction
        value: wasteCount > 0 ? Math.round(totalWasteReduction / wasteCount) : 0,
        enterprises_with_data: entWithWaste.length,
      },
      {
        ...OVO_IMPACT_KPIS[5], // partnerships_taxes
        value: totalPartnershipsTaxes,
        enterprises_with_data: entWithTaxes.length,
      },
    ];

    // ODD coverage
    const oddCoverage = OVO_FOCUS_SDGS.map(sdg => ({
      sdg: sdg.sdg,
      goal: sdg.goal,
      ovo_goal: sdg.ovo_goal,
      enterprises_count: oddCoverageMap[sdg.sdg]?.enterprises.length || 0,
      enterprises: oddCoverageMap[sdg.sdg]?.enterprises || [],
    }));

    // ═══ EVOLUTION (Y-o-Y delta from baseline) ═══
    const evolution: any[] = [];
    for (const ent of enterprises) {
      const baseline = baselineMap[ent.id];
      const pf = planFinMap[ent.id];
      const odd = oddMap[ent.id];

      if (!baseline) continue;

      const currentJobs = pf?.effectifs?.total || pf?.effectif_total || ent.employees_count || 0;
      const baselineJobs = baseline.effectifs?.total || baseline.effectif_total || baseline.decent_jobs_total || 0;

      const currentMargin = pf?.marge_brute || pf?.gross_margin || 0;
      const baselineMargin = baseline.marge_brute || baseline.gross_margin || 0;

      if (baselineJobs > 0 || baselineMargin > 0) {
        evolution.push({
          enterprise_id: ent.id,
          enterprise_name: ent.name,
          jobs_baseline: baselineJobs,
          jobs_current: currentJobs,
          jobs_delta: currentJobs - baselineJobs,
          jobs_delta_pct: baselineJobs > 0 ? Math.round(((currentJobs - baselineJobs) / baselineJobs) * 100) : null,
          margin_baseline: baselineMargin,
          margin_current: currentMargin,
          margin_delta: currentMargin - baselineMargin,
          margin_delta_pct: baselineMargin > 0 ? Math.round(((currentMargin - baselineMargin) / baselineMargin) * 100) : null,
        });
      }
    }

    console.log(`[portfolio-odd-dashboard] Done: ${enterprises.length} enterprises, ${oddDeliverables.length} ODD analyses`);
    return jsonResponse({
      success: true,
      programme: { name: programme.name, status: programme.status },
      kpis,
      odd_coverage: oddCoverage,
      enterprises_count: enterprises.length,
      evolution,
    });

  } catch (e: any) {
    console.error("[get-portfolio-odd-dashboard] error:", e);
    return errorResponse(e.message || "Erreur interne", e.status || 500);
  }
});
