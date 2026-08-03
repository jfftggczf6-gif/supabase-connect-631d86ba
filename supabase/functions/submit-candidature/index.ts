import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchScreening, markScreeningError } from "../_shared/dispatch-screening.ts";
import { sendEmail, escapeHtml } from "../_shared/send-email.ts";

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
 * Notifie l'équipe (chef de programme + owner/admin/manager de l'org) qu'une
 * nouvelle candidature est arrivée. Emails dédupliqués, envoi en parallèle,
 * NON bloquant (toute erreur est avalée pour ne jamais casser la soumission).
 */
async function notifyTeamNewCandidature(
  supabase: any,
  prog: { id: string; name: string; organization_id: string | null; chef_programme_id: string | null },
  cand: { company_name: string; contact_name: string | null; contact_email: string },
): Promise<void> {
  try {
    const emails = new Set<string>();
    if (prog.chef_programme_id) {
      const { data } = await supabase.from("profiles").select("email").eq("user_id", prog.chef_programme_id).maybeSingle();
      if (data?.email) emails.add(data.email);
    }
    if (prog.organization_id) {
      const { data: mems } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", prog.organization_id)
        .eq("is_active", true)
        .in("role", ["owner", "admin", "manager"]);
      const ids = (mems || []).map((m: any) => m.user_id).filter(Boolean);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("email").in("user_id", ids);
        for (const p of profs || []) if (p?.email) emails.add(p.email);
      }
    }
    if (emails.size === 0) {
      console.log("[notify] aucun destinataire pour la notification de candidature");
      return;
    }
    const link = `https://esono.tech/programmes/${prog.id}`;
    const subject = `Nouvelle candidature — ${cand.company_name}`;
    const html =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5">` +
      `<p><strong>${escapeHtml(cand.company_name)}</strong> a soumis une candidature au programme <strong>${escapeHtml(prog.name)}</strong>.</p>` +
      `<p>Contact : ${escapeHtml(cand.contact_name || "—")} (${escapeHtml(cand.contact_email)})</p>` +
      `<p><a href="${link}" style="color:#6d28d9">Voir dans ESONO →</a></p>` +
      `</div>`;
    await Promise.all([...emails].map((to) => sendEmail({ to, subject, html })));
  } catch (e) {
    console.error("[notify] erreur (non bloquante):", (e as Error).message);
  }
}

// ── Main serve ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    // Handle signed upload URL request — used by PublicCandidatureForm to upload
    // files via PUT on signed URL (bypass RLS). Sécurité : on vérifie que la
    // candidature existe et n'est pas déjà acceptée/rejetée.
    if (body.action === 'get_upload_url' && body.candidature_id && body.filename) {
      const { data: cand } = await supabase
        .from("candidatures")
        .select("id, status")
        .eq("id", body.candidature_id)
        .maybeSingle();
      if (!cand) return jsonRes({ error: "Candidature introuvable" }, 404);
      if (cand.status && !['received', 'pre_selected'].includes(cand.status)) {
        return jsonRes({ error: "Cette candidature n'accepte plus de fichiers" }, 400);
      }
      const safeName = String(body.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${cand.id}/${Date.now()}_${safeName}`;
      const { data: signed, error: signErr } = await supabase.storage
        .from('candidature-documents')
        .createSignedUploadUrl(storagePath);
      if (signErr || !signed) return jsonRes({ error: signErr?.message || "Impossible de créer le lien d'upload" }, 500);
      return jsonRes({
        success: true,
        signed_url: signed.signedUrl,
        path: storagePath,
        storage_path: `candidature-documents/${storagePath}`,
      });
    }

    // Handle document update (after initial submission) — re-trigger screening with docs
    if (body.action === 'update_documents' && body.candidature_id) {
      await supabase.from("candidatures").update({
        documents: body.documents || [],
        updated_at: new Date().toISOString(),
      }).eq("id", body.candidature_id);

      // Re-screen avec les documents fraîchement uploadés → dispatch worker.
      const { data: cand } = await supabase
        .from("candidatures")
        .select("id, programme_id, organization_id")
        .eq("id", body.candidature_id)
        .single();
      if (cand?.programme_id) {
        const ok = await dispatchScreening(supabase, {
          programmeId: cand.programme_id,
          candidatureIds: [cand.id],
          organizationId: cand.organization_id,
          preferVision: false,
        });
        if (!ok) await markScreeningError(supabase, cand.id, "Dispatch worker échoué (update_documents)");
      }

      return jsonRes({ success: true });
    }

    const { programme_slug, company_name, contact_name, contact_email, contact_phone, form_data, documents } = body;

    // Validation
    if (!programme_slug) return jsonRes({ error: "programme_slug requis" }, 400);
    if (!company_name) return jsonRes({ error: "company_name requis" }, 400);
    if (!contact_email) return jsonRes({ error: "contact_email requis" }, 400);

    // Find programme by slug
    const { data: prog, error: progErr } = await supabase
      .from("programmes")
      .select("id, status, start_date, end_date, name, organization_id, chef_programme_id")
      .eq("form_slug", programme_slug)
      .single();

    if (progErr || !prog) return jsonRes({ error: "Programme non trouvé" }, 404);

    // Cohérent avec get-programme-form : le formulaire est fermé si le
    // programme est terminé ('completed' ou 'lost'), si end_date est dépassée,
    // OU si start_date n'est pas encore atteinte. Le status 'in_progress'
    // n'empêche PAS la soumission (cycle programme ≠ cycle formulaire).
    if (["completed", "lost"].includes(prog.status)) {
      return jsonRes({ error: "Ce programme est terminé et n'accepte plus de candidatures" }, 400);
    }
    if (prog.end_date && new Date(prog.end_date) < new Date()) {
      return jsonRes({ error: "La date limite de candidature est dépassée" }, 400);
    }
    if (prog.start_date && new Date(prog.start_date) > new Date()) {
      return jsonRes({ error: `Les candidatures ouvrent le ${new Date(prog.start_date).toLocaleDateString('fr-FR')}` }, 400);
    }

    // Check duplicate (same email + same programme)
    const { data: existing } = await supabase
      .from("candidatures")
      .select("id")
      .eq("programme_id", prog.id)
      .eq("contact_email", contact_email)
      .maybeSingle();

    if (existing) {
      return jsonRes({ error: "Une candidature avec cet email existe déjà pour ce programme" }, 409);
    }

    // Create candidature
    const candidatureData = {
      programme_id: prog.id,
      enterprise_id: null,
      organization_id: prog.organization_id || null,
      company_name,
      contact_name: contact_name || null,
      contact_email,
      contact_phone: contact_phone || null,
      form_data: form_data || {},
      documents: documents || [],
      status: "received",
      submitted_at: new Date().toISOString(),
    };

    const { data: candidature, error: insertErr } = await supabase
      .from("candidatures")
      .insert(candidatureData)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[submit-candidature] insert error:", insertErr);
      return jsonRes({ error: insertErr.message }, 500);
    }

    console.log(`[submit-candidature] ✅ ${company_name} → ${prog.name} (${candidature.id})`);

    // Notifier l'équipe (chef de programme + managers de l'org). Non bloquant.
    await notifyTeamNewCandidature(supabase, prog, { company_name, contact_name: contact_name || null, contact_email });

    // Auto-screen → dispatch worker Railway (parsing OCR + Claude jusqu'au bout,
    // sans l'éviction du waitUntil qui laissait les candidatures en NULL).
    const dispatched = await dispatchScreening(supabase, {
      programmeId: prog.id,
      candidatureIds: [candidature.id],
      organizationId: prog.organization_id,
      preferVision: false,
    });
    if (!dispatched) {
      await markScreeningError(supabase, candidature.id, "Dispatch worker échoué (auto-screen)");
    }

    return jsonRes({ success: true, candidature_id: candidature.id });

  } catch (e: any) {
    console.error("[submit-candidature] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
