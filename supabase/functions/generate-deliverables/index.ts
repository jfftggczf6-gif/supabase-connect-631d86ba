import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pipeline: sequential agents in order
const PIPELINE_STEPS = [
  { name: "BMC", function: "generate-bmc" },
  { name: "SIC", function: "generate-sic" },
  { name: "Inputs", function: "generate-inputs" },
  { name: "Framework", function: "generate-framework" },
  { name: "Diagnostic", function: "generate-diagnostic" },
  { name: "Plan OVO", function: "generate-plan-ovo" },
  { name: "Business Plan", function: "generate-business-plan" },
  { name: "ODD", function: "generate-odd" },
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

    // Check which modules already have rich data (skip them)
    const { data: existingDeliverables } = await supabase
      .from("deliverables")
      .select("type, data")
      .eq("enterprise_id", enterprise_id);

    const richTypes = new Set(
      (existingDeliverables || [])
        .filter((d: any) => d.data && typeof d.data === "object" && (d.data.canvas || d.data.theorie_changement || d.data.compte_resultat || d.data.ratios || d.data.diagnostic_par_dimension || d.data.scenarios || d.data.resume_executif || d.data.checklist))
        .map((d: any) => d.type)
    );

    // Map function names to deliverable types for skip check
    const fnToDelivType: Record<string, string> = {
      "generate-bmc": "bmc_analysis",
      "generate-sic": "sic_analysis",
      "generate-inputs": "inputs_data",
      "generate-framework": "framework_data",
      "generate-diagnostic": "diagnostic_data",
      "generate-plan-ovo": "plan_ovo",
      "generate-business-plan": "business_plan",
      "generate-odd": "odd_analysis",
    };

    const results: { step: string; success: boolean; score?: number; skipped?: boolean; error?: string }[] = [];
    let completedCount = 0;
    let creditError = false;

    // Run pipeline sequentially
    for (const step of PIPELINE_STEPS) {
      const delivType = fnToDelivType[step.function];
      
      // Skip if rich data already exists (unless force=true)
      if (!force && delivType && richTypes.has(delivType)) {
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

      // Small delay between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }

    // If credit error, return specific error response
    if (creditError && completedCount === 0) {
      return new Response(JSON.stringify({
        error: "Crédits IA insuffisants. Veuillez recharger vos crédits dans Settings → Workspace → Usage.",
        credit_error: true,
        results,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate global score
    const scores = results.filter(r => r.success && r.score).map(r => r.score!);
    const globalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

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
