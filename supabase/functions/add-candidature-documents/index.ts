import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchScreening, markScreeningError } from "../_shared/dispatch-screening.ts";
import { loadCandidatureManageContext, canManageProgrammeCandidatures } from "../_shared/candidature-permissions.ts";

// add-candidature-documents — permet à un admin/chef/manager d'ajouter des
// documents à une candidature (cas : l'entreprise ne parvient pas à uploader et
// envoie par email). Deux actions :
//   - get_upload_url : crée une signed upload URL vers le bucket candidature-documents.
//   - attach : fusionne les nouveaux docs (traçabilité serveur) dans candidatures.documents
//     puis relance le diagnostic (worker, prefer_vision=true).
// Authentifiée (getUser) + role-gated (canManageProgrammeCandidatures). verify_jwt=false
// car on fait le getUser nous-mêmes (comme screen-candidatures).

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

const UPLOADABLE_STATUSES = ["received", "pre_selected", "in_review", "selected"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const candidatureId = body.candidature_id as string | undefined;
    if (!candidatureId) return jsonRes({ error: "candidature_id requis" }, 400);

    // Candidature + programme (pour la garde de rôle multi-tenant).
    const { data: cand } = await supabase
      .from("candidatures")
      .select("id, status, documents, programme_id, programmes:programme_id(id, name, chef_programme_id, organization_id)")
      .eq("id", candidatureId)
      .maybeSingle();
    if (!cand) return jsonRes({ error: "Candidature introuvable" }, 404);
    const programme = (cand as any).programmes;

    const ctx = await loadCandidatureManageContext(supabase, user.id);
    if (!canManageProgrammeCandidatures(ctx, programme)) return jsonRes({ error: "Accès refusé" }, 403);

    // ── ACTION : get_upload_url ──
    if (body.action === "get_upload_url" && body.filename) {
      if (cand.status && !UPLOADABLE_STATUSES.includes(cand.status)) {
        return jsonRes({ error: "Cette candidature n'accepte plus de fichiers" }, 400);
      }
      const safeName = String(body.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${cand.id}/${Date.now()}_${safeName}`;
      const { data: signed, error: signErr } = await supabase.storage
        .from("candidature-documents")
        .createSignedUploadUrl(storagePath);
      if (signErr || !signed) return jsonRes({ error: signErr?.message || "Impossible de créer le lien d'upload" }, 500);
      return jsonRes({
        success: true,
        signed_url: signed.signedUrl,
        path: storagePath,
        storage_path: `candidature-documents/${storagePath}`,
      });
    }

    // ── ACTION : attach ──
    if (body.action === "attach") {
      const incoming = Array.isArray(body.documents) ? body.documents : [];
      if (incoming.length === 0) return jsonRes({ error: "Aucun document fourni" }, 400);

      // Nom lisible de qui ajoute (traçabilité serveur, non falsifiable).
      const { data: profile } = await supabase
        .from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      const byName = (profile?.full_name || profile?.email || user.email || "Coordinateur").toString();
      const now = new Date().toISOString();

      // Stampe la traçabilité côté serveur (le client ne peut pas la falsifier).
      const stamped = incoming
        .filter((d: any) => d && d.file_name && d.storage_path)
        .map((d: any) => ({
          field_label: d.field_label || "Ajouté par le coordinateur",
          file_name: String(d.file_name),
          file_size: d.file_size ?? null,
          storage_path: String(d.storage_path),
          source: "coordinator",
          added_by_id: user.id,
          added_by_name: byName,
          added_at: now,
        }));
      if (stamped.length === 0) return jsonRes({ error: "Documents invalides" }, 400);

      // Fusion dédup par file_name avec les docs existants (les nouveaux gagnent).
      const existing: any[] = Array.isArray(cand.documents) ? cand.documents : [];
      const byFileName = new Map<string, any>();
      for (const d of existing) if (d?.file_name) byFileName.set(d.file_name, d);
      for (const d of stamped) byFileName.set(d.file_name, d);
      const merged = Array.from(byFileName.values());

      const { error: updErr } = await supabase
        .from("candidatures")
        .update({ documents: merged, updated_at: now })
        .eq("id", cand.id);
      if (updErr) return jsonRes({ error: `Mise à jour échouée : ${updErr.message}` }, 500);

      // Re-diagnostic : un seul dispatch, haute fidélité (prefer_vision).
      const ok = await dispatchScreening(supabase, {
        programmeId: programme.id,
        candidatureIds: [cand.id],
        organizationId: programme.organization_id,
        preferVision: true,
      });
      if (!ok) await markScreeningError(supabase, cand.id, "Dispatch worker échoué (add-candidature-documents)");

      return jsonRes({ ok: true, added: stamped.length, total: merged.length, screening_dispatched: ok });
    }

    return jsonRes({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    console.error("[add-candidature-documents] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
