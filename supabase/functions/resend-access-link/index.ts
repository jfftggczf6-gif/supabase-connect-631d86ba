// supabase/functions/resend-access-link/index.ts
// Renvoie un lien d'accès magique (Supabase Magic Link) à un membre déjà actif
// d'une organisation. Cas d'usage : un entrepreneur a perdu son lien d'invitation,
// ne se souvient pas de son mot de passe, ou n'est jamais venu sur la plateforme.
//
// Input  : { email, organization_id, redirect_to? }
// Output : { success: true, email_sent: bool, link_url: string }
//
// Sécurité :
// - JWT requis (header Authorization Bearer)
// - L'appelant doit être owner/admin/manager/super_admin de l'organisation
// - L'email cible doit être membre actif (is_active=true) de cette organisation
// - Pas d'envoi si email pas membre → on ne révèle pas l'existence d'un user externe
//
// Auth chain : génère magic link via supabase.auth.admin.generateLink(type='magiclink')
// Email : envoyé via Resend (réutilise EF send-email)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_INVITER_ROLES = ["owner", "admin", "manager"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err(401, "Missing Authorization");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Auth caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !caller) return err(401, "Invalid token");

    const body = await req.json();
    const email = (body?.email ?? "").trim().toLowerCase();
    const organization_id = body?.organization_id;
    const redirect_to = body?.redirect_to ?? "https://esono.tech/dashboard";
    if (!email || !organization_id) return err(400, "email + organization_id requis");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 2. Vérif caller est owner/admin/manager/super_admin de l'org
    const { data: callerMembership } = await admin
      .from("organization_members")
      .select("role, is_active")
      .eq("user_id", caller.id)
      .eq("organization_id", organization_id)
      .eq("is_active", true)
      .maybeSingle();
    const { data: isSuperAdmin } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const isPrivileged = !!isSuperAdmin || (callerMembership && ALLOWED_INVITER_ROLES.includes(callerMembership.role));
    if (!isPrivileged) {
      return err(403, "Tu dois être owner/admin/manager de cette organisation pour renvoyer un lien.");
    }

    // 3. Vérif cible est bien membre actif de l'org (ne révèle pas l'existence si non)
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("user_id, email, full_name")
      .ilike("email", email)
      .maybeSingle();
    if (!targetProfile) {
      return err(404, "Aucun utilisateur avec cet email n'a un compte ESONO. Utilise une invitation classique.");
    }
    const { data: targetMembership } = await admin
      .from("organization_members")
      .select("id, role, is_active")
      .eq("user_id", targetProfile.user_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (!targetMembership) {
      return err(404, "Cet utilisateur a un compte ESONO mais n'est pas membre de cette organisation.");
    }
    if (!targetMembership.is_active) {
      return err(409, "Cet utilisateur est désactivé dans cette organisation. Réactive-le avant de renvoyer un lien.");
    }

    // 4. Génère le magic link (auto-login en 1 clic, 1h de validité par défaut)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email,
      options: { redirectTo: redirect_to },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return err(500, `Génération magic link échouée : ${linkErr?.message ?? "lien vide"}`);
    }
    const action_link = linkData.properties.action_link;

    // 5. Envoie l'email via EF send-email (Resend)
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .maybeSingle();
    const orgName = org?.name ?? "ESONO";
    const userName = targetProfile.full_name?.trim() || "";

    const subject = `Votre lien d'accès à ${orgName}`;
    const greeting = userName ? `Bonjour ${userName},` : "Bonjour,";
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
        <h2 style="color:#534AB7;font-size:20px;margin:0 0 16px;">Votre lien d'accès à ${orgName}</h2>
        <p style="line-height:1.6;font-size:14px;">${greeting}</p>
        <p style="line-height:1.6;font-size:14px;">L'équipe ${orgName} vous a (re)généré un lien d'accès à votre espace ESONO. Cliquez ci-dessous pour vous connecter en 1 clic (sans mot de passe) :</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${action_link}" style="background:#534AB7;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Accéder à mon espace</a>
        </p>
        <p style="font-size:12px;color:#666;line-height:1.6;">Ce lien est valable <strong>1 heure</strong>. Passé ce délai, demandez-en un nouveau à votre référent ${orgName}.</p>
        <p style="font-size:12px;color:#666;line-height:1.6;margin-top:16px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${action_link}" style="color:#534AB7;word-break:break-all;">${action_link}</a></p>
        <hr style="border:none;border-top:1px solid #e8e6e1;margin:24px 0;">
        <p style="font-size:11px;color:#999;">ESONO BIS Studio · ${orgName}</p>
      </div>`;

    const text = `${greeting}\n\nL'équipe ${orgName} vous a renvoyé un lien d'accès à votre espace ESONO.\n\nCliquez ici pour vous connecter (sans mot de passe) :\n${action_link}\n\nLien valable 1h.`;

    let email_sent = false;
    try {
      const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: targetProfile.email, subject, html, text }),
      });
      const sendData = await sendResp.json().catch(() => ({}));
      email_sent = sendResp.ok && !sendData.error;
      if (!email_sent) console.warn("[resend-access-link] send-email échec:", sendData);
    } catch (e) {
      console.warn("[resend-access-link] send-email exception:", e);
    }

    return ok({
      success: true,
      email_sent,
      link_url: action_link, // toujours retourné pour copier-coller manuel si email failed
      recipient: { email: targetProfile.email, full_name: userName },
    });
  } catch (e: any) {
    console.error("[resend-access-link]", e);
    return err(500, e?.message ?? "Erreur serveur");
  }
});

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
