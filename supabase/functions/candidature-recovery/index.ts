// candidature-recovery — liens de complétion de dossier : un candidat peut
// (re)déposer les documents demandés (formulaire + sur-mesure) et des pièces
// supplémentaires, via un lien sécurisé à usage unique (7 jours).
//
// Actions :
//   - "generate"   : super_admin OU chef_programme propriétaire. Crée un token +
//                    7j d'expiration, stocke les demandes sur-mesure, renvoie l'URL
//                    et les infos candidat (pour l'email).
//   - "info"        : public + token. Renvoie la checklist (docs formulaire +
//                     sur-mesure + déjà fournis).
//   - "upload_url"  : public + token. Crée une signed upload URL pour un fichier.
//   - "submit"      : public + token. Reçoit la liste FUSIONNÉE des documents et
//                     met à jour documents[]. Marque le token comme utilisé.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadCandidatureManageContext, canManageProgrammeCandidatures } from "../_shared/candidature-permissions.ts";

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

function generateToken(): string {
  // 64 chars hex (32 bytes random) — ne fuite pas la candidature_id et est non devinable
  return crypto.getRandomValues(new Uint8Array(32))
    .reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const action = body.action as 'generate' | 'info' | 'submit';

    // ───────────────────────────────────────────────────────────────────────
    // ACTION : generate
    // Autorisé au super_admin (global) OU au chef_programme propriétaire du
    // programme de la candidature — même modèle d'auth que update-candidature
    // (boutons Pré-sélectionner / Sélectionner / Rejeter du même drawer).
    // ───────────────────────────────────────────────────────────────────────
    if (action === 'generate') {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Authentification requise" }, 401);

      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return jsonRes({ error: "Non authentifié" }, 401);

      const candidatureId = body.candidature_id as string;
      if (!candidatureId) return jsonRes({ error: "candidature_id requis" }, 400);

      // Demandes de documents sur-mesure (libellés saisis par le chef pour CE candidat)
      const requestedDocs: string[] = Array.isArray(body.requested_docs)
        ? body.requested_docs.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 30)
        : [];

      // Charge la candidature + son programme (pour la permission + l'email)
      const { data: cand } = await adminClient
        .from("candidatures")
        .select("id, company_name, contact_name, contact_email, programmes:programme_id(name, chef_programme_id, organization_id)")
        .eq("id", candidatureId)
        .maybeSingle();
      if (!cand) return jsonRes({ error: "Candidature non trouvée" }, 404);

      const programme = cand.programmes as any;

      // Permission d'écriture : super_admin OU chef propriétaire OU owner/admin/manager
      // de l'org du programme (règle partagée, alignée sur l'accès en lecture).
      const ctx = await loadCandidatureManageContext(adminClient, user.id);
      if (!canManageProgrammeCandidatures(ctx, programme)) {
        return jsonRes({ error: "Accès refusé" }, 403);
      }

      // Génère le token + 7 jours d'expiration
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updErr } = await adminClient
        .from("candidatures")
        .update({
          recovery_token: token,
          recovery_expires_at: expiresAt,
          recovery_used_at: null, // reset si on régénère
          recovery_requested_docs: requestedDocs,
        })
        .eq("id", candidatureId);
      if (updErr) return jsonRes({ error: updErr.message }, 500);

      // Construit l'URL — on prend l'origin depuis le header ou un fallback ENV
      const origin = body.origin
        || req.headers.get('origin')
        || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || Deno.env.get("APP_BASE_URL")
        || 'https://esono.tech';
      const recoveryUrl = `${origin}/candidature/recovery/${token}`;

      return jsonRes({
        success: true,
        token,
        recovery_url: recoveryUrl,
        expires_at: expiresAt,
        contact_email: cand.contact_email,
        contact_name: cand.contact_name,
        company_name: cand.company_name,
        programme_name: programme?.name || null,
      });
    }

    // ───────────────────────────────────────────────────────────────────────
    // ACTION : info (public, sécurisé par token)
    // ───────────────────────────────────────────────────────────────────────
    if (action === 'info') {
      const token = body.token as string;
      if (!token || token.length < 20) return jsonRes({ error: "Token invalide" }, 400);

      const { data: cand } = await adminClient
        .from("candidatures")
        .select("id, company_name, contact_name, contact_email, documents, recovery_requested_docs, recovery_expires_at, recovery_used_at, programmes:programme_id(name, form_fields)")
        .eq("recovery_token", token)
        .maybeSingle();

      if (!cand) return jsonRes({ error: "Lien invalide ou expiré" }, 404);
      if (cand.recovery_used_at) return jsonRes({ error: "Ce lien a déjà été utilisé" }, 410);
      if (cand.recovery_expires_at && new Date(cand.recovery_expires_at) < new Date()) {
        return jsonRes({ error: "Ce lien a expiré. Demande un nouveau lien à ton chef de programme." }, 410);
      }

      // Documents déjà attachés (on renvoie storage_path : la page renverra la
      // liste FUSIONNÉE complète à la soumission, sans perdre l'existant).
      const existingDocuments = Array.isArray(cand.documents)
        ? (cand.documents as any[]).map((d: any) => ({
            field_label: d.field_label,
            file_name: d.file_name,
            file_size: d.file_size ?? null,
            storage_path: d.storage_path,
          }))
        : [];

      // Pièces demandées par le formulaire du programme (champs de type "file").
      const formFields = Array.isArray((cand.programmes as any)?.form_fields)
        ? (cand.programmes as any).form_fields
        : [];
      const formFileLabels = formFields
        .filter((f: any) => f?.type === 'file' && f?.label)
        .map((f: any) => String(f.label));

      // Pièces demandées sur-mesure par le chef pour CE candidat.
      const customRequestedLabels = Array.isArray(cand.recovery_requested_docs)
        ? (cand.recovery_requested_docs as any[]).map((s: any) => String(s))
        : [];

      return jsonRes({
        success: true,
        candidature_id: cand.id,
        company_name: cand.company_name,
        contact_name: cand.contact_name,
        programme_name: (cand.programmes as any)?.name || null,
        form_file_labels: formFileLabels,
        custom_requested_labels: customRequestedLabels,
        existing_documents: existingDocuments,
        // Rétro-compat : ancienne page recovery
        expected_files: existingDocuments.map(({ field_label, file_name, file_size }) => ({ field_label, file_name, file_size })),
        expires_at: cand.recovery_expires_at,
      });
    }

    // ───────────────────────────────────────────────────────────────────────
    // ACTION : upload_url (public, sécurisé par token)
    // Crée une signed upload URL pour un fichier donné. Le client (page recovery)
    // utilisera ensuite cette URL pour uploader directement via PUT, sans avoir
    // à passer par une policy RLS anon (qui peut être bloquée selon config).
    // ───────────────────────────────────────────────────────────────────────
    if (action === 'upload_url') {
      const token = body.token as string;
      const filename = body.filename as string;

      if (!token || token.length < 20) return jsonRes({ error: "Token invalide" }, 400);
      if (!filename) return jsonRes({ error: "filename requis" }, 400);

      const { data: cand } = await adminClient
        .from("candidatures")
        .select("id, recovery_expires_at, recovery_used_at")
        .eq("recovery_token", token)
        .maybeSingle();
      if (!cand) return jsonRes({ error: "Lien invalide" }, 404);
      if (cand.recovery_used_at) return jsonRes({ error: "Ce lien a déjà été utilisé" }, 410);
      if (cand.recovery_expires_at && new Date(cand.recovery_expires_at) < new Date()) {
        return jsonRes({ error: "Ce lien a expiré" }, 410);
      }

      // Sanitize le filename et construit le storage path
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${cand.id}/${Date.now()}_${safeName}`;
      const fullStoragePath = `candidature-documents/${storagePath}`;

      // Génère une signed upload URL (valable 60s) via service_role
      const { data: signed, error: signErr } = await adminClient.storage
        .from('candidature-documents')
        .createSignedUploadUrl(storagePath);
      if (signErr || !signed) {
        return jsonRes({ error: signErr?.message || "Impossible de créer le lien d'upload" }, 500);
      }

      return jsonRes({
        success: true,
        signed_url: signed.signedUrl,
        upload_token: signed.token,
        path: storagePath,            // path à l'intérieur du bucket
        storage_path: fullStoragePath, // path complet à stocker en DB
      });
    }

    // ───────────────────────────────────────────────────────────────────────
    // ACTION : submit (public, sécurisé par token + nouveaux storage_paths)
    // ───────────────────────────────────────────────────────────────────────
    if (action === 'submit') {
      const token = body.token as string;
      const newDocuments = body.documents; // [{field_label, file_name, file_size, storage_path}]

      if (!token) return jsonRes({ error: "Token requis" }, 400);
      if (!Array.isArray(newDocuments) || newDocuments.length === 0) {
        return jsonRes({ error: "Aucun document à enregistrer" }, 400);
      }

      const { data: cand } = await adminClient
        .from("candidatures")
        .select("id, recovery_expires_at, recovery_used_at")
        .eq("recovery_token", token)
        .maybeSingle();
      if (!cand) return jsonRes({ error: "Lien invalide" }, 404);
      if (cand.recovery_used_at) return jsonRes({ error: "Ce lien a déjà été utilisé" }, 410);
      if (cand.recovery_expires_at && new Date(cand.recovery_expires_at) < new Date()) {
        return jsonRes({ error: "Ce lien a expiré" }, 410);
      }

      // Validation des storage_paths : doivent pointer vers un bucket candidature
      // connu. On accepte les documents fraîchement uploadés (candidature-documents/)
      // ET les documents existants re-renvoyés par la page de complétion, qui
      // peuvent dater d'un bucket historique (candidature_uploads/).
      const ALLOWED_BUCKETS = ['candidature-documents/', 'candidature_uploads/'];
      for (const doc of newDocuments) {
        const path = String(doc.storage_path || '');
        if (!ALLOWED_BUCKETS.some(b => path.startsWith(b))) {
          return jsonRes({ error: `Chemin invalide pour ${doc.file_name}` }, 400);
        }
        if (!doc.field_label || !doc.file_name) {
          return jsonRes({ error: "field_label et file_name requis" }, 400);
        }
      }

      // Met à jour les documents et marque le token comme utilisé
      const { error: updErr } = await adminClient
        .from("candidatures")
        .update({
          documents: newDocuments,
          recovery_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cand.id);
      if (updErr) return jsonRes({ error: updErr.message }, 500);

      // Relance l'auto-screening (Railway parse + IA ré-analyse avec les docs maintenant
      // disponibles). On le fait via un appel à submit-candidature action=update_documents
      // qui sait déjà gérer le re-screen en background.
      try {
        await fetch(`${supabaseUrl}/functions/v1/submit-candidature`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': Deno.env.get("SUPABASE_ANON_KEY")!,
          },
          body: JSON.stringify({
            action: 'update_documents',
            candidature_id: cand.id,
            documents: newDocuments,
          }),
        }).catch(() => {}); // non-bloquant : si le re-screen échoue, le user voit quand même son rattrapage validé
      } catch (_) { /* non-bloquant */ }

      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    console.error("[candidature-recovery] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
