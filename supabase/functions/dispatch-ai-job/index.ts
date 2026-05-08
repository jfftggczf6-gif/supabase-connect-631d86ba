// dispatch-ai-job — Dispatcher universel pour les agents IA hébergés sur
// esono-ai-worker (Railway). Permet aux features front d'invoquer un agent
// long sans risque de timeout edge fn.
//
// Flow :
//   1. Insère un job dans ai_jobs (status=pending)
//   2. POST fire-and-forget /run-agent vers le worker (~10ms)
//   3. Retourne { job_id } au navigateur immédiatement
//
// Le front écoute ai_jobs en Realtime pour suivre l'avancement.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  agent_name: string;
  payload?: Record<string, unknown>;
  deal_id?: string;
  candidature_id?: string;
  memo_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RAILWAY_AI_URL = Deno.env.get("RAILWAY_AI_URL");
    const RAILWAY_AI_KEY = Deno.env.get("RAILWAY_AI_KEY");
    if (!RAILWAY_AI_URL || !RAILWAY_AI_KEY) {
      return new Response(
        JSON.stringify({ error: "Worker non configuré (RAILWAY_AI_URL/RAILWAY_AI_KEY manquants)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Vérifier le JWT user pour récupérer user_id + organization_id
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid JWT" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    if (!body.agent_name) {
      return new Response(JSON.stringify({ error: "agent_name requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Org de l'utilisateur (première org active)
    const { data: orgRow } = await userClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1).single();

    // Insère le job avec service role (pour bypass RLS sur INSERT)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job, error: jobErr } = await adminClient
      .from("ai_jobs")
      .insert({
        agent_name: body.agent_name,
        payload: body.payload ?? {},
        status: "pending",
        deal_id: body.deal_id ?? null,
        candidature_id: body.candidature_id ?? null,
        memo_id: body.memo_id ?? null,
        organization_id: orgRow?.organization_id ?? null,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: `INSERT job: ${jobErr?.message ?? "unknown"}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST fire-and-forget vers Railway (pas d'await sur la promesse)
    fetch(`${RAILWAY_AI_URL}/run-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-API-Key": RAILWAY_AI_KEY,
      },
      body: JSON.stringify({
        agent_name: body.agent_name,
        job_id: job.id,
        payload: body.payload ?? {},
      }),
    }).catch((e) => {
      // Si fire-and-forget échoue, on log mais le user a déjà sa réponse.
      // Le job restera en 'pending' — on pourra rejouer manuellement.
      console.error("Worker dispatch failed:", e);
    });

    return new Response(JSON.stringify({ ok: true, job_id: job.id, status: "pending" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
