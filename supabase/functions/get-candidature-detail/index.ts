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

    // Check role (legacy + org)
    const [{ data: roleData }, { data: orgMems }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("organization_members").select("role, organization_id").eq("user_id", user.id).eq("is_active", true),
    ]);
    // Tri par priorité de rôle pour multi-membership (owner > admin > manager > coach > analyst > entrepreneur)
    const ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1, manager: 2, coach: 3, analyst: 4, entrepreneur: 5 };
    const bestMem = (orgMems || []).slice().sort((a: any, b: any) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99))[0];
    const orgRole = bestMem?.role;
    const userOrgId = bestMem?.organization_id;
    const isAdmin = roleData?.role === "super_admin";
    const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";
    const isChef = roleData?.role === "chef_programme" || isOwnerOrAdmin || orgRole === "manager";
    const isCoach = roleData?.role === "coach" || orgRole === "coach" || orgRole === "analyst";
    if (!isAdmin && !isChef && !isCoach) return jsonRes({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { candidature_id } = body;
    if (!candidature_id) return jsonRes({ error: "candidature_id requis" }, 400);

    // Get candidature with programme and criteria
    const { data: candidature, error: candErr } = await supabase
      .from("candidatures")
      .select("*")
      .eq("id", candidature_id)
      .single();

    if (candErr || !candidature) return jsonRes({ error: "Candidature non trouvée" }, 404);

    // Get programme with criteria
    const { data: programme } = await supabase
      .from("programmes")
      .select("id, name, organization, organization_id, country_filter, sector_filter, criteria_id, chef_programme_id, programme_criteria:criteria_id(*)")
      .eq("id", candidature.programme_id)
      .single();

    // Check access: super_admin OU owner/admin dans l'org OU chef_programme du programme OU coach assigné
    if (!isAdmin) {
      const canAccess =
        (isOwnerOrAdmin && programme?.organization_id === userOrgId) ||
        (isChef && programme?.chef_programme_id === user.id) ||
        (isCoach && candidature.assigned_coach_id === user.id);
      if (!canAccess) return jsonRes({ error: "Accès refusé" }, 403);
    }

    // Get coach info if assigned
    let coach = null;
    if (candidature.assigned_coach_id) {
      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", candidature.assigned_coach_id)
        .maybeSingle();
      coach = coachProfile;
    }

    // Get enterprise if linked
    let enterprise = null;
    let preScreeningData = null;
    if (candidature.enterprise_id) {
      const [{ data: ent }, { data: preScreenDeliv }] = await Promise.all([
        supabase
          .from("enterprises")
          .select("id, name, sector, country, city, score_ir")
          .eq("id", candidature.enterprise_id)
          .maybeSingle(),
        supabase
          .from("deliverables")
          .select("data, score")
          .eq("enterprise_id", candidature.enterprise_id)
          .eq("type", "pre_screening")
          .maybeSingle(),
      ]);
      enterprise = ent;
      if (preScreenDeliv?.data && typeof preScreenDeliv.data === "object") {
        preScreeningData = preScreenDeliv.data;
      }
    }

    return jsonRes({
      success: true,
      candidature: {
        ...candidature,
        assigned_coach: coach,
        enterprise,
        pre_screening_full: preScreeningData,
      },
      programme: programme ? {
        id: programme.id,
        name: programme.name,
        organization: programme.organization,
        country_filter: programme.country_filter,
        sector_filter: programme.sector_filter,
        criteria: programme.programme_criteria,
      } : null,
    });

  } catch (e: any) {
    console.error("[get-candidature-detail] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
