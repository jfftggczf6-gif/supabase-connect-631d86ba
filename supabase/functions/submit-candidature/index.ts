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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { programme_slug, company_name, contact_name, contact_email, contact_phone, form_data, documents } = body;

    // Validation
    if (!programme_slug) return jsonRes({ error: "programme_slug requis" }, 400);
    if (!company_name) return jsonRes({ error: "company_name requis" }, 400);
    if (!contact_email) return jsonRes({ error: "contact_email requis" }, 400);

    // Find programme by slug
    const { data: prog, error: progErr } = await supabase
      .from("programmes")
      .select("id, status, end_date, name")
      .eq("form_slug", programme_slug)
      .single();

    if (progErr || !prog) return jsonRes({ error: "Programme non trouvé" }, 404);
    if (prog.status !== "open") return jsonRes({ error: "Ce programme n'accepte plus de candidatures" }, 400);

    // Check end_date
    if (prog.end_date && new Date(prog.end_date) < new Date()) {
      return jsonRes({ error: "La date limite de candidature est dépassée" }, 400);
    }

    // Check duplicate (same email + same programme)
    const { data: existing } = await supabase
      .from("candidatures")
      .select("id")
      .eq("programme_id", prog.id)
      .eq("contact_email", contact_email)
      .maybeSingle();

    if (existing) {
      return jsonRes({ error: "Une candidature avec cet email existe déjà pour ce programme" }, 409);
    }

    // Create candidature
    const { data: candidature, error: insertErr } = await supabase
      .from("candidatures")
      .insert({
        programme_id: prog.id,
        enterprise_id: null,
        company_name,
        contact_name: contact_name || null,
        contact_email,
        contact_phone: contact_phone || null,
        form_data: form_data || {},
        documents: documents || [],
        status: "received",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[submit-candidature] insert error:", insertErr);
      return jsonRes({ error: insertErr.message }, 500);
    }

    console.log(`[submit-candidature] ✅ ${company_name} → ${prog.name} (${candidature.id})`);
    return jsonRes({ success: true, candidature_id: candidature.id });

  } catch (e: any) {
    console.error("[submit-candidature] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
