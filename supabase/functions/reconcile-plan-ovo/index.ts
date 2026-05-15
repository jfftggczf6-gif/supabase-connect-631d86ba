import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceFrameworkConstraints } from "../_shared/normalizers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Lightweight reconciliation function (no AI call, 0 credits).
 * Reloads the latest plan_ovo and framework_data from DB,
 * reapplies enforceFrameworkConstraints, and saves the updated plan_ovo.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { enterprise_id } = await req.json();
    if (!enterprise_id) {
      return new Response(JSON.stringify({ error: "enterprise_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user ownership
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ent } = await supabase.from("enterprises").select("id, user_id, coach_id, country, organization_id").eq("id", enterprise_id).single();
    if (!ent) {
      return new Response(JSON.stringify({ error: "Enterprise not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Permission : owner / legacy coach_id / coach n-to-n actif / org manager
    let _allowed = ent.user_id === user.id || ent.coach_id === user.id;
    if (!_allowed) {
      const { data: a } = await supabase.from("enterprise_coaches")
        .select("id").eq("enterprise_id", enterprise_id).eq("coach_id", user.id).eq("is_active", true).maybeSingle();
      _allowed = !!a;
    }
    if (!_allowed && ent.organization_id) {
      const { data: m } = await supabase.from("organization_members")
        .select("role").eq("user_id", user.id).eq("organization_id", ent.organization_id).eq("is_active", true).maybeSingle();
      _allowed = !!m && ['owner', 'admin', 'manager'].includes(m.role);
    }
    if (!_allowed) {
      return new Response(JSON.stringify({ error: "Enterprise not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load plan_ovo and framework_data
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("type, data, id")
      .eq("enterprise_id", enterprise_id)
      .in("type", ["plan_ovo", "framework_data", "inputs_data"])
      .order("updated_at", { ascending: false });

    const planOvoRow = deliverables?.find((d: any) => d.type === "plan_ovo");
    const frameworkRow = deliverables?.find((d: any) => d.type === "framework_data");
    const inputsRow = deliverables?.find((d: any) => d.type === "inputs_data");

    if (!planOvoRow?.data || !frameworkRow?.data) {
      console.log("[reconcile-plan-ovo] Missing plan_ovo or framework_data, skipping.");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Missing plan_ovo or framework_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const country = ent.country || '';
    console.log("[reconcile-plan-ovo] Reconciling plan_ovo with latest framework_data...");

    // Reapply framework constraints
    const reconciled = enforceFrameworkConstraints(
      planOvoRow.data,
      frameworkRow.data,
      inputsRow?.data || undefined,
      country,
    );

    // Save back
    const { error: updateErr } = await supabase
      .from("deliverables")
      .update({ data: reconciled, updated_at: new Date().toISOString() })
      .eq("id", planOvoRow.id);

    if (updateErr) {
      console.error("[reconcile-plan-ovo] Update error:", updateErr);
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[reconcile-plan-ovo] Successfully reconciled plan_ovo.");
    return new Response(JSON.stringify({ success: true, score: reconciled.score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[reconcile-plan-ovo] error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
