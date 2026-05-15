// auto-enrich-knowledge — Wrapper qui dispatche l'enrichissement KB vers
// esono-ai-worker-prod (Railway), puis renvoie 202 immédiat.
//
// Avant : tout le pipeline (15 appels Claude × 5-15s) tournait dans l'edge fn
// → le navigateur abandonnait au bout de ~60s ("Load failed").
// Après : l'edge fn fait juste auth + insert ai_jobs + fire-and-forget vers
// Railway. Le worker n'a pas de timeout strict → finit son cycle en arrière-plan.
// L'UI affiche un toast "lancé" et l'utilisateur recharge la page quand il veut.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    // Auth : super_admin requis (sauf appel cron sans Authorization header).
    const authHeader = req.headers.get("Authorization");
    const adminClient = createClient(supabaseUrl, serviceKey);
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user) return jsonRes({ error: "Non autorisé" }, 401);
      userId = user.id;

      const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", user.id);
      const isSuperAdmin = (roles || []).some((r: any) => r.role === "super_admin");
      if (!isSuperAdmin) return jsonRes({ error: "Super admin requis" }, 403);
    }
    // Sinon (pas d'auth) : appel cron — autorisé sans user.

    // Insère le job dans ai_jobs (status pending). Le worker le passera en running puis ready.
    const { data: job, error: jobErr } = await adminClient
      .from("ai_jobs")
      .insert({
        agent_name: "auto-enrich-knowledge",
        payload: {},
        status: "pending",
        user_id: userId,
      })
      .select("id")
      .single();
    if (jobErr || !job) return jsonRes({ error: `INSERT job: ${jobErr?.message ?? "unknown"}` }, 500);

    // POST fire-and-forget vers Railway (pas d'await)
    fetch(`${RAILWAY_AI_URL}/run-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-API-Key": RAILWAY_AI_KEY,
      },
      body: JSON.stringify({
        agent_name: "auto-enrich-knowledge",
        job_id: job.id,
        payload: {},
      }),
    }).catch((e) => {
      console.error("Worker dispatch failed:", e);
    });

    return jsonRes({
      accepted: true,
      job_id: job.id,
      message: "Enrichissement KB lancé sur le worker Railway. Patiente quelques minutes puis recharge la page.",
    }, 202);
  } catch (e: any) {
    console.error("[auto-enrich-knowledge] error:", e);
    return jsonRes({ error: e.message }, 500);
  }
});
