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

/**
 * Dispatch le screening au worker Railway via ai_jobs + /run-agent.
 *
 * L'ancienne version screenait inline dans EdgeRuntime.waitUntil, avec un parsing
 * des documents plafonné à 30s/doc (AbortSignal) — insuffisant pour l'OCR des
 * bilans/statuts scannés, d'où des diagnostics form-only (documents_exploitables=0).
 * Sur Railway : parsing OCR/vision sans limite de temps + pas d'éviction d'isolate.
 *
 * prefer_vision : true par défaut ici (re-screen manuel → Claude vision sur les
 * scans/photos, extraction financière haute fidélité).
 */
async function dispatchScreening(
  supabase: any,
  opts: { programmeId: string; candidatureIds?: string[]; organizationId?: string | null; preferVision?: boolean },
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const railwayUrl = Deno.env.get("RAILWAY_AI_URL");
  const railwayKey = Deno.env.get("RAILWAY_AI_KEY");
  if (!railwayUrl || !railwayKey) {
    return { ok: false, error: "RAILWAY_AI_URL / RAILWAY_AI_KEY non configurés" };
  }

  const payload = {
    programme_id: opts.programmeId,
    candidature_ids: opts.candidatureIds ?? null,
    prefer_vision: opts.preferVision ?? true,
  };

  const { data: job, error: jobErr } = await supabase
    .from("ai_jobs")
    .insert({
      agent_name: "screen-candidatures",
      payload,
      status: "pending",
      organization_id: opts.organizationId ?? null,
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    return { ok: false, error: `INSERT ai_jobs failed: ${jobErr?.message ?? "unknown"}` };
  }

  try {
    const resp = await fetch(`${railwayUrl}/run-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Worker-API-Key": railwayKey },
      body: JSON.stringify({ agent_name: "screen-candidatures", job_id: job.id, payload }),
    });
    if (!resp.ok && resp.status !== 202) {
      const text = await resp.text().catch(() => "");
      return { ok: false, jobId: job.id, error: `worker dispatch failed: ${resp.status} ${text.slice(0, 200)}` };
    }
    return { ok: true, jobId: job.id };
  } catch (e: any) {
    return { ok: false, jobId: job.id, error: `worker unreachable: ${e.message}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check role (legacy + org)
    const [{ data: roleData }, { data: orgMems }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("organization_members").select("role, organization_id").eq("user_id", user.id).eq("is_active", true),
    ]);
    // Tri par priorité de rôle pour multi-membership (owner > admin > manager > coach > analyst > entrepreneur)
    const ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1, manager: 2, coach: 3, analyst: 4, entrepreneur: 5 };
    const bestMem = (orgMems || []).slice().sort((a: any, b: any) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99))[0];
    const orgRole = bestMem?.role;
    const userOrgId = bestMem?.organization_id;
    const isAdmin = roleData?.role === "super_admin";
    const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";
    const isChef = roleData?.role === "chef_programme" || isOwnerOrAdmin || orgRole === "manager";
    if (!isAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { programme_id, candidature_ids, prefer_vision } = body;
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    // Check programme ownership
    const { data: programme } = await supabase
      .from("programmes")
      .select("id, organization_id, chef_programme_id")
      .eq("id", programme_id)
      .single();

    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);
    const canAccess = isAdmin || (isOwnerOrAdmin && programme.organization_id === userOrgId) || (isChef && programme.chef_programme_id === user.id);
    if (!canAccess) return jsonRes({ error: "Accès refusé" }, 403);

    // Dispatch au worker Railway. Le worker sélectionne les candidatures
    // (candidature_ids fournis, sinon status received/in_review), parse les docs
    // (OCR/vision) et écrit screening_data. prefer_vision=true par défaut.
    const result = await dispatchScreening(supabase, {
      programmeId: programme_id,
      candidatureIds: candidature_ids?.length ? candidature_ids : undefined,
      organizationId: programme.organization_id,
      preferVision: prefer_vision !== false,
    });

    if (!result.ok) {
      console.error("[screen-candidatures] dispatch failed:", result.error);
      return jsonRes({ error: result.error || "Dispatch échoué" }, 502);
    }

    return jsonRes({
      accepted: true,
      job_id: result.jobId,
      message: "Screening lancé sur le worker Railway (parsing OCR/vision + Claude). Suivi via ai_jobs / Realtime.",
    }, 202);

  } catch (e: any) {
    console.error("[screen-candidatures] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
