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
    const url = new URL(req.url);
    let slug = url.searchParams.get("slug");

    // Also accept POST with { slug } in body
    if (!slug && req.method === "POST") {
      try {
        const body = await req.json();
        slug = body.slug || null;
      } catch { /* ignore */ }
    }

    if (!slug) return jsonRes({ error: "slug requis" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: prog, error: progErr } = await supabase
      .from("programmes")
      .select("id, name, description, organization, logo_url, country_filter, sector_filter, end_date, status, form_fields, nb_places")
      .eq("form_slug", slug)
      .single();

    if (progErr || !prog) return jsonRes({ error: "Programme non trouvé" }, 404);

    // Check if closed or expired
    const isExpired = prog.end_date && new Date(prog.end_date) < new Date();
    const isClosed = prog.status !== "open";

    if (isClosed || isExpired) {
      return jsonRes({
        closed: true,
        name: prog.name,
        organization: prog.organization,
        reason: isExpired ? "Date limite dépassée" : "Candidatures clôturées",
      });
    }

    // Count existing candidatures
    const { count } = await supabase
      .from("candidatures")
      .select("id", { count: "exact", head: true })
      .eq("programme_id", prog.id);

    return jsonRes({
      success: true,
      programme: {
        name: prog.name,
        description: prog.description,
        organization: prog.organization,
        logo_url: prog.logo_url,
        country_filter: prog.country_filter,
        sector_filter: prog.sector_filter,
        end_date: prog.end_date,
        form_fields: prog.form_fields || [],
        nb_places: prog.nb_places,
        candidatures_count: count || 0,
      },
    });

  } catch (e: any) {
    console.error("[get-programme-form] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
