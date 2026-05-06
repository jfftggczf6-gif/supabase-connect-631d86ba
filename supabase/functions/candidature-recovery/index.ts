// candidature-recovery — gestion des liens de rattrapage pour les candidatures
// dont les fichiers ont été perdus (cas FoodSen — uploads échoués silencieusement).
//
// Actions :
//   - "generate" : super_admin uniquement. Crée un token + 7j d'expiration. Renvoie l'URL.
//   - "info"     : public. Vérifie le token et renvoie les infos minimales (nom entreprise, liste des
//                  fichiers attendus avec field_label) pour que le candidat sache quoi re-uploader.
//   - "submit"   : public. Reçoit la liste des nouveaux storage_paths et met à jour documents[].
//                  Marque le token comme utilisé (recovery_used_at).
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
    // ACTION : generate (super_admin only)
    // ───────────────────────────────────────────────────────────────────────
    if (action === 'generate') {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Authentification requise" }, 401);

      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return jsonRes({ error: "Non authentifié" }, 401);

      // Vérifie que c'est un super_admin
      const { data: roleData } = await adminClient
        .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (roleData?.role !== 'super_admin') {
        return jsonRes({ error: "Réservé au super admin" }, 403);
      }

      const candidatureId = body.candidature_id as string;
      if (!candidatureId) return jsonRes({ error: "candidature_id requis" }, 400);

      // Génère le token + 7 jours d'expiration
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updErr } = await adminClient
        .from("candidatures")
        .update({
          recovery_token: token,
          recovery_expires_at: expiresAt,
          recovery_used_at: null, // reset si on régénère
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

      return jsonRes({ success: true, token, recovery_url: recoveryUrl, expires_at: expiresAt });
    }

    // ───────────────────────────────────────────────────────────────────────
    // ACTION : info (public, sécurisé par token)
    // ───────────────────────────────────────────────────────────────────────
    if (action === 'info') {
      const token = body.token as string;
      if (!token || token.length < 20) return jsonRes({ error: "Token invalide" }, 400);

      const { data: cand } = await adminClient
        .from("candidatures")
        .select("id, company_name, contact_name, contact_email, documents, recovery_expires_at, recovery_used_at, programmes:programme_id(name)")
        .eq("recovery_token", token)
        .maybeSingle();

      if (!cand) return jsonRes({ error: "Lien invalide ou expiré" }, 404);
      if (cand.recovery_used_at) return jsonRes({ error: "Ce lien a déjà été utilisé" }, 410);
      if (cand.recovery_expires_at && new Date(cand.recovery_expires_at) < new Date()) {
        return jsonRes({ error: "Ce lien a expiré. Demande un nouveau lien à ton chef de programme." }, 410);
      }

      // On retourne juste ce dont la page recovery a besoin (pas d'infos sensibles)
      const expectedFiles = Array.isArray(cand.documents)
        ? (cand.documents as any[]).map((d: any) => ({
            field_label: d.field_label,
            file_name: d.file_name,
            file_size: d.file_size,
          }))
        : [];

      return jsonRes({
        success: true,
        candidature_id: cand.id,
        company_name: cand.company_name,
        contact_name: cand.contact_name,
        programme_name: (cand.programmes as any)?.name || null,
        expected_files: expectedFiles,
        expires_at: cand.recovery_expires_at,
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

      // Validation des storage_paths : doivent être dans candidature-documents/
      for (const doc of newDocuments) {
        if (!doc.storage_path || !String(doc.storage_path).startsWith('candidature-documents/')) {
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

      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    console.error("[candidature-recovery] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
