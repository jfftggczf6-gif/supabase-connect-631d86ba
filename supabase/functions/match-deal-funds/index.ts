// match-deal-funds — Agent IA scoring deal↔fonds.
// Dispatch vers esono-ai-worker (Railway) qui :
// 1. Charge enterprise + deal + memo IM (synthèse pour le LLM)
// 2. Charge funding_programs actifs de l'org (34 critères chacun)
// 3. Claude évalue match_score 0-100 par fonds (sector + geo + ticket + financials + ESG + thèse)
// 4. Upsert funding_matches avec match_score + criteria_met[] + criteria_missing[] + gap_analysis jsonb

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { dispatchAndForget } from "../_shared/railway-dispatch.ts";

interface RequestBody {
  deal_id: string;
  /** Optionnel : limite à ces fonds (sinon tous les actifs de l'org). */
  funding_program_ids?: string[];
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
      .select("id, organization_id, enterprise_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);
    if (!deal.enterprise_id) return errorResponse("Deal sans enterprise rattachée", 400);

    // Migration 2026-05-20 : forget pour éliminer risque 504 sur portfolio fonds étendus.
    const result = await dispatchAndForget({
      agentName: "match-deal-funds",
      payload: {
        deal_id: body.deal_id,
        enterprise_id: deal.enterprise_id,
        organization_id: deal.organization_id,
        user_id: user.id,
        funding_program_ids: body.funding_program_ids ?? null,
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
      message: "Matching IA fonds lancé — résultats dans 30-120s (toast Realtime + reload tableau)",
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
