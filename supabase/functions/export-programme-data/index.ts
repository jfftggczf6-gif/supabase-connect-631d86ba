import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const { programme_id, format, include } = await req.json();
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    const { data: programme } = await supabase.from("programmes").select("*").eq("id", programme_id).single();
    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);
    if (isChef && programme.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);

    const includeSet = new Set(include || ["deliverables", "scores", "candidatures"]);

    // Get candidatures
    const { data: candidatures } = await supabase
      .from("candidatures")
      .select("*")
      .eq("programme_id", programme_id)
      .order("screening_score", { ascending: false });

    const selectedCands = (candidatures || []).filter(c => c.status === "selected");
    const enterpriseIds = selectedCands.map(c => c.enterprise_id).filter(Boolean);

    // Batch fetch
    const [entRes, delivRes, modRes, profilesRes] = await Promise.all([
      supabase.from("enterprises").select("*").in("id", enterpriseIds.length ? enterpriseIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("deliverables").select("enterprise_id, type, score, updated_at, data").in("enterprise_id", enterpriseIds.length ? enterpriseIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("enterprise_modules").select("enterprise_id, module, status, progress").in("enterprise_id", enterpriseIds.length ? enterpriseIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("profiles").select("user_id, full_name, email"),
    ]);

    const enterprises = entRes.data || [];
    const deliverables = delivRes.data || [];
    const modules = modRes.data || [];
    const profiles = profilesRes.data || [];
    const profileMap: Record<string, any> = {};
    for (const p of profiles) profileMap[p.user_id] = p;

    // ═══════ EXCEL FORMAT ═══════
    if (format === "excel") {
      // Build CSV (tab-separated for Excel)
      const headers = [
        "Entreprise", "Secteur", "Pays", "Coach", "Score Initial (Screening)",
        "Score IR Actuel", "Progression", "Modules Complétés", "% Completion",
        "BMC", "SIC", "Inputs", "Framework", "Plan Financier", "Business Plan", "ODD",
        "Dernière Activité", "Email Contact",
      ];

      const rows = enterprises.map(ent => {
        const cand = selectedCands.find(c => c.enterprise_id === ent.id);
        const delivs = deliverables.filter(d => d.enterprise_id === ent.id);
        const mods = modules.filter(m => m.enterprise_id === ent.id);
        const coach = profileMap[ent.coach_id];

        const scores = delivs.filter(d => d.score).map(d => Number(d.score));
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const screeningScore = cand?.screening_score || 0;
        const completed = mods.filter(m => m.status === "completed").length;
        const total = mods.length || 7;

        const getModuleScore = (type: string) => {
          const d = delivs.find(d => d.type === type);
          return d?.score ? Number(d.score) : "";
        };

        const allDates = delivs.map(d => d.updated_at).filter(Boolean).sort().reverse();

        return [
          ent.name, ent.sector || "", ent.country || "", coach?.full_name || "",
          screeningScore, avgScore, avgScore - screeningScore,
          completed, Math.round((completed / total) * 100),
          getModuleScore("bmc_analysis"), getModuleScore("sic_analysis"),
          getModuleScore("inputs_data"), getModuleScore("framework_data"),
          getModuleScore("plan_ovo"), getModuleScore("business_plan"),
          getModuleScore("odd_analysis"),
          allDates[0]?.split("T")[0] || "", ent.contact_email || cand?.contact_email || "",
        ];
      });

      const csvContent = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
      const bom = "\uFEFF"; // UTF-8 BOM for Excel

      const filename = `${programme.name.replace(/[^a-zA-Z0-9]/g, "_")}_export_${new Date().toISOString().slice(0, 10)}.tsv`;
      return new Response(bom + csvContent, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/tab-separated-values; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ═══════ JSON/ZIP FORMAT ═══════
    // Build structured export
    const exportData: any = {
      programme: {
        name: programme.name,
        organization: programme.organization,
        status: programme.status,
        period: `${programme.programme_start || "?"} → ${programme.programme_end || "?"}`,
        exported_at: new Date().toISOString(),
      },
    };

    if (includeSet.has("candidatures")) {
      exportData.candidatures = {
        total: candidatures?.length || 0,
        by_status: {},
        list: candidatures?.map(c => ({
          company_name: c.company_name,
          contact: c.contact_name,
          email: c.contact_email,
          status: c.status,
          screening_score: c.screening_score,
          submitted_at: c.submitted_at,
        })),
      };
      const statuses = ["received", "in_review", "pre_selected", "rejected", "selected", "waitlisted"];
      for (const s of statuses) {
        exportData.candidatures.by_status[s] = candidatures?.filter(c => c.status === s).length || 0;
      }
    }

    if (includeSet.has("scores")) {
      exportData.enterprises = enterprises.map(ent => {
        const cand = selectedCands.find(c => c.enterprise_id === ent.id);
        const delivs = deliverables.filter(d => d.enterprise_id === ent.id);
        const mods = modules.filter(m => m.enterprise_id === ent.id);
        const coach = profileMap[ent.coach_id];
        const scores = delivs.filter(d => d.score).map(d => Number(d.score));
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const completed = mods.filter(m => m.status === "completed").length;

        return {
          name: ent.name,
          sector: ent.sector,
          country: ent.country,
          coach: coach?.full_name || "N/A",
          score_initial: cand?.screening_score || 0,
          score_actuel: avgScore,
          progression: avgScore - (cand?.screening_score || 0),
          modules: mods.map(m => ({ module: m.module, status: m.status, progress: m.progress })),
          deliverables_scores: delivs.filter(d => d.score).map(d => ({ type: d.type, score: d.score })),
          modules_completed: completed,
          modules_total: mods.length || 7,
        };
      });
    }

    return jsonRes({ success: true, export: exportData });

  } catch (e: any) {
    console.error("[export-programme-data] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
