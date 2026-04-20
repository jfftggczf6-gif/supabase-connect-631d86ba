import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const REPORT_SYSTEM_PROMPT = `Tu es un analyste senior de programmes d'accompagnement de PME en Afrique francophone. Tu rédiges des rapports de suivi pour les bailleurs (GIZ, AFD, I&P, Proparco).

Le rapport doit être :
- Factuel et basé sur les données fournies
- Actionnable — chaque constat mène à une recommandation
- Professionnel — ton adapté aux bailleurs internationaux
- Structuré avec des chiffres clés mis en avant

Réponds UNIQUEMENT en JSON valide.`;

const PROGRESS_SCHEMA = `{
  "titre": "Rapport de Suivi — [Programme] — [Date]",
  "resume_executif": "string — 4-5 phrases résumant la situation globale",
  "chiffres_cles": {
    "entreprises_actives": <number>,
    "score_ir_moyen": <number>,
    "pipeline_completion": "<percentage>",
    "taux_engagement": "<percentage — entreprises actives / total>"
  },
  "analyse_cohorte": {
    "progression": "string — 2-3 phrases sur la progression globale",
    "forces": ["string × 2-3"],
    "faiblesses": ["string × 2-3"],
    "tendance": "En amélioration | Stable | En recul"
  },
  "performance_coachs": [
    {"coach": "string", "entreprises": <number>, "score_moyen": <number>, "completion": "<pct>", "observation": "string"}
  ],
  "entreprises_a_risque": [
    {"nom": "string", "risque": "string", "action_recommandee": "string"}
  ],
  "entreprises_performantes": [
    {"nom": "string", "score": <number>, "point_fort": "string"}
  ],
  "recommandations": [
    {"priorite": 1, "action": "string", "impact_attendu": "string", "responsable": "Chef de programme | Coach | Entreprise"}
  ],
  "prochaines_etapes": ["string × 3-4"]
}`;

const FINAL_SCHEMA = `{
  "titre": "Rapport Final — [Programme] — [Date]",
  "resume_executif": "string — 3-4 paragraphes de synthèse pour la direction du bailleur",
  "stats_cohorte": {
    "nb_selectionnees": <number>,
    "nb_actives": <number>,
    "nb_abandons": <number>,
    "score_initial_moyen": <number>,
    "score_final_moyen": <number>,
    "progression_moyenne": "string — ex: +33 points",
    "taux_completion": <number — pourcentage>
  },
  "impact": {
    "ca_total_cohorte": <number — estimé en devise locale>,
    "emplois_estimes": <number>,
    "odd_couverts": [<number — numéros ODD>],
    "investissements_facilites": <number — estimé>
  },
  "performance_par_coach": [
    {"coach": "string", "nb_entreprises": <number>, "progression_moyenne": "string", "taux_completion": <number>, "points_forts": "string", "axes_amelioration": "string"}
  ],
  "entreprises_succes": [
    {"name": "string", "score_initial": <number>, "score_final": <number>, "highlights": "string"}
  ],
  "entreprises_difficulte": [
    {"name": "string", "score_initial": <number>, "score_final": <number>, "raisons": "string"}
  ],
  "recommandations_programme": ["string × 3-5 — pour le prochain cycle"],
  "lecons_apprises": "string — 2-3 paragraphes"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);
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
    if (!isAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const { programme_id, report_type, format } = await req.json();
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    const { data: programme } = await supabase.from("programmes").select("*").eq("id", programme_id).single();
    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);
    const canAccess = isAdmin || (isOwnerOrAdmin && programme.organization_id === userOrgId) || programme.chef_programme_id === user.id;
    if (!canAccess) return jsonRes({ error: "Accès refusé" }, 403);

    // Get all data for the programme
    const { data: candidatures } = await supabase
      .from("candidatures")
      .select("id, enterprise_id, company_name, assigned_coach_id, screening_score, status")
      .eq("programme_id", programme_id)
      .eq("status", "selected");

    const enterpriseIds = (candidatures || []).map(c => c.enterprise_id).filter(Boolean);

    if (!enterpriseIds.length) {
      return jsonRes({ error: "Aucune entreprise sélectionnée dans ce programme. Sélectionnez des candidatures avant de générer un rapport." }, 400);
    }

    const [entRes, delivRes, modRes, profilesRes] = await Promise.all([
      supabase.from("enterprises").select("id, name, coach_id, sector, country, updated_at").in("id", enterpriseIds),
      supabase.from("deliverables").select("enterprise_id, type, score, updated_at").in("enterprise_id", enterpriseIds),
      supabase.from("enterprise_modules").select("enterprise_id, module, status, progress").in("enterprise_id", enterpriseIds),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    const enterprises = entRes.data || [];
    const deliverables = delivRes.data || [];
    const modules = modRes.data || [];
    const profiles = profilesRes.data || [];
    const profileMap: Record<string, string> = {};
    for (const p of profiles) profileMap[p.user_id] = p.full_name;

    // Map candidature screening scores (initial score) by enterprise_id
    const initialScoreMap: Record<string, number> = {};
    for (const c of candidatures || []) {
      if (c.enterprise_id && c.screening_score) initialScoreMap[c.enterprise_id] = Number(c.screening_score);
    }

    // Build summary per enterprise
    const entSummaries = enterprises.map(ent => {
      const delivs = deliverables.filter(d => d.enterprise_id === ent.id);
      const mods = modules.filter(m => m.enterprise_id === ent.id);
      const scores = delivs.filter(d => d.score).map(d => Number(d.score));
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const completed = mods.filter(m => m.status === "completed").length;
      const total = mods.length || 7;
      const allDates = delivs.map(d => d.updated_at).filter(Boolean).sort().reverse();
      const scoreInitial = initialScoreMap[ent.id] || 0;

      return {
        name: ent.name,
        sector: ent.sector,
        coach: profileMap[ent.coach_id] || "Non assigné",
        score_initial: scoreInitial,
        score_ir: avgScore,
        progression: avgScore - scoreInitial,
        modules_completed: completed,
        modules_total: total,
        completion_pct: Math.round((completed / total) * 100),
        last_activity: allDates[0] || "Jamais",
        deliverables: delivs.map(d => `${d.type}:${d.score || '?'}`).join(", "),
      };
    });

    // Build prompt
    const userPrompt = `PROGRAMME : ${programme.name}
ORGANISATION : ${programme.organization || "Non spécifiée"}
STATUT : ${programme.status}
PLACES : ${programme.nb_places || "Non défini"}
PÉRIODE : ${programme.programme_start || "?"} → ${programme.programme_end || "?"}
DATE DU RAPPORT : ${new Date().toLocaleDateString("fr-FR")}

COHORTE (${entSummaries.length} entreprises sélectionnées) :
${JSON.stringify(entSummaries, null, 2)}

STATISTIQUES CANDIDATURES :
- Total candidatures reçues : ${(await supabase.from("candidatures").select("id", { count: "exact", head: true }).eq("programme_id", programme_id)).count || 0}
- Sélectionnées : ${candidatures?.length || 0}

Génère le rapport de ${report_type === "final" ? "clôture" : "suivi"} en JSON :
${report_type === "final" ? FINAL_SCHEMA : PROGRESS_SCHEMA}`;

    // Call AI
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: REPORT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`AI error ${aiResp.status}: ${errText.slice(0, 200)}`);
    }

    const aiResult = await aiResp.json();
    const content = aiResult.content?.[0]?.text || "";

    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in AI response");
    const report = JSON.parse(cleaned.substring(start, end + 1));

    // Save report metadata
    report._metadata = {
      programme_id,
      report_type: report_type || "progress",
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      enterprises_count: entSummaries.length,
    };

    // Persist report in programmes table
    await supabase.from("programmes").update({
      last_report: report,
      last_report_type: report_type || "progress",
      last_report_at: new Date().toISOString(),
    }).eq("id", programme_id);

    // Generate HTML if requested
    if (format === "html") {
      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>${report.titre || "Rapport Programme"}</title>
<style>
body{font-family:'Segoe UI',system-ui,sans-serif;max-width:900px;margin:0 auto;padding:40px 24px;color:#1e293b;line-height:1.6}
h1{color:#1a2744;border-bottom:3px solid #1a2744;padding-bottom:12px}
h2{color:#2d4a7c;margin-top:32px}
.kpi{display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 24px;margin:8px;text-align:center}
.kpi .val{font-size:28px;font-weight:800;color:#1a2744;display:block}
.kpi .lbl{font-size:11px;color:#64748b;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin:16px 0}
th{background:#f8fafc;text-align:left;padding:10px;border-bottom:2px solid #e2e8f0;font-size:12px;text-transform:uppercase}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:13px}
.alert{background:#fef2f2;border-left:4px solid #ef4444;padding:12px;margin:8px 0;border-radius:0 8px 8px 0}
.reco{background:#f0fdf4;border-left:4px solid #22c55e;padding:12px;margin:8px 0;border-radius:0 8px 8px 0}
.footer{text-align:center;margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
@page{size:A4;margin:20mm 15mm}
</style></head><body>
<h1>${report.titre || "Rapport de Suivi"}</h1>
<h2>Résumé Exécutif</h2><p>${report.resume_executif || ""}</p>
<h2>Chiffres Clés</h2>
<div>${Object.entries(report.chiffres_cles || {}).map(([k, v]) => `<div class="kpi"><span class="val">${v}</span><span class="lbl">${k.replace(/_/g, " ")}</span></div>`).join("")}</div>
<h2>Analyse de la Cohorte</h2><p>${report.analyse_cohorte?.progression || ""}</p>
${report.analyse_cohorte?.forces?.length ? `<h3>Forces</h3><ul>${report.analyse_cohorte.forces.map((f: string) => `<li>${f}</li>`).join("")}</ul>` : ""}
${report.analyse_cohorte?.faiblesses?.length ? `<h3>Faiblesses</h3><ul>${report.analyse_cohorte.faiblesses.map((f: string) => `<li>${f}</li>`).join("")}</ul>` : ""}
${report.entreprises_a_risque?.length ? `<h2>Entreprises à Risque</h2>${report.entreprises_a_risque.map((e: any) => `<div class="alert"><strong>${e.nom}</strong> — ${e.risque}<br>Action : ${e.action_recommandee}</div>`).join("")}` : ""}
${report.recommandations?.length ? `<h2>Recommandations</h2>${report.recommandations.map((r: any) => `<div class="reco"><strong>#${r.priorite} ${r.action}</strong><br>Impact : ${r.impact_attendu} — Responsable : ${r.responsable}</div>`).join("")}` : ""}
<div class="footer">Rapport généré par ESONO © ${new Date().getFullYear()} — Confidentiel</div>
</body></html>`;

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return jsonRes({ success: true, report });

  } catch (e: any) {
    console.error("[generate-programme-report] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
