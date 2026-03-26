import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

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
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = roleData?.role === "super_admin";
    const isChef = roleData?.role === "chef_programme";
    const isCoach = roleData?.role === "coach";

    if (!isAdmin && !isChef && !isCoach) return jsonRes({ error: "Accès refusé" }, 403);

    const { programme_id, coach_id } = await req.json();
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    const targetCoachId = coach_id || (isCoach ? user.id : null);
    if (!targetCoachId) return jsonRes({ error: "coach_id requis" }, 400);

    // Permission check
    if (isCoach && targetCoachId !== user.id) return jsonRes({ error: "Accès refusé" }, 403);
    if (isChef) {
      const { data: prog } = await supabase.from("programmes").select("chef_programme_id").eq("id", programme_id).single();
      if (!prog || prog.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);
    }

    // Get coach profile
    const { data: coachProfile } = await supabase.from("profiles").select("full_name, email").eq("user_id", targetCoachId).maybeSingle();

    // Get selected candidatures for this coach in this programme
    const { data: candidatures } = await supabase
      .from("candidatures")
      .select("id, enterprise_id, company_name, screening_score")
      .eq("programme_id", programme_id)
      .eq("assigned_coach_id", targetCoachId)
      .eq("status", "selected");

    const enterpriseIds = (candidatures || []).map(c => c.enterprise_id).filter(Boolean);

    if (!enterpriseIds.length) {
      return jsonRes({
        success: true,
        coach: { id: targetCoachId, name: coachProfile?.full_name || "Inconnu", email: coachProfile?.email },
        enterprises: [],
        stats: { total: 0, avg_score: 0, avg_completion: 0, alerts: 0 },
      });
    }

    // Batch fetch
    const [entRes, delivRes, modRes, notesRes] = await Promise.all([
      supabase.from("enterprises").select("id, name, sector, country, city, updated_at").in("id", enterpriseIds),
      supabase.from("deliverables").select("enterprise_id, type, score, updated_at").in("enterprise_id", enterpriseIds),
      supabase.from("enterprise_modules").select("enterprise_id, module, status, progress, updated_at").in("enterprise_id", enterpriseIds),
      supabase.from("coaching_notes").select("enterprise_id, created_at, content").in("enterprise_id", enterpriseIds).order("created_at", { ascending: false }).limit(50),
    ]);

    const enterprises = entRes.data || [];
    const allDelivs = delivRes.data || [];
    const allMods = modRes.data || [];
    const allNotes = notesRes.data || [];

    const delivByEnt: Record<string, any[]> = {};
    const modByEnt: Record<string, any[]> = {};
    const notesByEnt: Record<string, any[]> = {};
    for (const d of allDelivs) (delivByEnt[d.enterprise_id] ||= []).push(d);
    for (const m of allMods) (modByEnt[m.enterprise_id] ||= []).push(m);
    for (const n of allNotes) (notesByEnt[n.enterprise_id] ||= []).push(n);

    let totalAlerts = 0;
    const entRows = enterprises.map(ent => {
      const delivs = delivByEnt[ent.id] || [];
      const mods = modByEnt[ent.id] || [];
      const notes = notesByEnt[ent.id] || [];

      const entScores = delivs.filter(d => d.score).map(d => Number(d.score));
      const scoreIr = entScores.length ? Math.round(entScores.reduce((a, b) => a + b, 0) / entScores.length) : 0;
      const completedMods = mods.filter(m => m.status === "completed").length;

      const allDates = [...delivs.map(d => d.updated_at), ...mods.map(m => m.updated_at)].filter(Boolean).sort().reverse();
      const lastActivity = allDates[0];

      const alerts: any[] = [];
      if (lastActivity && daysSince(lastActivity) > 7) {
        alerts.push({ type: "inactivity", message: `${daysSince(lastActivity)} jours sans activité` });
      }
      if (scoreIr > 0 && scoreIr < 40) {
        alerts.push({ type: "low_score", message: `Score ${scoreIr}/100` });
      }
      totalAlerts += alerts.length;

      const currentMod = mods.find(m => m.status !== "completed");

      return {
        id: ent.id,
        name: ent.name,
        sector: ent.sector,
        country: ent.country,
        score_ir: scoreIr,
        phase: currentMod?.module || "completed",
        modules_completed: completedMods,
        modules_total: mods.length || 7,
        completion_pct: mods.length ? Math.round((completedMods / mods.length) * 100) : 0,
        last_activity: lastActivity,
        coaching_notes_count: notes.length,
        last_note: notes[0]?.content?.slice(0, 100) || null,
        alerts,
        deliverables_summary: delivs.map(d => ({ type: d.type, score: d.score })),
      };
    });

    const scores = entRows.map(e => e.score_ir).filter(s => s > 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const avgCompletion = entRows.length ? Math.round(entRows.reduce((s, e) => s + e.completion_pct, 0) / entRows.length) : 0;

    return jsonRes({
      success: true,
      coach: { id: targetCoachId, name: coachProfile?.full_name || "Inconnu", email: coachProfile?.email },
      enterprises: entRows.sort((a, b) => (b.score_ir || 0) - (a.score_ir || 0)),
      stats: { total: entRows.length, avg_score: avgScore, avg_completion: avgCompletion, alerts: totalAlerts },
    });

  } catch (e: any) {
    console.error("[get-coach-portfolio] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
