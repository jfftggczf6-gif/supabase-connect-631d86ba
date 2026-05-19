// share-im-after-nda — Marque NDA signée + crée data_room_share + envoie l'IM au fonds.
//
// Workflow :
// 1. Vérifie outreach existe (status doit être 'interested' / 'teaser_sent' / 'nda_pending')
// 2. UPDATE pe_fund_outreach.status='nda_signed' (transition intermédiaire)
// 3. Crée data_room_shares (token + expires_at +30j + can_download=true)
// 4. Envoie email au contact fonds : "NDA reçue. Voici votre accès Data Room (lien sécurisé 30j)"
// 5. UPDATE pe_fund_outreach.status='im_shared' (final)
// 6. Returns {share_token, access_url, recipient}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

interface RequestBody {
  deal_id: string;
  funding_program_id: string;
  /** Email investisseur (par défaut contact_email du fonds). */
  investor_email?: string;
  /** Nom investisseur (optionnel). */
  investor_name?: string;
  /** Durée d'accès en jours (défaut 30). */
  expires_days?: number;
}

// Génère un token sécurisé pour data_room_shares.access_token
function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function buildImShareEmailHtml(args: {
  fundName: string; codeName: string; accessUrl: string;
  callerName: string; callerEmail: string; orgName: string;
  expiresAt: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8">
<style>
body { font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.55; }
.header { background: #534AB7; color: #fff; padding: 24px; border-radius: 8px 8px 0 0; }
.body { background: #fff; border: 1px solid #e8e6e1; border-top: none; padding: 24px; }
.cta { background: #534AB7; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 16px 0; font-weight: 500; }
.footer { background: #f5f5f3; border: 1px solid #e8e6e1; border-top: none; padding: 16px 24px; font-size: 11px; color: #666; border-radius: 0 0 8px 8px; }
.warn { background: #fffef5; border: 1px solid #e8e2c8; padding: 12px; border-radius: 6px; font-size: 12px; margin: 16px 0; }
</style>
</head>
<body>
<div class="header">
  <h2 style="margin:0;">${args.codeName} — Accès Data Room</h2>
  <p style="margin:8px 0 0;opacity:.85;font-size:13px;">Information Memorandum & documents complémentaires</p>
</div>

<div class="body">
  <p>Bonjour,</p>
  <p>Suite à la signature de votre NDA pour <strong>${args.codeName}</strong>, nous avons le plaisir de vous donner accès à la data room du dossier.</p>

  <p style="text-align:center;">
    <a class="cta" href="${args.accessUrl}">→ Accéder à la Data Room</a>
  </p>

  <div class="warn">
    ⏱ <strong>Lien sécurisé valide jusqu'au ${args.expiresAt}</strong><br>
    Cet accès est <strong>personnel et nominatif</strong>. Téléchargements tracés. Reproduction interdite hors équipe ${args.fundName}.
  </div>

  <p style="font-size:13px;color:#555;">La data room inclut :</p>
  <ul style="font-size:13px;color:#555;">
    <li>Information Memorandum (IM) 12 sections</li>
    <li>Valorisation détaillée (DCF + multiples + ANCC)</li>
    <li>États financiers SYSCOHADA 3 ans</li>
    <li>Documents juridiques & gouvernance</li>
  </ul>

  <p style="font-size:13px;color:#555;">Pour toute question, contactez directement <strong>${args.callerName}</strong> — <a href="mailto:${args.callerEmail}">${args.callerEmail}</a>.</p>
</div>

<div class="footer">
  Document strictement confidentiel — ${args.orgName}<br>
  ${args.fundName} · accès expirant le ${args.expiresAt}
</div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id || !body.funding_program_id) {
      return errorResponse("deal_id et funding_program_id requis", 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Charge deal + enterprise + outreach
    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id, enterprise_id, organizations:organization_id(name)")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal introuvable", 404);
    const callerOrgName = (deal as any).organizations?.name || "Banque d'affaires";

    const { data: outreach } = await adminClient
      .from("pe_fund_outreach")
      .select("id, status")
      .eq("deal_id", body.deal_id)
      .eq("funding_program_id", body.funding_program_id)
      .maybeSingle();
    if (!outreach) return errorResponse("Outreach introuvable — envoie d'abord le teaser", 404);
    const validFromStatuses = ["teaser_sent", "interested", "nda_pending", "nda_signed"];
    if (!validFromStatuses.includes(outreach.status)) {
      return errorResponse(`Transition invalide depuis status='${outreach.status}' (attendu : ${validFromStatuses.join(", ")})`, 400);
    }

    // 2. Funding program
    const { data: fund } = await adminClient
      .from("funding_programs")
      .select("id, name, contact_email")
      .eq("id", body.funding_program_id)
      .maybeSingle();
    if (!fund) return errorResponse("Funding program introuvable", 404);

    const investorEmail = body.investor_email || fund.contact_email;
    const investorName = body.investor_name || fund.name;
    if (!investorEmail) return errorResponse("Pas d'email investisseur (contact_email du fonds vide)", 400);

    // 3. Caller profile
    const { data: profile } = await userClient
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();
    const callerName = (profile as any)?.full_name || user.email?.split("@")[0] || "Analyste";
    const callerEmail = (profile as any)?.email || user.email || "noreply@esono.tech";

    // 4. Teaser code_name
    const { data: deliv } = await adminClient
      .from("deliverables")
      .select("data")
      .eq("enterprise_id", deal.enterprise_id)
      .eq("type", "teaser_anonymise")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const codeName = (deliv?.data as any)?.teaser_payload?.code_name || "PROJET";

    // 5. UPDATE outreach.status='nda_signed' (transition intermédiaire)
    await adminClient
      .from("pe_fund_outreach")
      .update({
        status: "nda_signed",
        last_action_at: new Date().toISOString(),
        last_action_label: `NDA signée par ${investorEmail}`,
      })
      .eq("id", outreach.id);

    // 6. Créer data_room_share (token + expiration)
    const expiresDays = body.expires_days ?? 30;
    const expiresAt = new Date(Date.now() + expiresDays * 86_400_000);
    const accessToken = generateAccessToken();

    const { data: share, error: shareErr } = await adminClient
      .from("data_room_shares")
      .insert({
        enterprise_id: deal.enterprise_id,
        organization_id: deal.organization_id,
        investor_email: investorEmail,
        investor_name: investorName,
        access_token: accessToken,
        expires_at: expiresAt.toISOString(),
        can_download: true,
      })
      .select("id")
      .single();
    if (shareErr) return errorResponse(`data_room_share insert: ${shareErr.message}`, 500);

    // 7. Build URL (front route /data-room/:token à intégrer côté front)
    const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://supabase-connect-631d86ba-8m-git-pe-demo-esono.vercel.app";
    const accessUrl = `${appUrl}/data-room/${accessToken}`;

    // 8. Email
    const expiresFr = expiresAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const html = buildImShareEmailHtml({
      fundName: fund.name, codeName, accessUrl,
      callerName, callerEmail, orgName: callerOrgName,
      expiresAt: expiresFr,
    });

    const sendResp = await adminClient.functions.invoke("send-email", {
      body: {
        to: investorEmail,
        subject: `${codeName} — Accès Data Room (NDA signée)`,
        html,
        reply_to: callerEmail,
      },
    });
    if (sendResp.error) {
      let detail = sendResp.error.message;
      try {
        const ctx: any = (sendResp.error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const b = await ctx.json();
          detail = b?.error?.message || b?.error || JSON.stringify(b);
        }
      } catch (_) {}
      return errorResponse(`send-email failed: ${detail}`, 500);
    }

    // 9. UPDATE outreach.status='im_shared' (final)
    await adminClient
      .from("pe_fund_outreach")
      .update({
        status: "im_shared",
        last_action_at: new Date().toISOString(),
        last_action_label: `IM partagé via Data Room (expire ${expiresFr})`,
      })
      .eq("id", outreach.id);

    return jsonResponse({
      success: true,
      share_id: share.id,
      share_token: accessToken,
      access_url: accessUrl,
      recipient: investorEmail,
      fund: fund.name,
      expires_at: expiresAt.toISOString(),
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
