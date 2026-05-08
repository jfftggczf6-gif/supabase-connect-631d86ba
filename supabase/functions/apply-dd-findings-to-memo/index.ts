// apply-dd-findings-to-memo — Wrapper dispatch vers esono-ai-worker (Railway).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { dispatchAndForget } from "../_shared/railway-dispatch.ts";

interface RequestBody {
  deal_id: string;
  finding_ids?: string[];
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
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    const result = await dispatchAndForget({
      agentName: "apply-dd-findings-to-memo",
      payload: {
        deal_id: body.deal_id,
        finding_ids: body.finding_ids ?? null,
        user_id: user.id,
      },
      userId: user.id,
      organizationId: deal.organization_id,
      dealId: body.deal_id,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return jsonResponse({
      accepted: true,
      job_id: result.job_id,
      message: "Application findings DD lancée sur Railway. Le memo passera en stage note_ic_finale quand prêt.",
    }, 202);
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
