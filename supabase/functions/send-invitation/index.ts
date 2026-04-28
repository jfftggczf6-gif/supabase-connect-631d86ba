import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Matrice des droits d'invitation
const INVITE_PERMISSIONS: Record<string, string[]> = {
  owner: ['admin', 'manager', 'analyst', 'coach', 'entrepreneur'],
  admin: ['admin', 'manager', 'analyst', 'coach', 'entrepreneur'],
  manager: ['analyst', 'coach', 'entrepreneur'],
  coach: ['entrepreneur'],
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

    const { email, role, organization_id, personal_message, enterprise_id } = await req.json();
    if (!email || !role || !organization_id) {
      return new Response(JSON.stringify({ error: "email, role, organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérifier le rôle de l'inviteur dans l'org
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    const inviterRole = membership?.role;
    const isSA = await userClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" });

    if (!isSA.data && !inviterRole) {
      return new Response(JSON.stringify({ error: "Not a member of this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérifier que le rôle demandé est dans les permissions de l'inviteur
    if (!isSA.data) {
      const allowed = INVITE_PERMISSIONS[inviterRole || ''] || [];
      if (!allowed.includes(role)) {
        return new Response(JSON.stringify({ error: `Cannot invite role '${role}' with your permissions` }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Si enterprise_id fourni : vérifier que l'enterprise appartient à l'org
    // et que l'inviteur est coach propriétaire ou a un rôle privilégié
    if (enterprise_id) {
      const { data: ent } = await adminClient
        .from("enterprises")
        .select("id, organization_id, coach_id, user_id")
        .eq("id", enterprise_id)
        .single();
      if (!ent) {
        return new Response(JSON.stringify({ error: "enterprise_id invalid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (ent.organization_id !== organization_id) {
        return new Response(JSON.stringify({ error: "enterprise does not belong to this organization" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isOwningCoach = ent.coach_id === user.id || ent.user_id === user.id;
      const isPrivileged = !!isSA.data || ['owner', 'admin', 'manager'].includes(inviterRole || '');
      if (!isOwningCoach && !isPrivileged) {
        return new Response(JSON.stringify({ error: "Not allowed to invite entrepreneur for this enterprise" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Vérifier que l'email n'est pas déjà membre actif
    const { data: existingMember } = await adminClient
      .from("organization_members")
      .select("id, user_id")
      .eq("organization_id", organization_id)
      .eq("is_active", true);

    if (existingMember?.length) {
      // Chercher si un de ces users a cet email
      for (const m of existingMember) {
        const { data: profile } = await adminClient.from("profiles").select("email").eq("user_id", m.user_id).single();
        if (profile?.email === email) {
          return new Response(JSON.stringify({ error: "This email is already a member" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Créer ou régénérer l'invitation
    const { data: existing } = await adminClient
      .from("organization_invitations")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .single();

    let invitation;
    if (existing) {
      // Régénérer le token
      const { data, error } = await adminClient
        .from("organization_invitations")
        .update({
          token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          role,
          enterprise_id: enterprise_id ?? null,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      invitation = data;
    } else {
      const { data, error } = await adminClient
        .from("organization_invitations")
        .insert({ organization_id, email, role, invited_by: user.id, personal_message, enterprise_id: enterprise_id ?? null })
        .select()
        .single();
      if (error) throw error;
      invitation = data;
    }

    // Récupérer le nom de l'org
    const { data: org } = await adminClient.from("organizations").select("name, logo_url").eq("id", organization_id).single();

    // Récupérer le nom de l'inviteur
    const { data: inviterProfile } = await adminClient.from("profiles").select("full_name").eq("user_id", user.id).single();

    // Envoyer l'email
    const appUrl = Deno.env.get("APP_URL") || "https://esono.tech";
    const invitationUrl = `${appUrl}/invitation/${invitation.token}`;

    const roleLabels: Record<string, string> = {
      owner: 'Propriétaire', admin: 'Administrateur', manager: 'Responsable',
      analyst: 'Analyste', coach: 'Coach', entrepreneur: 'Entrepreneur',
    };

    // Envoi email — on capture l'erreur explicitement pour que l'UI puisse alerter
    // l'inviteur si le mail n'est pas parti (Resend down, quota atteint, etc.).
    // L'invitation est conservée en DB de toute façon : le manager peut renvoyer
    // ou copier le lien manuellement.
    let emailSent = true;
    let emailError: string | undefined;
    try {
      const emailRes = await adminClient.functions.invoke("send-email", {
        body: {
          to: email,
          subject: `Vous êtes invité à rejoindre ${org?.name || 'une organisation'} sur ESONO`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Invitation ESONO</h2>
              <p>${inviterProfile?.full_name || 'Un membre'} vous invite à rejoindre <strong>${org?.name || 'une organisation'}</strong> en tant que <strong>${roleLabels[role] || role}</strong>.</p>
              ${personal_message ? `<p style="background: #f5f5f5; padding: 12px; border-radius: 8px; font-style: italic;">"${personal_message}"</p>` : ''}
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
      // Le client supabase ne throw pas pour les erreurs HTTP des edge functions —
      // on inspecte explicitement `error` ET le data { error: ... } éventuel.
      if (emailRes.error) {
        emailSent = false;
        emailError = emailRes.error.message || 'send-email a retourné une erreur';
      } else if ((emailRes.data as any)?.error) {
        emailSent = false;
        emailError = String((emailRes.data as any).error).slice(0, 300);
      }
    } catch (mailErr: any) {
      emailSent = false;
      emailError = mailErr?.message || 'Échec exception send-email';
    }

    if (!emailSent) {
      console.warn(`[send-invitation] email NOT sent for ${email} — invitation ${invitation.id} : ${emailError}`);
    }

    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      invitation_url: invitationUrl,  // l'UI peut proposer "Copier le lien" en fallback
      email_sent: emailSent,
      email_error: emailError,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[send-invitation] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
