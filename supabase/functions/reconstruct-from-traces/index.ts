// v5 (dispatch Railway) — 2026-05-20
// reconstruct-from-traces : router fin → dispatch vers esono-ai-worker prod
// (agent reconstruct-enterprise). L'EF retourne immédiatement { job_id }
// et le front poll ai_jobs.status toutes les 2s.
//
// Motivation : avec >120K chars de document_content cumulé, Claude prenait
// >150s → proxy Supabase coupait la connection → "Failed to fetch" côté
// browser. Railway worker n'a pas ce timeout (wall-clock illimité).
//
// Pattern identique aux 14 agents PE/BA déjà migrés (auto-enrich-knowledge,
// generate-ic1-memo, screen-candidatures, match-deal-funds, etc.).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, verifyAndGetContext } from "../_shared/helpers_v5.ts";

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RAILWAY_AI_URL = Deno.env.get("RAILWAY_AI_URL");
    const RAILWAY_AI_KEY = Deno.env.get("RAILWAY_AI_KEY");
    if (!RAILWAY_AI_URL || !RAILWAY_AI_KEY) {
      return jsonRes({ error: "Worker non configuré (RAILWAY_AI_URL/RAILWAY_AI_KEY)" }, 500);
    }

    // 1. Auth + récup enterprise (helpers_v5 fait check owner/coach/org)
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    if (!ctx.documentContent || ctx.documentContent.trim().length < 50) {
      return jsonRes({
        error: "Aucun contenu documentaire. Veuillez d'abord uploader et analyser des documents.",
      }, 400);
    }

    // 2. Insert ai_jobs (status: pending)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: job, error: jobErr } = await adminClient
      .from("ai_jobs")
      .insert({
        agent_name: "reconstruct-enterprise",
        payload: { enterprise_id: ctx.enterprise_id },
        status: "pending",
        user_id: ctx.user.id,
        organization_id: (ent as any).organization_id ?? null,
      })
      .select("id")
      .single();
    if (jobErr || !job) {
      return jsonRes({ error: `INSERT ai_jobs: ${jobErr?.message ?? "unknown"}` }, 500);
    }

    // 3. Dispatch fire-and-forget vers Railway worker
    fetch(`${RAILWAY_AI_URL}/run-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-API-Key": RAILWAY_AI_KEY,
      },
      body: JSON.stringify({
        agent_name: "reconstruct-enterprise",
        job_id: job.id,
        payload: { enterprise_id: ctx.enterprise_id },
      }),
    }).catch((e) => {
      console.error("[reconstruct-from-traces] Worker dispatch failed:", e);
    });

    // 4. Retour immédiat
    return jsonRes({
      accepted: true,
      job_id: job.id,
      message: "Reconstruction lancée sur le worker Railway. Le front va poller ai_jobs pour récupérer le résultat.",
    }, 202);
  } catch (e: any) {
    console.error("reconstruct-from-traces error:", e);
    return jsonRes({ error: e.message || "Erreur" }, e.status || 500);
  }
});
