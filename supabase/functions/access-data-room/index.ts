// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // SECURITY: Only accept POST — token must never be in URL
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { token, slug } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Find share by token
    const { data: share, error: shareErr } = await sb
      .from("data_room_shares")
      .select("*")
      .eq("access_token", token)
      .maybeSingle();

    if (shareErr || !share) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Ce lien a expiré" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify slug matches enterprise (additional security layer)
    if (slug) {
      const { data: ent } = await sb
        .from("enterprises")
        .select("data_room_slug")
        .eq("id", share.enterprise_id)
        .single();
      if (ent?.data_room_slug && ent.data_room_slug !== slug) {
        return new Response(JSON.stringify({ error: "Token invalide pour cette Data Room" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Mark as viewed
    if (!share.viewed_at) {
      await sb.from("data_room_shares").update({ viewed_at: new Date().toISOString() }).eq("id", share.id);
    }

    // Get enterprise info
    const { data: enterprise } = await sb
      .from("enterprises")
      .select("name, sector, country, description")
      .eq("id", share.enterprise_id)
      .single();

    // Get documents
    const { data: documents } = await sb
      .from("data_room_documents")
      .select("id, category, label, filename, storage_path, file_size, evidence_level, is_generated, created_at")
      .eq("enterprise_id", share.enterprise_id)
      .order("category")
      .order("created_at", { ascending: false });

    // Generate signed URLs for documents if download is allowed
    const docsWithUrls = [];
    for (const doc of documents || []) {
      let downloadUrl = null;
      if (share.can_download) {
        const { data: signed } = await sb.storage
          .from("documents")
          .createSignedUrl(doc.storage_path, 3600);
        downloadUrl = signed?.signedUrl || null;
      }
      docsWithUrls.push({ ...doc, download_url: downloadUrl });
    }

    return new Response(JSON.stringify({
      enterprise,
      investor_name: share.investor_name,
      can_download: share.can_download,
      documents: docsWithUrls,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("access-data-room error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
