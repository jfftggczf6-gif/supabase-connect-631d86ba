// generate-pe-pre-screening — Wrapper qui dispatche vers esono-ai-worker (Railway).
//
// Cas d'usage le plus à risque de timeout : 12 sections en parallèle, multi-docs.
// Sur Railway pas de limite ; côté edge fn on poll jusqu'à 350s puis on renvoie
// 504 (mais le job continue côté worker, le front peut retry idempotent).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { dispatchAndForget } from "../_shared/railway-dispatch.ts";

interface RequestBody {
  deal_id: string;
  /** 'pe' (défaut) = ton analytique comité d'invest · 'ba' = ton vendeur Equity story */
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
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // Vérifier accès deal (RLS)
    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    // Migration 2026-05-20 : dispatchAndPoll → dispatchAndForget (retour 202
    // immédiat). Le front écoute ai_jobs via AiJobsLiveToast/Realtime ;
    // PreScreening360Dashboard reload sa version 30-60s après le toast.
    const result = await dispatchAndForget({
      agentName: "generate-pe-pre-screening",
      payload: {
        deal_id: body.deal_id,
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
      message: "Pré-screening 360° lancé — résultat dans 60-180s via Realtime ai_jobs",
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
