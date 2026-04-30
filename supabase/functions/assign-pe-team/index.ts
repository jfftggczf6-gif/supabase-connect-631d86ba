import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { organization_id, im_user_id, analyst_user_id, action } = await req.json();
    if (!organization_id || !im_user_id || !analyst_user_id || !action) {
      throw new Error("organization_id, im_user_id, analyst_user_id, action required");
    }
    if (!['add', 'remove'].includes(action)) throw new Error("action must be 'add' or 'remove'");

    // 1. Vérifier que l'auteur est MD/owner/admin
    const { data: canManage } = await adminClient.rpc('is_pe_md_or_owner', {
      p_org_id: organization_id, p_user_id: user.id,
    });
    if (!canManage) {
      return new Response(JSON.stringify({ error: "Only MD/owner/admin can manage team" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Vérifier les rôles des 2 users
    const { data: members } = await adminClient
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organization_id)
      .in("user_id", [im_user_id, analyst_user_id])
      .eq("is_active", true);

    const im = members?.find(m => m.user_id === im_user_id);
    const analyst = members?.find(m => m.user_id === analyst_user_id);
    if (!im || im.role !== 'investment_manager') {
      throw new Error("im_user_id n'a pas le rôle investment_manager dans cette org");
    }
    if (!analyst || analyst.role !== 'analyst') {
      throw new Error("analyst_user_id n'a pas le rôle analyst dans cette org");
    }

    // 3. Action
    if (action === 'add') {
      const { error } = await adminClient
        .from("pe_team_assignments")
        .upsert({
          organization_id, im_user_id, analyst_user_id,
          is_active: true,
          assigned_by: user.id,
        }, { onConflict: 'organization_id,im_user_id,analyst_user_id' });
      if (error) throw error;
    } else {
      const { error } = await adminClient
        .from("pe_team_assignments")
        .update({ is_active: false })
        .eq("organization_id", organization_id)
        .eq("im_user_id", im_user_id)
        .eq("analyst_user_id", analyst_user_id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[assign-pe-team] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
