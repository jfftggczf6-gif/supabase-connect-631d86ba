// generate-ic1-memo — Wrapper qui dispatche vers esono-ai-worker (Railway).
//
// Avant : 12 sections en parallèle dans l'edge fn → 2-5 min, risque timeout 400s.
// Après : fire-and-forget vers Railway worker (pas de timeout), retourne 202 immédiat.
// Le front écoute memo_versions en Realtime (usePeGenerationStatus) pour voir le statut live.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { dispatchAndForget } from "../_shared/railway-dispatch.ts";

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

    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    const result = await dispatchAndForget({
      agentName: "generate-ic1-memo",
      payload: {
        deal_id: body.deal_id,
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
      message: "IC1 enrichment lancé sur Railway. Le memo passera en stage note_ic1 quand prêt (suivi via Realtime).",
    }, 202);
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
