import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function jsonRes(data: any, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

const TEMPLATES: Record<string, Array<{ kpi_name: string; kpi_code: string; kpi_category: string; unit: string }>> = {
  giz: [
    { kpi_name: "Emplois créés (total)", kpi_code: "emplois_total", kpi_category: "emploi", unit: "emplois" },
    { kpi_name: "Emplois féminins", kpi_code: "emplois_femmes", kpi_category: "genre", unit: "emplois" },
    { kpi_name: "Emplois jeunes (<35 ans)", kpi_code: "emplois_jeunes", kpi_category: "genre", unit: "emplois" },
    { kpi_name: "CA additionnel généré", kpi_code: "ca_additionnel", kpi_category: "financier", unit: "FCFA" },
    { kpi_name: "Personnes formées", kpi_code: "personnes_formees", kpi_category: "formation", unit: "personnes" },
    { kpi_name: "Entreprises avec audit annuel", kpi_code: "audit_annuel", kpi_category: "gouvernance", unit: "entreprises" },
    { kpi_name: "Tonnes CO2 évitées", kpi_code: "co2_evitees", kpi_category: "impact_environnemental", unit: "tonnes" },
  ],
  afd: [
    { kpi_name: "Emplois directs soutenus", kpi_code: "emplois_directs", kpi_category: "emploi", unit: "emplois" },
    { kpi_name: "Emplois indirects estimés", kpi_code: "emplois_indirects", kpi_category: "emploi", unit: "emplois" },
    { kpi_name: "% femmes dans le management", kpi_code: "femmes_management", kpi_category: "genre", unit: "%" },
    { kpi_name: "CA total cohorte", kpi_code: "ca_total", kpi_category: "financier", unit: "EUR" },
    { kpi_name: "Investissements mobilisés", kpi_code: "investissements", kpi_category: "financier", unit: "EUR" },
    { kpi_name: "ODD adressés", kpi_code: "odd_count", kpi_category: "impact_social", unit: "ODD" },
  ],
  bad: [
    { kpi_name: "Emplois créés", kpi_code: "emplois_total", kpi_category: "emploi", unit: "emplois" },
    { kpi_name: "CA additionnel (USD)", kpi_code: "ca_additionnel_usd", kpi_category: "financier", unit: "USD" },
    { kpi_name: "TRI économique", kpi_code: "tri_economique", kpi_category: "financier", unit: "%" },
    { kpi_name: "PME atteignant le seuil de rentabilité", kpi_code: "pme_rentables", kpi_category: "gouvernance", unit: "entreprises" },
  ],
  enabel: [
    { kpi_name: "Emplois créés", kpi_code: "emplois_total", kpi_category: "emploi", unit: "emplois" },
    { kpi_name: "Emplois femmes", kpi_code: "emplois_femmes", kpi_category: "genre", unit: "emplois" },
    { kpi_name: "Emplois jeunes", kpi_code: "emplois_jeunes", kpi_category: "genre", unit: "emplois" },
    { kpi_name: "CA additionnel", kpi_code: "ca_additionnel", kpi_category: "financier", unit: "EUR" },
    { kpi_name: "Tonnes CO2 évitées", kpi_code: "co2_evitees", kpi_category: "impact_environnemental", unit: "tonnes" },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return jsonRes({ error: "Non autorisé" }, 401);
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    if (action === "list") {
      const { data, error } = await supabase.from("programme_kpis").select("*").eq("programme_id", body.programme_id).order("kpi_category");
      if (error) return jsonRes({ error: error.message }, 500);
      return jsonRes({ success: true, kpis: data });
    }

    if (action === "add") {
      const kpi = body.kpi;
      if (!kpi?.kpi_name || !kpi?.kpi_code || !kpi?.kpi_category || !kpi?.unit) return jsonRes({ error: "Champs requis manquants" }, 400);
      const { data, error } = await supabase.from("programme_kpis").insert({
        programme_id: body.programme_id,
        ...kpi,
      }).select().single();
      if (error) return jsonRes({ error: error.message }, 500);
      return jsonRes({ success: true, kpi: data });
    }

    if (action === "update_value") {
      if (!body.kpi_id) return jsonRes({ error: "kpi_id requis" }, 400);
      const { error: updateErr } = await supabase.from("programme_kpis").update({
        current_value: body.value, updated_at: new Date().toISOString(),
      }).eq("id", body.kpi_id);
      if (updateErr) return jsonRes({ error: updateErr.message }, 500);

      // History
      await supabase.from("programme_kpi_history").insert({
        kpi_id: body.kpi_id, value: body.value,
        period: new Date().toISOString().slice(0, 7),
        notes: body.notes || null, recorded_by: user.id,
      });
      return jsonRes({ success: true });
    }

    if (action === "delete") {
      if (!body.kpi_id) return jsonRes({ error: "kpi_id requis" }, 400);
      const { error } = await supabase.from("programme_kpis").delete().eq("id", body.kpi_id);
      if (error) return jsonRes({ error: error.message }, 500);
      return jsonRes({ success: true });
    }

    if (action === "init_template") {
      const template = TEMPLATES[body.template];
      if (!template) return jsonRes({ error: `Template inconnu: ${body.template}. Disponibles: ${Object.keys(TEMPLATES).join(", ")}` }, 400);

      let created = 0;
      for (const kpi of template) {
        const { error } = await supabase.from("programme_kpis").upsert({
          programme_id: body.programme_id,
          kpi_name: kpi.kpi_name, kpi_code: kpi.kpi_code,
          kpi_category: kpi.kpi_category, unit: kpi.unit,
          source: "manual", bailleur: body.template.toUpperCase(),
        }, { onConflict: "programme_id,kpi_code" });
        if (!error) created++;
      }
      return jsonRes({ success: true, created, template: body.template });
    }

    return jsonRes({ error: `Action inconnue: ${action}` }, 400);
  } catch (e: any) {
    console.error("[manage-programme-kpis] error:", e);
    return jsonRes({ error: e.message || "Erreur" }, 500);
  }
});
