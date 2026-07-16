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

/**
 * Dispatch le diagnostic (screening) au worker Railway via ai_jobs + /run-agent.
 *
 * Remplace l'ancien autoScreen exécuté inline dans EdgeRuntime.waitUntil : ce
 * contexte d'arrière-plan était recyclé par Supabase AVANT la fin de la chaîne
 * (télécharger N docs + parser/OCR chacun + appel Claude ~60-120s), laissant les
 * candidatures en screening_data NULL. Sur Railway : pas de plafond 400s, pas
 * d'éviction, parsing OCR/vision jusqu'au bout. Le worker écrit lui-même
 * screening_score/screening_data (et un _error en cas d'échec).
 *
 * prefer_vision : false pour l'auto-screen (Tesseract + fallback Claude, coût
 * maîtrisé sur chaque soumission) ; le re-screen manuel force true.
 * Retourne true si le dispatch a été accepté.
 */
async function dispatchScreening(
  supabase: any,
  opts: { programmeId: string; candidatureIds: string[]; organizationId?: string | null; preferVision?: boolean },
): Promise<boolean> {
  const railwayUrl = Deno.env.get("RAILWAY_AI_URL");
  const railwayKey = Deno.env.get("RAILWAY_AI_KEY");
  if (!railwayUrl || !railwayKey) {
    console.error("[dispatch-screening] RAILWAY_AI_URL / RAILWAY_AI_KEY non configurés");
    return false;
  }

  const payload = {
    programme_id: opts.programmeId,
    candidature_ids: opts.candidatureIds,
    prefer_vision: opts.preferVision ?? false,
  };

  // 1. INSERT ai_jobs (le worker fait un .select() pour vérifier l'existence)
  const { data: job, error: jobErr } = await supabase
    .from("ai_jobs")
    .insert({
      agent_name: "screen-candidatures",
      payload,
      status: "pending",
      organization_id: opts.organizationId ?? null,
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    console.error("[dispatch-screening] INSERT ai_jobs failed:", jobErr?.message);
    return false;
  }

  // 2. POST /run-agent avec le job_id inséré
  try {
    const resp = await fetch(`${railwayUrl}/run-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Worker-API-Key": railwayKey },
      body: JSON.stringify({ agent_name: "screen-candidatures", job_id: job.id, payload }),
    });
    if (!resp.ok && resp.status !== 202) {
      const text = await resp.text().catch(() => "");
      console.error(`[dispatch-screening] worker dispatch failed: ${resp.status} ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("[dispatch-screening] worker unreachable:", e.message);
    return false;
  }
}

/** Marque une candidature en erreur de screening (panne visible côté UI). */
async function markScreeningError(supabase: any, candidatureId: string, reason: string) {
  await supabase.from("candidatures").update({
    screening_data: { _error: reason.slice(0, 500), _at: new Date().toISOString(), _source: "dispatch" },
    updated_at: new Date().toISOString(),
  }).eq("id", candidatureId);
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
      .select("id, status, start_date, end_date, name, organization_id")
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
