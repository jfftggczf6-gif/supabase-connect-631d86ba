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

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ["in_review", "pre_selected", "selected", "rejected"],
  in_review: ["pre_selected", "selected", "rejected", "waitlisted"],
  pre_selected: ["selected", "rejected", "waitlisted"],
  waitlisted: ["pre_selected", "selected", "rejected"],
  rejected: ["in_review", "pre_selected"], // Allow un-reject
  selected: [], // Final state
};

const DEFAULT_MODULES = ["bmc", "sic", "inputs", "framework", "diagnostic", "plan_financier", "business_plan"];

async function createEnterpriseFromCandidature(
  candidature: any,
  coachId: string,
  programmeId: string,
  programmeName: string,
  supabase: any,
): Promise<{ enterprise: any; tempPassword: string }> {
  // 1. Create user account
  const tempPassword = `ESONO-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: newUser, error: createUserErr } = await supabase.auth.admin.createUser({
    email: candidature.contact_email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: candidature.contact_name },
  });

  if (createUserErr) throw new Error(`Création compte: ${createUserErr.message}`);
  const userId = newUser.user.id;

  // 2. Create profile + role
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: candidature.contact_name,
    email: candidature.contact_email,
    phone: candidature.contact_phone,
  }, { onConflict: "user_id" });

  await supabase.from("user_roles").upsert({
    user_id: userId,
    role: "entrepreneur",
  }, { onConflict: "user_id" });

  // 3. Create enterprise
  const { data: enterprise, error: entErr } = await supabase.from("enterprises").insert({
    user_id: userId,
    coach_id: coachId,
    name: candidature.company_name,
    sector: candidature.form_data?.sector || null,
    country: candidature.form_data?.country || candidature.form_data?.pays || null,
    city: candidature.form_data?.city || candidature.form_data?.ville || null,
    contact_name: candidature.contact_name,
    contact_email: candidature.contact_email,
    contact_phone: candidature.contact_phone,
    employees_count: candidature.form_data?.effectif || candidature.form_data?.employees || 0,
  }).select().single();

  if (entErr) throw new Error(`Création entreprise: ${entErr.message}`);

  // 4. Create default modules
  await supabase.from("enterprise_modules").insert(
    DEFAULT_MODULES.map(m => ({
      enterprise_id: enterprise.id,
      module: m,
      status: "not_started",
      progress: 0,
    }))
  );

  // 5. Transfer screening diagnostic as first deliverable
  if (candidature.screening_data) {
    await supabase.from("deliverables").upsert({
      enterprise_id: enterprise.id,
      type: "pre_screening",
      version: 1,
      data: {
        ...candidature.screening_data,
        source: "candidature_screening",
        programme_id: programmeId,
        programme_name: programmeName,
        candidature_id: candidature.id,
      },
      score: candidature.screening_score,
      ai_generated: true,
    }, { onConflict: "enterprise_id,type" });
    console.log(`[update-candidature] Diagnostic transféré → pre_screening pour ${enterprise.name}`);
  }

  // 6. Link candidature to enterprise
  await supabase.from("candidatures").update({
    enterprise_id: enterprise.id,
    assigned_coach_id: coachId,
    status: "selected",
    updated_at: new Date().toISOString(),
  }).eq("id", candidature.id);

  return { enterprise, tempPassword };
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

    // Check role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = roleData?.role === "super_admin";
    const isChef = roleData?.role === "chef_programme";
    if (!isAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { candidature_id, action, new_status, coach_id, committee_notes, candidature_ids } = body;

    // ═══════ BULK MOVE ═══════
    if (action === "bulk_move") {
      if (!candidature_ids?.length || !new_status) return jsonRes({ error: "candidature_ids et new_status requis" }, 400);

      // Get candidatures with their programmes
      const { data: cands } = await supabase
        .from("candidatures")
        .select("id, status, programme_id")
        .in("id", candidature_ids);

      if (!cands?.length) return jsonRes({ error: "Aucune candidature trouvée" }, 404);

      // Check programme ownership for all
      if (isChef) {
        const progIds = [...new Set(cands.map(c => c.programme_id))];
        const { data: progs } = await supabase
          .from("programmes")
          .select("id, chef_programme_id")
          .in("id", progIds);
        const unauthorized = progs?.find(p => p.chef_programme_id !== user.id);
        if (unauthorized) return jsonRes({ error: "Accès refusé à un des programmes" }, 403);
      }

      // Validate transitions
      const invalid = cands.filter(c => !VALID_TRANSITIONS[c.status]?.includes(new_status));
      if (invalid.length) {
        return jsonRes({
          error: `Transition invalide pour ${invalid.length} candidature(s)`,
          invalid: invalid.map(c => ({ id: c.id, current_status: c.status })),
        }, 400);
      }

      const { error: bulkErr } = await supabase
        .from("candidatures")
        .update({ status: new_status, updated_at: new Date().toISOString() })
        .in("id", candidature_ids);

      if (bulkErr) return jsonRes({ error: bulkErr.message }, 500);
      return jsonRes({ success: true, moved: candidature_ids.length, new_status });
    }

    // Single candidature actions
    if (!candidature_id) return jsonRes({ error: "candidature_id requis" }, 400);

    // Get candidature + programme
    const { data: candidature } = await supabase
      .from("candidatures")
      .select("*, programmes:programme_id(id, name, chef_programme_id)")
      .eq("id", candidature_id)
      .single();

    if (!candidature) return jsonRes({ error: "Candidature non trouvée" }, 404);

    const programme = candidature.programmes;
    if (isChef && programme?.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);

    // ═══════ MOVE ═══════
    if (action === "move") {
      if (!new_status) return jsonRes({ error: "new_status requis" }, 400);

      const valid = VALID_TRANSITIONS[candidature.status];
      if (!valid?.includes(new_status)) {
        return jsonRes({ error: `Transition ${candidature.status} → ${new_status} non autorisée` }, 400);
      }

      // Selection requires coach
      if (new_status === "selected" && !coach_id) {
        return jsonRes({ error: "Un coach doit être assigné pour sélectionner une candidature" }, 400);
      }

      // If selecting → create enterprise
      if (new_status === "selected" && coach_id) {
        try {
          const result = await createEnterpriseFromCandidature(
            candidature, coach_id, programme.id, programme.name, supabase
          );
          console.log(`[update-candidature] ✅ Entreprise créée: ${result.enterprise.name} (${result.enterprise.id})`);

          // Send welcome email with credentials (non-blocking)
          try {
            const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
            if (RESEND_API_KEY && candidature.contact_email) {
              const siteUrl = "https://esono.tech";
              const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:'Segoe UI',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
<div style="text-align:center;margin-bottom:24px">
  <div style="display:inline-block;background:#1a2744;color:white;font-weight:bold;padding:12px 16px;border-radius:12px;font-size:18px">ES</div>
  <h1 style="font-size:22px;margin:12px 0 4px">Bienvenue sur ESONO !</h1>
  <p style="color:#64748b;font-size:14px">Votre candidature au programme <strong>${programme.name}</strong> a été retenue.</p>
</div>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0">
  <p style="font-size:14px;margin:0 0 12px"><strong>Vos identifiants de connexion :</strong></p>
  <p style="font-size:14px;margin:4px 0">📧 Email : <strong>${candidature.contact_email}</strong></p>
  <p style="font-size:14px;margin:4px 0">🔑 Mot de passe : <strong>${result.tempPassword}</strong></p>
  <p style="font-size:12px;color:#64748b;margin:12px 0 0">Changez votre mot de passe après votre première connexion.</p>
</div>
<div style="text-align:center;margin:24px 0">
  <a href="${siteUrl}/login" style="display:inline-block;background:#1a2744;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Se connecter</a>
</div>
<p style="font-size:13px;color:#64748b;text-align:center">Un coach vous accompagnera tout au long du programme. Vous pourrez uploader vos documents et suivre votre progression directement sur la plateforme.</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="font-size:11px;color:#94a3b8;text-align:center">ESONO — L'assistant IA des coachs d'entreprises en Afrique</p>
</body></html>`;

              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "ESONO <noreply@esono.tech>",
                  to: [candidature.contact_email],
                  subject: `Bienvenue sur ESONO — Programme ${programme.name}`,
                  html: emailHtml,
                }),
              }).then(r => r.json()).then(d => {
                console.log(`[update-candidature] ✅ Welcome email sent to ${candidature.contact_email}`, d);
              }).catch(e => {
                console.warn(`[update-candidature] ⚠ Email failed:`, e.message);
              });
            }
          } catch (emailErr: any) {
            console.warn("[update-candidature] Email error (non-blocking):", emailErr.message);
          }

          return jsonRes({
            success: true,
            status: "selected",
            enterprise_created: true,
            enterprise_id: result.enterprise.id,
            temp_password: result.tempPassword,
          });
        } catch (e: any) {
          console.error("[update-candidature] Enterprise creation failed:", e);
          return jsonRes({ error: `Erreur création entreprise: ${e.message}` }, 500);
        }
      }

      // Simple status move
      const { error: moveErr } = await supabase
        .from("candidatures")
        .update({ status: new_status, updated_at: new Date().toISOString() })
        .eq("id", candidature_id);

      if (moveErr) return jsonRes({ error: moveErr.message }, 500);
      return jsonRes({ success: true, status: new_status });
    }

    // ═══════ ASSIGN COACH ═══════
    if (action === "assign_coach") {
      if (!coach_id) return jsonRes({ error: "coach_id requis" }, 400);

      // Verify coach exists and has coach role
      const { data: coachRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", coach_id)
        .maybeSingle();

      if (!coachRole || coachRole.role !== "coach") {
        return jsonRes({ error: "L'utilisateur spécifié n'est pas un coach" }, 400);
      }

      const updateData: any = {
        assigned_coach_id: coach_id,
        updated_at: new Date().toISOString(),
      };

      // If also selecting
      if (new_status === "selected") {
        try {
          const result = await createEnterpriseFromCandidature(
            candidature, coach_id, programme.id, programme.name, supabase
          );
          return jsonRes({
            success: true,
            status: "selected",
            enterprise_created: true,
            enterprise_id: result.enterprise.id,
            temp_password: result.tempPassword,
          });
        } catch (e: any) {
          return jsonRes({ error: `Erreur création entreprise: ${e.message}` }, 500);
        }
      }

      const { error: assignErr } = await supabase
        .from("candidatures")
        .update(updateData)
        .eq("id", candidature_id);

      if (assignErr) return jsonRes({ error: assignErr.message }, 500);
      return jsonRes({ success: true, coach_assigned: coach_id });
    }

    // ═══════ ADD NOTE ═══════
    if (action === "add_note") {
      if (!committee_notes) return jsonRes({ error: "committee_notes requis" }, 400);

      const existing = candidature.committee_notes || "";
      const timestamp = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
      const newNotes = existing
        ? `${existing}\n\n[${timestamp}] ${committee_notes}`
        : `[${timestamp}] ${committee_notes}`;

      const { error: noteErr } = await supabase
        .from("candidatures")
        .update({
          committee_notes: newNotes,
          committee_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidature_id);

      if (noteErr) return jsonRes({ error: noteErr.message }, 500);
      return jsonRes({ success: true, committee_notes: newNotes });
    }

    if (action === "committee_decision") {
      const { committee_decision } = body;
      if (!committee_decision) return jsonRes({ error: "committee_decision requis" }, 400);
      const { error: decErr } = await supabase.from("candidatures").update({
        committee_decision,
        committee_date: new Date().toISOString(),
      }).eq("id", candidature_id);
      if (decErr) return jsonRes({ error: decErr.message }, 500);
      return jsonRes({ success: true, committee_decision });
    }

    return jsonRes({ error: `Action inconnue: ${action}` }, 400);

  } catch (e: any) {
    console.error("[update-candidature] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
