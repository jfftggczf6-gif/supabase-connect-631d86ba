// share-pe-data-room — Brief #35
// Crée un data_room_share pour un deal PE (co-investisseur / LP / conseiller externe).
// Pas de workflow NDA pré-requis (contrairement à share-im-after-nda pour BA).
//
// Pattern : same data_room_shares table, simple POST { deal_id, investor_email, investor_name?, expires_days? }.
// Renvoie le token + URL d'accès.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth context utilisateur
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth requise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userSb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userSb.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;

    // Body
    const body = await req.json();
    const dealId = body.deal_id as string;
    const investorEmail = (body.investor_email ?? '').trim();
    const investorName = (body.investor_name ?? '').trim() || null;
    const expiresDays = Number.isFinite(body.expires_days) ? Number(body.expires_days) : 30;
    const canDownload = body.can_download !== false;

    if (!dealId || !investorEmail) {
      return new Response(JSON.stringify({ error: "deal_id et investor_email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client pour les ops admin
    const sb = createClient(supabaseUrl, serviceKey);

    // Récupère deal + enterprise + org
    const { data: deal, error: dealErr } = await sb
      .from("pe_deals")
      .select("id, enterprise_id, organization_id")
      .eq("id", dealId)
      .maybeSingle();
    if (dealErr || !deal) {
      return new Response(JSON.stringify({ error: "Deal introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const enterpriseId = (deal as any).enterprise_id;
    const organizationId = (deal as any).organization_id;
    if (!enterpriseId || !organizationId) {
      return new Response(JSON.stringify({ error: "Deal sans entreprise ou org" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check membership utilisateur dans l'org du deal (RBAC simple)
    const { data: member } = await sb
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Vous n'êtes pas membre de cette organisation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Crée le share
    const token = generateAccessToken();
    const expiresAt = new Date(Date.now() + expiresDays * 86_400_000).toISOString();

    const { data: share, error: insErr } = await sb
      .from("data_room_shares")
      .insert({
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        access_token: token,
        investor_email: investorEmail,
        investor_name: investorName,
        expires_at: expiresAt,
        can_download: canDownload,
      })
      .select()
      .single();

    if (insErr || !share) {
      return new Response(JSON.stringify({ error: insErr?.message ?? "Création share échouée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessUrl = `${Deno.env.get("FRONTEND_URL") ?? "https://esono.tech"}/data-room/${token}`;

    return new Response(JSON.stringify({
      success: true,
      share_id: (share as any).id,
      access_token: token,
      access_url: accessUrl,
      expires_at: expiresAt,
      caller_email: userEmail,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
