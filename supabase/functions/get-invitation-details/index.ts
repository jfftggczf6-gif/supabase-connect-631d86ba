import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invitation } = await adminClient
      .from("organization_invitations")
      .select("id, email, role, expires_at, accepted_at, revoked_at, organization_id, invited_by")
      .eq("token", token)
      .single();

    if (!invitation || invitation.accepted_at || invitation.revoked_at) {
      return new Response(JSON.stringify({ error: "Invalid or expired invitation" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invitation expired" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await adminClient.from("organizations").select("name, logo_url").eq("id", invitation.organization_id).single();
    const { data: inviter } = await adminClient.from("profiles").select("full_name").eq("user_id", invitation.invited_by).single();

    const roleLabels: Record<string, string> = {
      owner: 'Propriétaire', admin: 'Administrateur', manager: 'Responsable',
      analyst: 'Analyste', coach: 'Coach', entrepreneur: 'Entrepreneur',
    };

    return new Response(JSON.stringify({
      organization_name: org?.name || '',
      organization_logo: org?.logo_url || null,
      role: invitation.role,
      role_label: roleLabels[invitation.role] || invitation.role,
      inviter_name: inviter?.full_name || '',
      email: invitation.email,
      expires_at: invitation.expires_at,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
