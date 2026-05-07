import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_SOURCES = ['reseau_pe', 'inbound', 'dfi', 'banque', 'mandat_ba', 'conference', 'autre'];
const ALLOWED_ROLES = ['owner', 'admin', 'managing_director', 'investment_manager', 'analyst'];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const {
      organization_id,
      enterprise_id,
      enterprise_name,
      enterprise_country,
      enterprise_sector,
      dirigeant_name,
      ticket_demande,
      currency,
      source,
      source_detail,
      lead_analyst_id,
      lead_im_id,
    } = body;

    if (!organization_id) throw new Error("organization_id required");
    if (source && !VALID_SOURCES.includes(source)) {
      throw new Error(`Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}`);
    }

    // 1. Vérifier que user est membre actif avec rôle autorisé
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership || !ALLOWED_ROLES.includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Si enterprise_name fourni mais pas enterprise_id, créer enterprise minimale
    //    avec pays / secteur / dirigeant (contact_name).
    let resolvedEnterpriseId = enterprise_id ?? null;
    if (!resolvedEnterpriseId && enterprise_name && enterprise_name.trim()) {
      const { data: ent, error: entErr } = await adminClient
        .from("enterprises")
        .insert({
          name: enterprise_name.trim(),
          organization_id,
          user_id: user.id,
          phase: 'identite',
          country: enterprise_country?.trim() || null,
          sector: enterprise_sector?.trim() || null,
          contact_name: dirigeant_name?.trim() || null,
        })
        .select('id')
        .single();
      if (entErr) throw entErr;
      resolvedEnterpriseId = ent.id;
    }

    // 3. INSERT dans pe_deals (le trigger génère deal_ref + le trigger
    //    pe_deals_currency_auto met currency depuis enterprise.country)
    const { data: deal, error: dealErr } = await adminClient
      .from("pe_deals")
      .insert({
        organization_id,
        enterprise_id: resolvedEnterpriseId,
        ticket_demande: ticket_demande ?? null,
        currency: currency ?? 'XOF',  // override par trigger si enterprise_id présent
        source: source ?? 'autre',
        source_detail: source_detail ?? null,
        lead_analyst_id: lead_analyst_id ?? user.id,
        lead_im_id: lead_im_id ?? null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (dealErr) throw dealErr;

    return new Response(JSON.stringify({ success: true, deal }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-pe-deal] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
