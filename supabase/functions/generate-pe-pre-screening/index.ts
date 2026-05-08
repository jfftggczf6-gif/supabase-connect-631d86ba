// generate-pe-pre-screening — Wrapper qui dispatche vers esono-ai-worker (Railway).
//
// Cas d'usage le plus à risque de timeout : 12 sections en parallèle, multi-docs.
// Sur Railway pas de limite ; côté edge fn on poll jusqu'à 350s puis on renvoie
// 504 (mais le job continue côté worker, le front peut retry idempotent).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { dispatchAndPoll } from "../_shared/railway-dispatch.ts";

interface RequestBody {
  deal_id: string;
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

    // Vérifier accès deal (RLS)
    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    const result = await dispatchAndPoll({
      agentName: "generate-pe-pre-screening",
      payload: {
        deal_id: body.deal_id,
        user_id: user.id,
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

    const r = result.result ?? {};
    return jsonResponse({
      success: true,
      memo_id: r.memo_id,
      version_id: r.version_id,
      overall_score: r.overall_score,
      classification: r.classification,
      sections_generated: r.sections_generated,
      sections_failed: r.sections_failed,
      duration_ms: result.duration_ms,
      job_id: result.job_id,
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
