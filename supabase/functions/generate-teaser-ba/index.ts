// generate-teaser-ba — Génère un teaser anonymisé BA à partir du Memo IM vendeur.
// Dispatch vers esono-ai-worker (Railway) qui :
// 1. Charge memo_sections (12 sections IM)
// 2. Anonymise : nom entité → "PROJET XXX", clients nommés → générique, géo précise → métropole UEMOA
// 3. Génère TeaserPayload (8 sections + warnings) selon src/types/teaser-ba.ts
// 4. Upsert deliverables (type='teaser_anonymise', data.teaser_payload jsonb)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { dispatchAndPoll } from "../_shared/railway-dispatch.ts";

interface RequestBody {
  deal_id: string;
  /** Force un code_name custom (sinon random PROJET ALPHA…JALOUSIE). */
  code_name?: string;
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

    const result = await dispatchAndPoll({
      agentName: "generate-teaser-ba",
      payload: {
        deal_id: body.deal_id,
        enterprise_id: deal.enterprise_id,
        organization_id: deal.organization_id,
        user_id: user.id,
        code_name: body.code_name ?? null,
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

    return jsonResponse({
      success: true,
      deliverable_id: result.result?.deliverable_id,
      code_name: result.result?.code_name,
      warnings_count: result.result?.warnings_count,
      duration_ms: result.duration_ms,
      job_id: result.job_id,
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
