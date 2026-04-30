import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stages autorisés selon rôle (lost est toujours autorisé pour tous)
const STAGES_BY_ROLE: Record<string, string[]> = {
  analyst: ['sourcing', 'pre_screening', 'analyse'],
  investment_manager: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale'],
  managing_director: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio'],
  admin: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio'],
  owner: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio'],
};

const VALID_STAGES = ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio', 'lost'];

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

    const { deal_id, new_stage, lost_reason } = await req.json();
    if (!deal_id || !new_stage) throw new Error("deal_id and new_stage required");
    if (!VALID_STAGES.includes(new_stage)) throw new Error(`Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`);
    if (new_stage === 'lost' && (!lost_reason || !lost_reason.trim())) {
      throw new Error('lost_reason required when stage=lost');
    }

    // 1. Charger le deal
    const { data: deal } = await adminClient
      .from("pe_deals")
      .select("id, organization_id, stage, lead_analyst_id")
      .eq("id", deal_id)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");

    // 2. Récupérer le rôle de l'utilisateur dans l'org
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", deal.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this organization");

    // 3. Vérifier RLS visibilité
    const { data: canSee } = await adminClient.rpc('can_see_pe_deal', {
      p_deal_id: deal_id, p_user_id: user.id,
    });
    if (!canSee) {
      return new Response(JSON.stringify({ error: "Cannot see this deal" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Vérifier transition autorisée selon rôle (lost toujours autorisé)
    const allowedStages = STAGES_BY_ROLE[membership.role] || [];
    if (new_stage !== 'lost' && !allowedStages.includes(new_stage)) {
      return new Response(JSON.stringify({
        error: `Stage '${new_stage}' réservé à un rôle supérieur (votre rôle: ${membership.role})`
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. UPDATE (les triggers gèrent enterprise_id requis + audit)
    const updatePayload: any = { stage: new_stage };
    if (new_stage === 'lost') updatePayload.lost_reason = lost_reason.trim();

    const { data: updated, error: updErr } = await adminClient
      .from("pe_deals")
      .update(updatePayload)
      .eq("id", deal_id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, deal: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[update-pe-deal-stage] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
