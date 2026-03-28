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

function computeAlerts(ent: any, deliverables: any[], modules: any[]): any[] {
  const alerts: any[] = [];

  // Last activity = most recent deliverable or module update
  const dates = [
    ...deliverables.map(d => d.updated_at),
    ...modules.map(m => m.updated_at),
  ].filter(Boolean).sort().reverse();
  const lastActivity = dates[0];

  if (lastActivity && daysSince(lastActivity) > 7) {
    alerts.push({ type: "inactivity", severity: "warning", message: `Pas d'activité depuis ${daysSince(lastActivity)} jours` });
  }

  const scores = deliverables.filter(d => d.score).map(d => Number(d.score));
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  if (avgScore > 0 && avgScore < 40) {
    alerts.push({ type: "low_score", severity: "danger", message: `Score IR moyen faible : ${avgScore}/100` });
  }

  if (deliverables.length === 0) {
    alerts.push({ type: "no_deliverables", severity: "info", message: "Aucun livrable généré" });
  }

  const completedModules = modules.filter(m => m.status === "completed").length;
  if (modules.length > 0 && completedModules === 0 && lastActivity && daysSince(lastActivity) > 3) {
    alerts.push({ type: "stuck", severity: "warning", message: "Aucun module complété" });
  }

  return alerts;
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
    if (!isAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const { programme_id } = await req.json();
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    // Get programme
    const { data: programme } = await supabase.from("programmes").select("*").eq("id", programme_id).single();
    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);
    if (isChef && programme.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);

    // Get selected candidatures → enterprise_ids
    const { data: candidatures } = await supabase
      .from("candidatures")
      .select("id, enterprise_id, assigned_coach_id, screening_score")
      .eq("programme_id", programme_id)
      .eq("status", "selected");

    const enterpriseIds = (candidatures || []).map(c => c.enterprise_id).filter(Boolean);

    if (!enterpriseIds.length) {
      return jsonRes({
        success: true,
        programme: { name: programme.name, status: programme.status, nb_places: programme.nb_places },
        kpis: { total_selected: 0, total_active: 0, score_ir_moyen: 0, score_ir_median: 0, modules_completion: {}, pipeline_completion_pct: 0, alerts_count: 0 },
        by_coach: [],
        enterprises: [],
        score_distribution: [],
      });
    }

    // Batch fetch enterprises, deliverables, modules, score_history, activity_log
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [entRes, delivRes, modRes, profilesRes, notesRes, scoreHistRes, activityRes] = await Promise.all([
      supabase.from("enterprises").select("id, name, coach_id, sector, country, updated_at").in("id", enterpriseIds),
      supabase.from("deliverables").select("enterprise_id, type, score, updated_at").in("enterprise_id", enterpriseIds),
      supabase.from("enterprise_modules").select("enterprise_id, module, status, progress, updated_at").in("enterprise_id", enterpriseIds),
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("coaching_notes").select("enterprise_id, titre, created_at").in("enterprise_id", enterpriseIds),
      supabase.from("score_history").select("enterprise_id, score, created_at").in("enterprise_id", enterpriseIds).gte("created_at", thirtyDaysAgo).order("created_at"),
      supabase.from("activity_log").select("enterprise_id, action, deliverable_type, metadata, created_at").in("enterprise_id", enterpriseIds).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(50),
    ]);

    const enterprises = entRes.data || [];
    const allDeliverables = delivRes.data || [];
    const allModules = modRes.data || [];
    const profiles = profilesRes.data || [];
    const coachingNotes = notesRes.data || [];
    const scoreHistory = scoreHistRes.data || [];
    const activityLog = activityRes.data || [];

    const profileMap: Record<string, any> = {};
    for (const p of profiles) profileMap[p.user_id] = p;

    // Group by enterprise
    const delivByEnt: Record<string, any[]> = {};
    const modByEnt: Record<string, any[]> = {};
    for (const d of allDeliverables) { (delivByEnt[d.enterprise_id] ||= []).push(d); }
    for (const m of allModules) { (modByEnt[m.enterprise_id] ||= []).push(m); }

    // Build enterprise rows
    const MODULE_TYPES = ["bmc", "sic", "inputs", "framework", "diagnostic", "plan_financier", "business_plan"];
    const modulesCompletion: Record<string, { completed: number; in_progress: number; not_started: number }> = {};
    for (const mt of MODULE_TYPES) modulesCompletion[mt] = { completed: 0, in_progress: 0, not_started: 0 };

    const enterpriseRows: any[] = [];
    const scores: number[] = [];
    let totalAlerts = 0;

    for (const ent of enterprises) {
      const delivs = delivByEnt[ent.id] || [];
      const mods = modByEnt[ent.id] || [];
      const alerts = computeAlerts(ent, delivs, mods);
      totalAlerts += alerts.length;

      const entScores = delivs.filter(d => d.score).map(d => Number(d.score));
      const scoreIr = entScores.length ? Math.round(entScores.reduce((a, b) => a + b, 0) / entScores.length) : 0;
      if (scoreIr > 0) scores.push(scoreIr);

      const completedMods = mods.filter(m => m.status === "completed").length;

      // Last activity
      const allDates = [...delivs.map(d => d.updated_at), ...mods.map(m => m.updated_at)].filter(Boolean).sort().reverse();

      // Current phase = first non-completed module
      const currentMod = mods.find(m => m.status !== "completed");

      // Aggregate modules completion
      for (const m of mods) {
        const key = m.module;
        if (modulesCompletion[key]) {
          if (m.status === "completed") modulesCompletion[key].completed++;
          else if (m.status === "in_progress") modulesCompletion[key].in_progress++;
          else modulesCompletion[key].not_started++;
        }
      }

      const coachProfile = profileMap[ent.coach_id];
      enterpriseRows.push({
        id: ent.id,
        name: ent.name,
        sector: ent.sector,
        country: ent.country,
        coach_id: ent.coach_id,
        coach_name: coachProfile?.full_name || "Non assigné",
        score_ir: scoreIr,
        phase: currentMod?.module || "completed",
        modules_completed: completedMods,
        modules_total: mods.length || MODULE_TYPES.length,
        last_activity: allDates[0] || null,
        alerts,
      });
    }

    // By coach aggregation
    const coachMap: Record<string, { coach_id: string; coach_name: string; enterprises: any[] }> = {};
    for (const ent of enterpriseRows) {
      if (!coachMap[ent.coach_id]) {
        coachMap[ent.coach_id] = { coach_id: ent.coach_id, coach_name: ent.coach_name, enterprises: [] };
      }
      coachMap[ent.coach_id].enterprises.push(ent);
    }

    const byCoach = Object.values(coachMap).map(c => ({
      coach_id: c.coach_id,
      coach_name: c.coach_name,
      enterprises_count: c.enterprises.length,
      avg_score: c.enterprises.length ? Math.round(c.enterprises.reduce((s, e) => s + e.score_ir, 0) / c.enterprises.length) : 0,
      avg_completion: c.enterprises.length ? Math.round(c.enterprises.reduce((s, e) => s + (e.modules_completed / e.modules_total) * 100, 0) / c.enterprises.length) : 0,
      last_activity: c.enterprises.map(e => e.last_activity).filter(Boolean).sort().reverse()[0] || null,
    }));

    // Score distribution
    const dist = [
      { range: "0-30", count: scores.filter(s => s <= 30).length },
      { range: "30-50", count: scores.filter(s => s > 30 && s <= 50).length },
      { range: "50-70", count: scores.filter(s => s > 50 && s <= 70).length },
      { range: "70-100", count: scores.filter(s => s > 70).length },
    ];

    // KPIs
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = sortedScores.length ? sortedScores[Math.floor(sortedScores.length / 2)] : 0;
    const totalModules = enterpriseRows.reduce((s, e) => s + e.modules_total, 0);
    const completedModulesTotal = enterpriseRows.reduce((s, e) => s + e.modules_completed, 0);

    // ─── Score evolution (weekly, last 30 days) ───
    const scoreEvolution: { semaine: string; date: string; score_moyen: number; min: number; max: number; nb: number }[] = [];
    if (scoreHistory.length > 0) {
      const byWeek: Record<string, number[]> = {};
      for (const sh of scoreHistory) {
        const d = new Date(sh.created_at);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
        const key = weekStart.toISOString().slice(0, 10);
        (byWeek[key] ||= []).push(sh.score);
      }
      for (const [date, wScores] of Object.entries(byWeek).sort()) {
        const weekNum = `S${new Date(date).toISOString().slice(5, 7) === '01' ? '0' : ''}${Math.ceil((new Date(date).getDate()) / 7)}`;
        scoreEvolution.push({
          semaine: weekNum,
          date,
          score_moyen: Math.round(wScores.reduce((a, b) => a + b, 0) / wScores.length),
          min: Math.min(...wScores),
          max: Math.max(...wScores),
          nb: wScores.length,
        });
      }
    }

    // ─── Activity 7 days ───
    const activityByDay: Record<string, number> = {};
    const activityTotals = { generations: 0, corrections: 0, notes_coaching: 0 };
    for (const al of activityLog) {
      const day = al.created_at.slice(0, 10);
      activityByDay[day] = (activityByDay[day] || 0) + 1;
      if (al.action === 'generate') activityTotals.generations++;
      else if (al.action === 'edit_section') activityTotals.corrections++;
      else if (al.action === 'coaching_note') activityTotals.notes_coaching++;
    }

    // ─── Recent activity (last 15 events) ───
    const activityRecent = activityLog.slice(0, 15).map(al => {
      const ent = enterprises.find(e => e.id === al.enterprise_id);
      return {
        date: al.created_at,
        enterprise: ent?.name || '?',
        enterprise_id: al.enterprise_id,
        action: al.action,
        type: al.deliverable_type || al.metadata?.type || null,
        score: al.metadata?.score || null,
      };
    });

    return jsonRes({
      success: true,
      programme: { name: programme.name, status: programme.status, nb_places: programme.nb_places, organization: programme.organization },
      kpis: {
        total_selected: enterpriseIds.length,
        total_active: enterpriseRows.filter(e => e.last_activity && daysSince(e.last_activity) <= 14).length,
        score_ir_moyen: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        score_ir_median: median,
        modules_completion: modulesCompletion,
        pipeline_completion_pct: totalModules > 0 ? Math.round((completedModulesTotal / totalModules) * 100) : 0,
        coaching_notes_count: coachingNotes.length,
        alerts_count: totalAlerts,
      },
      by_coach: byCoach,
      enterprises: enterpriseRows.sort((a, b) => (b.score_ir || 0) - (a.score_ir || 0)),
      score_distribution: dist,
      score_evolution: scoreEvolution,
      activite_7j: { par_jour: activityByDay, totaux: activityTotals },
      activite_recente: activityRecent,
    });

  } catch (e: any) {
    console.error("[get-programme-dashboard] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
