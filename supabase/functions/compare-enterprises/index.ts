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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const [{ data: roleData }, { data: orgMem }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("organization_members").select("role, organization_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
    ]);
    const orgRole = orgMem?.role;
    const userOrgId = orgMem?.organization_id;
    const isAdmin = roleData?.role === "super_admin";
    const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";
    const isChef = roleData?.role === "chef_programme" || isOwnerOrAdmin || orgRole === "manager";
    if (!isAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const { programme_id, sort_by } = await req.json();
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    const { data: programme } = await supabase.from("programmes").select("*").eq("id", programme_id).single();
    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);
    const canAccess = isAdmin || (isOwnerOrAdmin && programme.organization_id === userOrgId) || programme.chef_programme_id === user.id;
    if (!canAccess) return jsonRes({ error: "Accès refusé" }, 403);

    // Get selected candidatures
    const { data: candidatures } = await supabase
      .from("candidatures")
      .select("enterprise_id, screening_score, company_name, assigned_coach_id")
      .eq("programme_id", programme_id)
      .eq("status", "selected");

    const enterpriseIds = (candidatures || []).map(c => c.enterprise_id).filter(Boolean);
    if (!enterpriseIds.length) return jsonRes({ success: true, comparatif: [], classement_par_score: [], classement_par_progression: [] });

    // Batch fetch
    const [entRes, delivRes, modRes, profilesRes] = await Promise.all([
      supabase.from("enterprises").select("id, name, sector, country, coach_id").in("id", enterpriseIds),
      supabase.from("deliverables").select("enterprise_id, type, score, data").in("enterprise_id", enterpriseIds),
      supabase.from("enterprise_modules").select("enterprise_id, module, status").in("enterprise_id", enterpriseIds),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    const enterprises = entRes.data || [];
    const deliverables = delivRes.data || [];
    const modules = modRes.data || [];
    const profileMap: Record<string, string> = {};
    for (const p of profilesRes.data || []) profileMap[p.user_id] = p.full_name;

    // Build comparatif
    const comparatif = enterprises.map(ent => {
      const cand = candidatures?.find(c => c.enterprise_id === ent.id);
      const delivs = deliverables.filter(d => d.enterprise_id === ent.id);
      const mods = modules.filter(m => m.enterprise_id === ent.id);

      const scores = delivs.filter(d => d.score).map(d => Number(d.score));
      const scoreFinal = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const scoreInitial = Number(cand?.screening_score || 0);
      const progression = scoreFinal - scoreInitial;
      const completed = mods.filter(m => m.status === "completed").length;

      // Extract KPIs from inputs_data if available
      const inputsDeliv = delivs.find(d => d.type === "inputs_data");
      const inputsData = inputsDeliv?.data;
      const ca = inputsData?.compte_resultat?.chiffre_affaires || 0;
      const ebitda = inputsData?.compte_resultat?.resultat_exploitation || 0;

      return {
        enterprise_id: ent.id,
        enterprise: ent.name,
        sector: ent.sector || "N/A",
        country: ent.country || "N/A",
        coach: profileMap[ent.coach_id] || "N/A",
        score_initial: scoreInitial,
        score_final: scoreFinal,
        progression,
        modules_completed: completed,
        modules_total: mods.length || 7,
        completion_pct: mods.length ? Math.round((completed / mods.length) * 100) : 0,
        kpis: { ca, ebitda },
        scores_detail: Object.fromEntries(delivs.filter(d => d.score).map(d => [d.type, Number(d.score)])),
      };
    });

    // Sort
    const sortFn = sort_by === "progression"
      ? (a: any, b: any) => b.progression - a.progression
      : sort_by === "sector"
      ? (a: any, b: any) => (a.sector || "").localeCompare(b.sector || "")
      : sort_by === "coach"
      ? (a: any, b: any) => (a.coach || "").localeCompare(b.coach || "")
      : (a: any, b: any) => b.score_final - a.score_final;

    const sorted = [...comparatif].sort(sortFn);

    // AI synthesis (optional, quick)
    let analyseIa = "";
    try {
      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `Synthèse comparative en 3-4 phrases pour cette cohorte de ${comparatif.length} entreprises d'un programme d'accompagnement PME en Afrique :\n${JSON.stringify(comparatif.map(c => ({ nom: c.enterprise, secteur: c.sector, score_initial: c.score_initial, score_final: c.score_final, progression: c.progression, completion: c.completion_pct })), null, 2)}\nRéponds en texte brut, pas en JSON.`,
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (aiResp.ok) {
        const r = await aiResp.json();
        analyseIa = r.content?.[0]?.text || "";
      }
    } catch { /* non-bloquant */ }

    return jsonRes({
      success: true,
      comparatif: sorted,
      classement_par_score: [...comparatif].sort((a, b) => b.score_final - a.score_final).map((c, i) => ({ rang: i + 1, enterprise: c.enterprise, score: c.score_final })),
      classement_par_progression: [...comparatif].sort((a, b) => b.progression - a.progression).map((c, i) => ({ rang: i + 1, enterprise: c.enterprise, progression: c.progression })),
      analyse_ia: analyseIa,
    });

  } catch (e: any) {
    console.error("[compare-enterprises] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
