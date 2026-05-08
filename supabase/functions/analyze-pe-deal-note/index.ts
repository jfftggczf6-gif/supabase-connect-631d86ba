// analyze-pe-deal-note — Wrapper qui dispatche vers esono-ai-worker (Railway).
// Le worker exécute l'analyse Claude. UX identique pour le front.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";
import { dispatchAndPoll } from "../_shared/railway-dispatch.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!body.raw_content || body.raw_content.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Contenu trop court" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Org de l'utilisateur (pour ai_jobs.organization_id)
    const { data: orgRow } = await userClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1).single();

    const result = await dispatchAndPoll({
      agentName: "analyze-pe-deal-note",
      payload: {
        raw_content: body.raw_content,
        date_rdv: body.date_rdv,
        file_name: body.file_name,
        deal_id: body.deal_id,
      },
      userId: user.id,
      organizationId: orgRow?.organization_id ?? null,
      dealId: body.deal_id,
      pollTimeoutMs: 120_000, // analyze-pe-deal-note est rapide (8-15s typique)
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error, job_id: result.job_id }), {
        status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Le worker renvoie { ok, titre, resume, corrections, contexte, actions_analyste, infos_extraites, _meta }
    // On strip _meta et on renvoie le reste tel quel pour compatibilité avec l'ancien format
    const { _meta: _meta, ok: _ok, ...analysisResult } = result.result ?? {};
    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
