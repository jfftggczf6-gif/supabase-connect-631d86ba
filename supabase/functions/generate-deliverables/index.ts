import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pipeline: sequential agents in order
const PIPELINE_STEPS = [
  { name: "Pre-screening", function: "generate-pre-screening" },
  { name: "BMC", function: "generate-bmc" },
  { name: "SIC", function: "generate-sic" },
  { name: "Inputs", function: "generate-inputs" },
  { name: "Framework", function: "generate-framework" },
  { name: "Plan OVO", function: "generate-plan-ovo" },
  { name: "Excel OVO", function: "generate-ovo-plan" },
  { name: "Business Plan", function: "generate-business-plan" },
  { name: "ODD", function: "generate-odd" },
  { name: "Diagnostic", function: "generate-diagnostic" },
  { name: "Screening", function: "generate-screening-report" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { enterprise_id, force } = await req.json();
    if (!enterprise_id) {
      return new Response(JSON.stringify({ error: "enterprise_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user ownership
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
    if (!ent || (ent.user_id !== user.id && ent.coach_id !== user.id)) {
      return new Response(JSON.stringify({ error: "Enterprise not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check which modules already have rich AND up-to-date data (skip them)
    const { data: existingDeliverables } = await supabase
      .from("deliverables")
      .select("type, data, updated_at")
      .eq("enterprise_id", enterprise_id);

    const sourceDate = new Date(ent.updated_at || 0).getTime();
    const toNumber = (v: any) => { const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : Number(v); return isNaN(n) ? 0 : n; };

    const CALC_VERSION = 2;
    const isRich = (d: any): boolean => {
      if (!d.data || typeof d.data !== "object") return false;
      if (d.type === "inputs_data") return d.data.compte_resultat && toNumber(d.data.compte_resultat.chiffre_affaires) > 0;
      if (d.type === "odd_analysis") return d.data.evaluation_cibles_odd || d.data.synthese;
      if (d.type === "plan_ovo") {
        if (!d.data.scenarios) return false;
        const ver = d.data.metadata?.calculation_version ?? 0;
        if (ver < CALC_VERSION) return false;
        return true;
      }
      return (d.data.canvas || d.data.theorie_changement || d.data.compte_resultat || d.data.ratios || d.data.diagnostic_par_dimension || d.data.scenarios || d.data.checklist);
    };

    // A deliverable is "up to date" only if it's rich AND more recent than the enterprise source
    const upToDateTypes = new Set(
      (existingDeliverables || [])
        .filter((d: any) => isRich(d) && new Date(d.updated_at).getTime() >= sourceDate)
        .map((d: any) => d.type)
    );

    // Map function names to deliverable types for skip check
    const fnToDelivType: Record<string, string> = {
      "generate-pre-screening": "pre_screening",
      "generate-bmc": "bmc_analysis",
      "generate-sic": "sic_analysis",
      "generate-inputs": "inputs_data",
      "generate-framework": "framework_data",
      "generate-diagnostic": "diagnostic_data",
      "generate-plan-ovo": "plan_ovo",
      "generate-ovo-plan": "plan_ovo_excel",
      "generate-business-plan": "business_plan",
      "generate-odd": "odd_analysis",
      "generate-screening-report": "screening_report",
    };

    // Financial steps that require real inputs data (score > 0)
    const FINANCIAL_STEPS = new Set(["generate-framework", "generate-plan-ovo"]);

    const results: { step: string; success: boolean; score?: number; skipped?: boolean; error?: string }[] = [];
    let completedCount = 0;
    let creditError = false;
    let inputsScoreZero = false; // Track if inputs has no financial data

    // Run pipeline sequentially
    for (const step of PIPELINE_STEPS) {
      const delivType = fnToDelivType[step.function];
      
      // Skip financial steps if inputs has no real financial data
      if (inputsScoreZero && FINANCIAL_STEPS.has(step.function)) {
        console.log(`Skipping ${step.name}: pas de données financières réelles`);
        results.push({ step: step.name, success: true, skipped: true, error: "Pas de données financières — module ignoré" });
        completedCount++;
        continue;
      }
      
      // Never skip generate-ovo-plan — it must always run to keep Excel in sync
      const isAlwaysRun = step.function === "generate-ovo-plan";
      
      // Skip if rich data already exists (unless force=true or always-run step)
      if (!force && !isAlwaysRun && delivType && upToDateTypes.has(delivType)) {
        console.log(`Skipping ${step.name}: rich data already exists`);
        results.push({ step: step.name, success: true, skipped: true });
        completedCount++;
        continue;
      }

      try {
        console.log(`Running ${step.name}...`);
        const response = await fetch(`${supabaseUrl}/functions/v1/${step.function}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ enterprise_id }),
        });

        if (response.ok) {
          const result = await response.json();
          results.push({ step: step.name, success: true, score: result.score });
          completedCount++;
          // Detect empty inputs (no financial data) to skip downstream financial steps
          if (step.function === "generate-inputs" && (result.score === 0 || !result.score)) {
            inputsScoreZero = true;
            console.log("generate-inputs returned score 0 — will skip financial modules");
          }
        } else {
          const err = await response.json().catch(() => ({ error: "Unknown" }));
          console.error(`${step.name} failed:`, err);
          
          // Detect credit/rate limit errors and stop pipeline immediately
          if (response.status === 402 || err.error?.includes('Crédits') || err.error?.includes('insuffisants')) {
            creditError = true;
            results.push({ step: step.name, success: false, error: err.error });
            break; // No point continuing if credits are exhausted
          }
          if (response.status === 429) {
            results.push({ step: step.name, success: false, error: "Limite de requêtes atteinte, réessayez plus tard." });
            break;
          }
          
          results.push({ step: step.name, success: false, error: err.error });
        }
      } catch (e) {
        console.error(`${step.name} error:`, e);
        results.push({ step: step.name, success: false, error: e instanceof Error ? e.message : "Unknown" });
      }

      // No artificial delay — rate limiting handled by retry logic in each function
    }

    // If credit error, return specific error response
    if (creditError && completedCount === 0) {
      return new Response(JSON.stringify({
        error: "Crédits IA insuffisants. Veuillez recharger vos crédits dans Settings → Workspace → Usage.",
        credit_error: true,
        results,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate global score: merge fresh results with existing DB scores for skipped steps
    const scoresDetail: Record<string, number> = {};
    
    // 1. Fresh scores from this run
    results.forEach(r => { if (r.success && r.score) scoresDetail[r.step] = r.score; });
    
    // 2. Fetch ALL existing deliverable scores from DB (covers skipped steps)
    const { data: allDeliverables } = await supabase
      .from("deliverables")
      .select("type, score")
      .eq("enterprise_id", enterprise_id)
      .not("score", "is", null);
    
    // Map deliverable types to step names for merging
    const delivTypeToStep: Record<string, string> = {
      "pre_screening": "Pre-screening",
      "bmc_analysis": "BMC",
      "sic_analysis": "SIC",
      "inputs_data": "Inputs",
      "framework_data": "Framework",
      "plan_ovo": "Plan OVO",
      "business_plan": "Business Plan",
      "odd_analysis": "ODD",
      "diagnostic_data": "Diagnostic",
      "screening_report": "Screening",
    };
    
    // Fill in scores from DB for steps not already in scoresDetail
    (allDeliverables || []).forEach((d: any) => {
      const stepName = delivTypeToStep[d.type];
      if (stepName && !scoresDetail[stepName] && d.score > 0) {
        scoresDetail[stepName] = Number(d.score);
      }
    });
    
    const allScores = Object.values(scoresDetail);
    const globalScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

    // Update score_ir on enterprise
    if (globalScore > 0) {
      await supabase.from("enterprises").update({ score_ir: globalScore }).eq("id", enterprise_id);
    }

    // Insert score history entry
    if (globalScore > 0) {
      await supabase.from("score_history").insert({
        enterprise_id,
        score: globalScore,
        scores_detail: scoresDetail,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      global_score: globalScore,
      deliverables_count: completedCount,
      results,
      ...(creditError ? { warning: "Certains modules n'ont pas pu être générés : crédits IA insuffisants." } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-deliverables error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
