// gdpr-delete — RGPD Article 17: Right to erasure ("right to be forgotten")
// Permanently deletes all user data across all tables
// Requires confirmation token to prevent accidental deletion
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

    const body = await req.json();
    const { confirmation, user_id: targetUserId } = body;

    // Require explicit confirmation
    if (confirmation !== "SUPPRIMER_TOUTES_MES_DONNEES") {
      return errorResponse("Confirmation requise : envoyez { confirmation: 'SUPPRIMER_TOUTES_MES_DONNEES' }", 400);
    }

    const deleteUserId = targetUserId || user.id;

    // Only super_admin can delete other users
    if (deleteUserId !== user.id) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roles || []).some((r: any) => r.role === "super_admin")) {
        return errorResponse("Seuls les super_admins peuvent supprimer les données d'un autre utilisateur", 403);
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all enterprise IDs owned by this user
    const { data: ownedEnterprises } = await supabase
      .from("enterprises")
      .select("id")
      .eq("user_id", deleteUserId);
    const ownedIds = (ownedEnterprises || []).map((e: any) => e.id);

    const deletionLog: string[] = [];

    // Delete in dependency order (children first)
    if (ownedIds.length > 0) {
      // Deliverable versions + corrections for owned enterprises
      await supabase.from("deliverable_versions").delete().in("enterprise_id", ownedIds);
      deletionLog.push(`deliverable_versions for ${ownedIds.length} enterprises`);

      await supabase.from("deliverable_corrections").delete().in("enterprise_id", ownedIds);
      deletionLog.push("deliverable_corrections");

      // Deliverables
      await supabase.from("deliverables").delete().in("enterprise_id", ownedIds);
      deletionLog.push("deliverables");

      // Enterprise modules
      await supabase.from("enterprise_modules").delete().in("enterprise_id", ownedIds);
      deletionLog.push("enterprise_modules");

      // Score history, inputs history
      await supabase.from("score_history").delete().in("enterprise_id", ownedIds);
      await supabase.from("inputs_history").delete().in("enterprise_id", ownedIds);
      deletionLog.push("score_history, inputs_history");

      // Data room
      await supabase.from("data_room_shares").delete().in("enterprise_id", ownedIds);
      await supabase.from("data_room_documents").delete().in("enterprise_id", ownedIds);
      deletionLog.push("data_room");

      // Funding matches
      await supabase.from("funding_matches").delete().in("enterprise_id", ownedIds);
      deletionLog.push("funding_matches");
    }

    // Coaching notes + uploads by this user (as coach)
    await supabase.from("coaching_notes").delete().eq("coach_id", deleteUserId);
    deletionLog.push("coaching_notes");

    await supabase.from("coach_uploads").delete().eq("coach_id", deleteUserId);
    deletionLog.push("coach_uploads");

    // Enterprise coaches (N-to-N)
    await supabase.from("enterprise_coaches").delete().eq("coach_id", deleteUserId);
    deletionLog.push("enterprise_coaches");

    // Activity log
    await supabase.from("activity_log").delete().eq("actor_id", deleteUserId);
    deletionLog.push("activity_log");

    // AI cost log (anonymize instead of delete — keep for billing)
    await supabase.from("ai_cost_log").update({ user_id: null }).eq("user_id", deleteUserId);
    deletionLog.push("ai_cost_log (anonymized)");

    // Remove coach_id from enterprises (detach, don't delete the enterprise if owned by entrepreneur)
    await supabase.from("enterprises").update({ coach_id: null }).eq("coach_id", deleteUserId);
    deletionLog.push("enterprises.coach_id nullified");

    // Delete owned enterprises (only those where user_id = deleteUserId)
    if (ownedIds.length > 0) {
      await supabase.from("enterprises").delete().in("id", ownedIds);
      deletionLog.push(`${ownedIds.length} owned enterprises deleted`);
    }

    // Organization memberships
    await supabase.from("organization_members").delete().eq("user_id", deleteUserId);
    deletionLog.push("organization_members");

    // User roles
    await supabase.from("user_roles").delete().eq("user_id", deleteUserId);
    deletionLog.push("user_roles");

    // Profile
    await supabase.from("profiles").delete().eq("user_id", deleteUserId);
    deletionLog.push("profile");

    // Delete storage files for owned enterprises
    if (ownedIds.length > 0) {
      for (const entId of ownedIds) {
        const { data: files } = await supabase.storage.from("documents").list(entId);
        if (files?.length) {
          const paths = files.map(f => `${entId}/${f.name}`);
          await supabase.storage.from("documents").remove(paths);
        }
      }
      deletionLog.push("storage files");
    }

    // Finally delete auth user (requires admin API)
    const { error: deleteAuthErr } = await supabase.auth.admin.deleteUser(deleteUserId);
    if (deleteAuthErr) {
      deletionLog.push(`auth user deletion failed: ${deleteAuthErr.message}`);
    } else {
      deletionLog.push("auth user deleted");
    }

    // Log the deletion (in a separate admin log since user is now deleted)
    console.log(`[gdpr-delete] User ${deleteUserId} data purged. Actions: ${deletionLog.join(', ')}`);

    return jsonResponse({
      success: true,
      message: "Toutes les données ont été supprimées conformément au RGPD Article 17",
      user_id: deleteUserId,
      actions: deletionLog,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error("[gdpr-delete] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
