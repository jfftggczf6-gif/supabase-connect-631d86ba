// supabase/functions/upload-org-logo/index.ts
// Upload logo org BA. Bypasse RLS storage.objects (MCP n'a pas les privilèges
// pour créer les policies sur storage.objects) via service role.
//
// Check côté code : seul owner/admin/managing_director de l'org peut uploader
// pour son organization_id. Path : {organization_id}/logo-{timestamp}.{ext}
//
// Request body : multipart/form-data avec field "file" (File) + "organization_id" (text)
// Response 200 : { success: true, logo_url: string }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_ROLES = ['owner', 'admin', 'managing_director'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err(401, 'Missing Authorization');

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Auth user via anon key + bearer token
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return err(401, 'Invalid token');

    // 2. Parse multipart form
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const organizationId = formData.get('organization_id') as string | null;
    if (!file) return err(400, 'Missing file');
    if (!organizationId) return err(400, 'Missing organization_id');
    if (!ALLOWED_MIME.includes(file.type)) return err(400, `Mime non autorisé : ${file.type}`);
    if (file.size > MAX_SIZE) return err(400, 'Fichier trop volumineux (max 2 MB)');

    // 3. Vérifier que user est owner/admin/MD de l'org (via service role pour bypasser RLS)
    const admin = createClient(url, serviceKey);
    const { data: membership, error: mErr } = await admin
      .from('organization_members')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();
    if (mErr) return err(500, `Vérif membership : ${mErr.message}`);
    if (!membership) return err(403, 'Pas membre de cette org');
    if (!ALLOWED_ROLES.includes(membership.role)) {
      return err(403, `Rôle ${membership.role} non autorisé (owner/admin/MD only)`);
    }

    // 4. Upload via service role (bypasse RLS storage.objects)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${organizationId}/logo-${Date.now()}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: upErr } = await admin.storage
      .from('org_logos')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });
    if (upErr) return err(500, `Upload échoué : ${upErr.message}`);

    const { data: pub } = admin.storage.from('org_logos').getPublicUrl(path);
    return ok({ success: true, logo_url: pub.publicUrl, path });
  } catch (e: any) {
    console.error('[upload-org-logo]', e);
    return err(500, e?.message ?? 'Erreur serveur');
  }
});

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
