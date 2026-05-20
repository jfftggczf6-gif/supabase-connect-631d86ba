// regenerate-pe-section — Wrapper qui dispatche vers esono-ai-worker (Railway).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { dispatchAndForget } from "../_shared/railway-dispatch.ts";

interface RequestBody {
  deal_id: string;
  section_code: string;
  /** 'pe' (défaut) = section IC1 · 'ba' = section IM vendeur Equity story */
  tone?: 'pe' | 'ba';
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id || !body.section_code) {
      return errorResponse("deal_id and section_code required", 400);
    }

    // Vérifier accès deal (RLS)
    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    // Migration 2026-05-20 : dispatchAndForget pour éliminer risque 504.
    const result = await dispatchAndForget({
      agentName: "regenerate-pe-section",
      payload: {
        deal_id: body.deal_id,
        section_code: body.section_code,
        user_id: user.id,
        tone: body.tone ?? 'pe',
      },
      userId: user.id,
      organizationId: deal.organization_id,
      dealId: body.deal_id,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error, job_id: result.job_id }), {
        status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      accepted: true,
      job_id: result.job_id,
      message: `Section ${body.section_code} relancée — résultat dans 20-60s via Realtime ai_jobs`,
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
