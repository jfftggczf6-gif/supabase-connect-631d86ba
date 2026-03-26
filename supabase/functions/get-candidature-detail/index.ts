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

    // Check role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = roleData?.role === "super_admin";
    const isChef = roleData?.role === "chef_programme";
    const isCoach = roleData?.role === "coach";
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
      .select("id, name, organization, country_filter, sector_filter, criteria_id, chef_programme_id, programme_criteria:criteria_id(*)")
      .eq("id", candidature.programme_id)
      .single();

    // Check access
    if (isChef && programme?.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);
    if (isCoach && candidature.assigned_coach_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);

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
    if (candidature.enterprise_id) {
      const { data: ent } = await supabase
        .from("enterprises")
        .select("id, name, sector, country, city")
        .eq("id", candidature.enterprise_id)
        .maybeSingle();
      enterprise = ent;
    }

    return jsonRes({
      success: true,
      candidature: {
        ...candidature,
        assigned_coach: coach,
        enterprise,
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
