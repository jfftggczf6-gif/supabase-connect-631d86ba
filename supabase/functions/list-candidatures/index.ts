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

    // Auth user
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRole = roleData?.role;
    const isAdmin = userRole === "super_admin";
    const isChefProg = userRole === "chef_programme";
    const isCoach = userRole === "coach";

    if (!isAdmin && !isChefProg && !isCoach) return jsonRes({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { programme_id, status: filterStatus, search } = body;

    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    // Check programme access for chef_programme
    if (isChefProg) {
      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id")
        .eq("id", programme_id)
        .single();
      if (!prog || prog.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);
    }

    // Build query
    let query = supabase
      .from("candidatures")
      .select("*")
      .eq("programme_id", programme_id)
      .order("submitted_at", { ascending: false });

    // Coach: only sees assigned candidatures
    if (isCoach) {
      query = query.eq("assigned_coach_id", user.id);
    }

    // Filter by status
    if (filterStatus) {
      query = query.eq("status", filterStatus);
    }

    // Search by company name or contact
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`);
    }

    const { data: candidatures, error: listErr } = await query;
    if (listErr) return jsonRes({ error: listErr.message }, 500);

    // Stats (all candidatures for this programme, not filtered)
    let statsQuery = supabase
      .from("candidatures")
      .select("status")
      .eq("programme_id", programme_id);

    if (isCoach) {
      statsQuery = statsQuery.eq("assigned_coach_id", user.id);
    }

    const { data: allCandidatures } = await statsQuery;

    const stats = {
      total: allCandidatures?.length || 0,
      received: 0,
      in_review: 0,
      pre_selected: 0,
      rejected: 0,
      selected: 0,
      waitlisted: 0,
    };

    for (const c of allCandidatures || []) {
      const s = c.status as keyof typeof stats;
      if (s in stats && s !== "total") stats[s]++;
    }

    return jsonRes({ success: true, candidatures: candidatures || [], stats });

  } catch (e: any) {
    console.error("[list-candidatures] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
