// generate-pe-slide-payload — Wrapper qui dispatche l'agent vers le worker
// Railway esono-ai-worker (Python) puis poll ai_jobs jusqu'à completion.
//
// Le front conserve la même UX (await ~30s puis réponse) mais le calcul Claude
// tourne maintenant hors edge fn → pas de risque de timeout 400s côté Supabase.
//
// Si jamais la génération dépasse 350s côté worker, l'edge fn renvoie une
// 504 mais le job continue côté Railway. Le front pourra rejouer (le worker
// fait un short-circuit idempotent si le job est déjà ready).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

interface RequestBody {
  deal_id: string;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 350_000; // marge sous le 400s edge fn limit

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const RAILWAY_AI_URL = Deno.env.get("RAILWAY_AI_URL");
    const RAILWAY_AI_KEY = Deno.env.get("RAILWAY_AI_KEY");
    if (!RAILWAY_AI_URL || !RAILWAY_AI_KEY) {
      return errorResponse("Worker non configuré (RAILWAY_AI_URL/RAILWAY_AI_KEY)", 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // Vérifier que le user a accès au deal (RLS)
    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    // 1) Insérer le job ai_jobs
    const { data: job, error: jobErr } = await adminClient
      .from("ai_jobs")
      .insert({
        agent_name: "generate-pe-slide-payload",
        payload: { deal_id: body.deal_id },
        status: "pending",
        deal_id: body.deal_id,
        organization_id: deal.organization_id,
        user_id: user.id,
      })
      .select("id")
      .single();
    if (jobErr || !job) return errorResponse(`INSERT job: ${jobErr?.message ?? "unknown"}`, 500);

    // 2) POST vers Railway worker
    const dispatchResp = await fetch(`${RAILWAY_AI_URL}/run-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-API-Key": RAILWAY_AI_KEY,
      },
      body: JSON.stringify({
        agent_name: "generate-pe-slide-payload",
        job_id: job.id,
        payload: { deal_id: body.deal_id },
      }),
    });
    if (!dispatchResp.ok) {
      const txt = await dispatchResp.text();
      return errorResponse(`Worker dispatch failed (${dispatchResp.status}): ${txt}`, 502);
    }

    // 3) Poll ai_jobs jusqu'à completion ou timeout
    const startedAt = Date.now();
    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data: row } = await adminClient
        .from("ai_jobs")
        .select("status, result, error_message, error_kind")
        .eq("id", job.id)
        .single();

      if (!row) continue;

      if (row.status === "ready") {
        // Lire la version mise à jour pour répondre comme l'ancienne edge fn
        const { data: memo } = await adminClient
          .from("investment_memos")
          .select("id")
          .eq("deal_id", body.deal_id)
          .maybeSingle();
        const { data: versions } = await adminClient
          .from("memo_versions")
          .select("id, slide_payload")
          .eq("memo_id", memo?.id ?? "")
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(1);
        const v = versions?.[0];
        return jsonResponse({
          success: true,
          version_id: v?.id,
          slide_payload: v?.slide_payload,
          job_id: job.id,
          duration_ms: Date.now() - startedAt,
        });
      }

      if (row.status === "error") {
        return errorResponse(
          `Worker error (${row.error_kind ?? "unknown"}): ${row.error_message ?? "no message"}`,
          500,
        );
      }
    }

    // Timeout côté edge fn — le job continue côté worker, le front peut retry
    return new Response(
      JSON.stringify({
        error: "Polling timeout — la génération continue en arrière-plan, réessaie dans 1-2 min",
        job_id: job.id,
      }),
      { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error(`[generate-pe-slide-payload] error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
