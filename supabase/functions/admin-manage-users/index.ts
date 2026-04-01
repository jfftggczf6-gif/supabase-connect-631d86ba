import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // Only super_admin can manage users
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roleData || []).some((r: any) => r.role === "super_admin");
    if (!isAdmin) return jsonRes({ error: "Accès refusé — super_admin requis" }, 403);

    const body = await req.json();
    const { action } = body;

    // ═══════ CREATE USER ═══════
    if (action === "create_user") {
      const { full_name, email, password, roles: selectedRoles } = body;
      if (!full_name || !email || !password) return jsonRes({ error: "full_name, email et password requis" }, 400);
      if (!selectedRoles?.length) return jsonRes({ error: "Au moins un rôle requis" }, 400);

      // Create auth user
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) return jsonRes({ error: `Création compte: ${createErr.message}` }, 400);
      const newUserId = newUser.user.id;

      // Create profile
      await supabase.from("profiles").upsert({
        user_id: newUserId, full_name, email,
      }, { onConflict: "user_id" });

      // Create roles (multiple allowed)
      for (const role of selectedRoles) {
        await supabase.from("user_roles").insert({
          user_id: newUserId, role,
        }).then(() => {}).catch(() => {}); // ignore duplicates
      }

      // Send welcome email (non-blocking)
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "ESONO <noreply@esono.tech>",
              to: [email],
              subject: "Bienvenue sur ESONO",
              html: `<p>Bonjour ${full_name},</p><p>Votre compte ESONO a été créé.</p><p><strong>Email :</strong> ${email}<br><strong>Mot de passe :</strong> ${password}</p><p><a href="https://esono.tech/login">Se connecter</a></p><p>ESONO</p>`,
            }),
          });
        }
      } catch { /* non-blocking */ }

      return jsonRes({
        success: true,
        user_id: newUserId,
        roles: selectedRoles,
        temp_password: password,
        message: `Compte créé pour ${full_name} (${selectedRoles.join(", ")})`,
      });
    }

    // ═══════ ADD ROLE ═══════
    if (action === "add_role") {
      const { user_id: targetUserId, role } = body;
      if (!targetUserId || !role) return jsonRes({ error: "user_id et role requis" }, 400);

      const { error: insertErr } = await supabase.from("user_roles").insert({
        user_id: targetUserId, role,
      });
      if (insertErr) {
        if (insertErr.message.includes("duplicate") || insertErr.message.includes("unique")) {
          return jsonRes({ error: "Ce rôle est déjà attribué" }, 409);
        }
        return jsonRes({ error: insertErr.message }, 500);
      }

      return jsonRes({ success: true, message: `Rôle ${role} ajouté` });
    }

    // ═══════ REMOVE ROLE ═══════
    if (action === "remove_role") {
      const { user_id: targetUserId, role } = body;
      if (!targetUserId || !role) return jsonRes({ error: "user_id et role requis" }, 400);

      // Don't allow removing the last role
      const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", targetUserId);
      if ((userRoles || []).length <= 1) return jsonRes({ error: "Impossible de retirer le dernier rôle" }, 400);

      // Don't allow removing own super_admin
      if (targetUserId === user.id && role === "super_admin") {
        return jsonRes({ error: "Vous ne pouvez pas retirer votre propre rôle super_admin" }, 400);
      }

      const { error: delErr } = await supabase.from("user_roles").delete()
        .eq("user_id", targetUserId).eq("role", role);
      if (delErr) return jsonRes({ error: delErr.message }, 500);

      return jsonRes({ success: true, message: `Rôle ${role} retiré` });
    }

    return jsonRes({ error: `Action inconnue: ${action}` }, 400);

  } catch (e: any) {
    console.error("[admin-manage-users] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
