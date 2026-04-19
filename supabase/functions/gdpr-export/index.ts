// gdpr-export — RGPD Article 20: Right to data portability
// Exports all user data as JSON (profile, enterprises, deliverables, coaching notes, activity)
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.user_id || user.id;

    // Only super_admin can export other users' data
    if (targetUserId !== user.id) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roles || []).some((r: any) => r.role === "super_admin")) {
        return errorResponse("Seuls les super_admins peuvent exporter les données d'un autre utilisateur", 403);
      }
    }

    // Collect all user data
    const [
      { data: profile },
      { data: userRoles },
      { data: orgMembers },
      { data: enterprises },
      { data: coachingNotes },
      { data: coachUploads },
      { data: activity },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", targetUserId).single(),
      supabase.from("user_roles").select("*").eq("user_id", targetUserId),
      supabase.from("organization_members").select("*, organizations:organization_id(name, slug)").eq("user_id", targetUserId),
      supabase.from("enterprises").select("id, name, sector, country, contact_email, contact_name, contact_phone, created_at, score_ir, phase").or(`user_id.eq.${targetUserId},coach_id.eq.${targetUserId}`),
      supabase.from("coaching_notes").select("id, enterprise_id, titre, input_type, raw_content, resume_ia, created_at").eq("coach_id", targetUserId).order("created_at", { ascending: false }).limit(500),
      supabase.from("coach_uploads").select("id, enterprise_id, filename, category, file_size, created_at").eq("coach_id", targetUserId).order("created_at", { ascending: false }).limit(500),
      supabase.from("activity_log").select("action, deliverable_type, metadata, created_at").eq("actor_id", targetUserId).order("created_at", { ascending: false }).limit(1000),
    ]);

    // Get deliverables for user's enterprises
    const entIds = (enterprises || []).map((e: any) => e.id);
    let deliverables: any[] = [];
    if (entIds.length > 0) {
      const { data: delivs } = await supabase
        .from("deliverables")
        .select("enterprise_id, type, score, version, created_at, updated_at")
        .in("enterprise_id", entIds)
        .order("created_at", { ascending: false });
      deliverables = delivs || [];
    }

    const exportData = {
      export_date: new Date().toISOString(),
      export_type: "RGPD Article 20 — Data Portability",
      user: {
        id: targetUserId,
        email: user.email,
        profile,
        roles: userRoles,
        organization_memberships: orgMembers,
      },
      enterprises: enterprises || [],
      deliverables_summary: deliverables.map((d: any) => ({
        enterprise_id: d.enterprise_id,
        type: d.type,
        score: d.score,
        version: d.version,
        created_at: d.created_at,
      })),
      coaching_notes: coachingNotes || [],
      uploads: coachUploads || [],
      activity_log: activity || [],
    };

    // Log the export
    await supabase.from("activity_log").insert({
      actor_id: user.id,
      actor_role: "user",
      action: "gdpr_export",
      metadata: { target_user_id: targetUserId, items_count: Object.values(exportData).flat().length },
    }).catch(() => {});

    return jsonResponse(exportData);

  } catch (err: any) {
    console.error("[gdpr-export] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
