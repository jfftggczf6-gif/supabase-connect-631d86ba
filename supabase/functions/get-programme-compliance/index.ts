// get-programme-compliance — service_role aggregation for Compliance & IC tab
// Bypasses RLS for analyste/manager/owner reading their programme's selected enterprises
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

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    const [{ data: roleData }, { data: orgMems }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("organization_members").select("role, organization_id").eq("user_id", user.id).eq("is_active", true),
    ]);
    const ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1, manager: 2, coach: 3, analyst: 4, entrepreneur: 5 };
    const bestMem = (orgMems || []).slice().sort((a: any, b: any) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99))[0];
    const orgRole = bestMem?.role;
    const userOrgId = bestMem?.organization_id;
    const isSuperAdmin = roleData?.role === "super_admin";
    const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";
    const isChef = roleData?.role === "chef_programme" || isOwnerOrAdmin || orgRole === "manager" || orgRole === "analyst";
    if (!isSuperAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const { programme_id } = await req.json();
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    const { data: programme } = await supabase.from("programmes").select("id, organization_id, chef_programme_id").eq("id", programme_id).single();
    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);

    const canAccess = isSuperAdmin
      || (isOwnerOrAdmin && programme.organization_id === userOrgId)
      || (orgRole === "manager" && programme.organization_id === userOrgId)
      || (orgRole === "analyst" && programme.organization_id === userOrgId)
      || programme.chef_programme_id === user.id;
    if (!canAccess) return jsonRes({ error: "Accès refusé" }, 403);

    // Selected candidatures → enterprise_ids
    const { data: cands } = await supabase
      .from("candidatures")
      .select("enterprise_id")
      .eq("programme_id", programme_id)
      .eq("status", "selected");

    const entIds = (cands || []).map(c => c.enterprise_id).filter(Boolean);
    if (!entIds.length) return jsonRes({ success: true, enterprises: [] });

    const [{ data: ents }, { data: delivs }] = await Promise.all([
      supabase
        .from("enterprises")
        .select("id, name, sector, country, score_ir, compliance_status, score_ir_breakdown")
        .in("id", entIds),
      supabase
        .from("deliverables")
        .select("enterprise_id, type, data, score")
        .in("enterprise_id", entIds)
        .in("type", ["compliance_report", "ic_decision_report"]),
    ]);

    const delivMap: Record<string, Record<string, any>> = {};
    for (const d of delivs || []) {
      if (!delivMap[d.enterprise_id]) delivMap[d.enterprise_id] = {};
      delivMap[d.enterprise_id][d.type] = d.data;
    }

    const enterprises = (ents || []).map((e: any) => ({
      ...e,
      has_compliance_report: !!delivMap[e.id]?.compliance_report,
      has_ic_report: !!delivMap[e.id]?.ic_decision_report,
      compliance_score: delivMap[e.id]?.compliance_report?.score_compliance ?? null,
      ic_verdict: delivMap[e.id]?.ic_decision_report?.recommandation_ic ?? null,
    }));

    return jsonRes({ success: true, enterprises });
  } catch (e: any) {
    console.error("[get-programme-compliance] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
