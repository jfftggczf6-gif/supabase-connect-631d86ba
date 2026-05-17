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
      .select("id, name, description, organization, logo_url, country_filter, sector_filter, start_date, end_date, status, form_fields, nb_places")
      .eq("form_slug", slug)
      .single();

    if (progErr || !prog) return jsonRes({ error: "Programme non trouvé" }, 404);

    // Le formulaire est fermé si :
    //   - le programme est terminé (status='completed'), perdu ('lost'),
    //     OU en pause ('closed' — utilisé par BA pour pause/réactiver)
    //   - OU la date de fin de candidatures est dépassée
    //   - OU la date de début n'est pas encore arrivée
    const today = new Date();
    const isProgrammeFinished = ["completed", "lost", "closed"].includes(prog.status);
    const isExpired = prog.end_date && new Date(prog.end_date) < today;
    const isNotYetOpen = prog.start_date && new Date(prog.start_date) > today;

    if (isProgrammeFinished || isExpired || isNotYetOpen) {
      return jsonRes({
        closed: true,
        name: prog.name,
        organization: prog.organization,
        reason: isProgrammeFinished
          ? (prog.status === "closed" ? "Candidatures en pause" : "Programme terminé")
          : isExpired
            ? "Date limite dépassée"
            : `Candidatures ouvertes à partir du ${new Date(prog.start_date!).toLocaleDateString('fr-FR')}`,
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
