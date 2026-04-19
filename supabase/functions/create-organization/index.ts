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

    // Client avec le token de l'utilisateur (pour vérifier les permissions)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Vérifier que l'appelant est super_admin
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: isSA } = await userClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client avec la service role (pour créer l'org et les membres)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { name, slug, type, country, owner_email, owner_name, send_invitation } = body;

    if (!name || !slug || !type) {
      return new Response(JSON.stringify({ error: "name, slug, type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérifier que le slug est disponible
    const { data: slugExists } = await adminClient
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (slugExists) {
      return new Response(JSON.stringify({ error: "Slug already taken" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Créer l'organisation
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name,
        slug,
        type,
        country: country || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    console.log(`[create-org] Created org ${org.id}: ${name} (${slug})`);

    // Si un owner_email est fourni, chercher ou inviter
    let ownerInvitationToken: string | null = null;

    if (owner_email) {
      // Chercher si le user existe déjà
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === owner_email);

      if (existingUser) {
        // User existe → le rattacher directement comme owner (upsert pour éviter erreur si déjà membre)
        await adminClient.from("organization_members").upsert({
          organization_id: org.id,
          user_id: existingUser.id,
          role: "owner",
          invited_by: user.id,
          is_active: true,
        }, { onConflict: "organization_id,user_id" });
        console.log(`[create-org] Attached existing user ${existingUser.id} as owner`);
      } else {
        // User n'existe pas → créer une invitation
        const { data: invitation, error: invError } = await adminClient
          .from("organization_invitations")
          .insert({
            organization_id: org.id,
            email: owner_email,
            role: "owner",
            invited_by: user.id,
          })
          .select()
          .single();

        if (invError) throw invError;
        ownerInvitationToken = invitation.token;

        // Envoyer l'email d'invitation si demandé
        if (send_invitation && invitation.token) {
          const appUrl = Deno.env.get("APP_URL") || "https://esono.tech";
          const invitationUrl = `${appUrl}/invitation/${invitation.token}`;

          await adminClient.functions.invoke("send-email", {
            body: {
              to: owner_email,
              subject: `Vous êtes invité à rejoindre ${name} sur ESONO`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Bienvenue sur ESONO !</h2>
                  <p>${owner_name ? `Bonjour ${owner_name},` : 'Bonjour,'}</p>
                  <p>Vous avez été invité à rejoindre <strong>${name}</strong> en tant que propriétaire de l'espace.</p>
                  <p>Cliquez sur le lien ci-dessous pour accepter l'invitation et créer votre compte :</p>
                  <p style="margin: 24px 0;">
                    <a href="${invitationUrl}" style="background: #1a2744; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      Accepter l'invitation
                    </a>
                  </p>
                  <p style="color: #666; font-size: 12px;">Ce lien expire dans 7 jours.</p>
                  <p style="color: #999; font-size: 11px;">— L'équipe ESONO</p>
                </div>
              `,
            },
          });
          console.log(`[create-org] Invitation email sent to ${owner_email}`);
        }
      }
    }

    // Le super_admin qui crée l'org est aussi ajouté comme owner
    await adminClient.from("organization_members").upsert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    }, { onConflict: "organization_id,user_id" });

    return new Response(JSON.stringify({
      success: true,
      organization_id: org.id,
      slug: org.slug,
      owner_invitation_token: ownerInvitationToken,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[create-org] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
