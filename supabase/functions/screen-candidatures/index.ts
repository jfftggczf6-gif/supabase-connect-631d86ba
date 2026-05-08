// screen-candidatures — Wrapper qui dispatche vers esono-ai-worker-prod
// (Railway) puis renvoie 202 immédiat. Le worker update chaque candidature
// au fur et à mesure ; le front voit les scores arriver via Realtime/polling.
//
// Avant : tout le pipeline (parsing 22 docs + Claude) tournait dans l'edge fn
// → timeout 400s sur les gros dossiers (FOODSEN avec 22 docs).
// Après : l'edge fn fait juste auth + insert ai_job + fire-and-forget vers
// Railway. Le worker n'a pas de timeout strict.

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

interface RequestBody {
  programme_id: string;
  candidature_ids?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RAILWAY_AI_URL = Deno.env.get("RAILWAY_AI_URL");
    const RAILWAY_AI_KEY = Deno.env.get("RAILWAY_AI_KEY");
    if (!RAILWAY_AI_URL || !RAILWAY_AI_KEY) {
      return jsonRes({ error: "Worker non configuré (RAILWAY_AI_URL/RAILWAY_AI_KEY)" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey);

    const body: RequestBody = await req.json();
    if (!body.programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    // Check role (legacy + org) — sécurité héritée
    const [{ data: roleData }, { data: orgMems }] = await Promise.all([
      adminClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      adminClient.from("organization_members").select("role, organization_id").eq("user_id", user.id).eq("is_active", true),
    ]);
    const isAdmin = ['owner', 'admin', 'manager', 'managing_director', 'investment_manager'].some(r =>
      roleData?.role === r || (orgMems ?? []).some((m: any) => m.role === r)
    );
    if (!isAdmin && !['admin', 'super_admin'].includes(roleData?.role)) {
      return jsonRes({ error: "Permission refusée" }, 403);
    }

    // Récupère programme.organization_id pour ai_jobs
    const { data: prog } = await adminClient
      .from("programmes").select("organization_id").eq("id", body.programme_id).maybeSingle();

    // Insère le job (sans candidature_id : c'est un job batch sur tout le programme)
    const { data: job, error: jobErr } = await adminClient
      .from("ai_jobs")
      .insert({
        agent_name: "screen-candidatures",
        payload: {
          programme_id: body.programme_id,
          candidature_ids: body.candidature_ids ?? null,
        },
        status: "pending",
        organization_id: prog?.organization_id ?? null,
        user_id: user.id,
        programme_id: body.programme_id,
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
        agent_name: "screen-candidatures",
        job_id: job.id,
        payload: {
          programme_id: body.programme_id,
          candidature_ids: body.candidature_ids ?? null,
        },
      }),
    }).catch((e) => {
      console.error("Worker dispatch failed:", e);
    });

    return jsonRes({
      accepted: true,
      job_id: job.id,
      message: "Screening lancé sur le worker Railway. Les scores apparaîtront via Realtime.",
    }, 202);
  } catch (e: any) {
    return jsonRes({ error: e.message }, 500);
  }
});
