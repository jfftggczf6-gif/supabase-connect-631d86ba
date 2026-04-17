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

    const { token } = await req.json();
    if (!token) throw new Error("token required");

    // Récupérer l'invitation
    const { data: invitation } = await adminClient
      .from("organization_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (!invitation) throw new Error("Invalid invitation");
    if (invitation.accepted_at) throw new Error("Invitation already accepted");
    if (invitation.revoked_at) throw new Error("Invitation revoked");
    if (new Date(invitation.expires_at) < new Date()) throw new Error("Invitation expired");

    // Vérifier que l'email correspond
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return new Response(JSON.stringify({
        error: "Email mismatch",
        expected_email: invitation.email,
        message: `Cette invitation est pour ${invitation.email}. Connectez-vous avec ce compte.`,
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Créer le membership
    const { error: memberError } = await adminClient
      .from("organization_members")
      .upsert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        is_active: true,
      }, { onConflict: "organization_id,user_id" });

    if (memberError) throw memberError;

    // Marquer l'invitation comme acceptée
    await adminClient
      .from("organization_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    console.log(`[accept-invitation] User ${user.id} joined org ${invitation.organization_id} as ${invitation.role}`);

    return new Response(JSON.stringify({
      success: true,
      organization_id: invitation.organization_id,
      role: invitation.role,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[accept-invitation] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
