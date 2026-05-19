// send-teaser-to-fund — Envoie le teaser anonymisé à un fonds via Resend.
//
// Workflow :
// 1. Charge le teaser deliverable (type='teaser_anonymise') du deal
// 2. Charge le funding_program ciblé + caller info pour signature
// 3. Compose HTML email avec teaser sections + watermark personnalisé destinataire
// 4. Invoke send-email (Resend)
// 5. UPDATE pe_fund_outreach (status='teaser_sent', last_action_at, last_action_label, ioi_received_at NULL)
// 6. Insert ai_cost_log (cost=0, c'est juste un email)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

interface RequestBody {
  deal_id: string;
  funding_program_id: string;
  /** Optionnel : override le contact_email du fonds (ex: contact partner spécifique). */
  recipient_email?: string;
  /** Optionnel : message personnalisé avant le teaser. */
  custom_message?: string;
}

function buildTeaserEmailHtml(
  teaserPayload: any,
  recipient: { fund_name: string; recipient_email: string },
  caller: { name: string; email: string; org_name: string },
  customMessage: string | null,
  watermarkId: string,
): string {
  const cn = teaserPayload?.code_name || "PROJET ALPHA";
  const cover = teaserPayload?.cover || {};
  const sections = teaserPayload?.sections || {};
  const tags = (cover.tags || []).join(" · ");

  const equityPoints: string = (sections?.equity_story?.points || [])
    .slice(0, 6)
    .map((p: any) => `<li><strong>${p.title}</strong> — ${p.description}</li>`)
    .join("");

  const adequationCriteria: string = (sections?.adequation?.criteria || [])
    .slice(0, 6)
    .map((c: any) => `<li>${c.status === "ok" ? "✓" : "⚠"} <strong>${c.label}</strong> — ${c.value}</li>`)
    .join("");

  const resumeP = (sections?.resume?.paragraphs || []).slice(0, 2).join("</p><p>");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; max-width: 680px; margin: 0 auto; padding: 24px; line-height: 1.55; }
.cover { background: #534AB7; color: #fff; padding: 32px 24px; text-align: center; border-radius: 8px 8px 0 0; }
.cover .confidentiel { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; }
.cover h1 { font-size: 28px; margin: 8px 0; letter-spacing: 3px; }
.cover .type { font-size: 13px; opacity: 0.85; }
.cover .tags { margin-top: 12px; font-size: 11px; opacity: 0.7; }
.section { background: #fff; border: 1px solid #e8e6e1; border-top: none; padding: 20px 24px; }
.section h2 { font-size: 14px; font-weight: 700; color: #534AB7; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.section p { font-size: 13px; margin: 4px 0; }
.kpis { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0; }
.kpi { background: #f5f5f3; padding: 10px 14px; border-radius: 4px; font-size: 12px; }
.kpi strong { display: block; font-size: 16px; color: #534AB7; }
ul { margin: 4px 0 8px 20px; padding: 0; font-size: 13px; }
.cta { background: #534AB7; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 16px 0; font-weight: 500; }
.footer { background: #f5f5f3; border: 1px solid #e8e6e1; border-top: none; padding: 16px 24px; font-size: 10px; color: #666; border-radius: 0 0 8px 8px; text-align: center; }
.footer .watermark { color: #aaa; font-size: 9px; margin-top: 8px; font-family: monospace; }
.message { background: #fffef5; border: 1px solid #e8e2c8; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; font-style: italic; color: #555; }
</style>
</head>
<body>
${customMessage ? `<div class="message">${customMessage.replace(/\n/g, "<br>")}</div>` : ""}

<p style="font-size:13px;color:#666;">Bonjour,</p>
<p style="font-size:13px;color:#666;">Nous vous adressons cette opportunité d'investissement anonymisée. Sous réserve d'intérêt et de signature NDA, nous pourrons partager le memo détaillé.</p>

<div class="cover">
  <div class="confidentiel">${cover.confidentiel || `Confidentiel — ${caller.org_name}`}</div>
  <h1>${cn}</h1>
  <div class="type">${cover.type || "Teaser — Opportunité d'investissement"}</div>
  <div class="tags">${tags}</div>
</div>

<div class="section">
  <h2>Présentation</h2>
  <div class="kpis">
    <div class="kpi"><strong>${sections?.presentation?.secteur || "—"}</strong>Secteur</div>
    <div class="kpi"><strong>${sections?.presentation?.geographie || "—"}</strong>Géographie</div>
    <div class="kpi"><strong>${sections?.presentation?.ticket || "—"}</strong>Ticket</div>
    <div class="kpi"><strong>${sections?.presentation?.operation || "—"}</strong>Opération</div>
  </div>
</div>

<div class="section">
  <h2>Résumé de l'opportunité</h2>
  <p>${resumeP}</p>
</div>

<div class="section">
  <h2>Performance financière</h2>
  <div class="kpis">
    <div class="kpi"><strong>${sections?.finances?.ca_n || "—"}</strong>CA</div>
    <div class="kpi"><strong>${sections?.finances?.croissance_3y || "—"}</strong>Croissance 3 ans</div>
    <div class="kpi"><strong>${sections?.finances?.marge_ebitda || "—"}</strong>Marge EBITDA</div>
  </div>
</div>

<div class="section">
  <h2>Equity Story</h2>
  <ul>${equityPoints || "<li>—</li>"}</ul>
</div>

<div class="section">
  <h2>Adéquation investisseur — score ${sections?.adequation?.score_pct || "?"}%</h2>
  <ul>${adequationCriteria || "<li>—</li>"}</ul>
</div>

<p style="text-align:center;margin:24px 0;">
  <a class="cta" href="mailto:${caller.email}?subject=Intérêt%20${cn}">→ Manifester un intérêt (NDA puis IM)</a>
</p>

<div class="footer">
  <div>Pour toute question — <strong>${caller.name}</strong> — ${caller.org_name} — <a href="mailto:${caller.email}">${caller.email}</a></div>
  <div>Document strictement confidentiel. Reproduction interdite.</div>
  <div class="watermark">ID destinataire : ${watermarkId}</div>
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

    // 1. Deal + enterprise + org caller
    const { data: deal } = await userClient
      .from("pe_deals")
      .select("id, organization_id, enterprise_id, organizations:organization_id(name)")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal introuvable", 404);

    const callerOrgName = (deal as any).organizations?.name || "Banque d'affaires";

    // 2. Teaser deliverable — service role car RLS deliverables exclut managing_director BA
    //    L'autorisation a déjà été vérifiée via userClient.from('pe_deals') (RLS BA OK).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: deliv } = await adminClient
      .from("deliverables")
      .select("id, data")
      .eq("enterprise_id", deal.enterprise_id)
      .eq("type", "teaser_anonymise")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!deliv) return errorResponse("Aucun teaser généré — utilise 'Régénérer le teaser' d'abord", 404);
    const teaserPayload = (deliv.data as any)?.teaser_payload;
    if (!teaserPayload) return errorResponse("Teaser invalide (pas de teaser_payload)", 500);

    // 3. Funding program ciblé
    const { data: fund } = await userClient
      .from("funding_programs")
      .select("id, name, contact_email, organisme")
      .eq("id", body.funding_program_id)
      .maybeSingle();
    if (!fund) return errorResponse("Funding program introuvable", 404);

    const recipientEmail = body.recipient_email || fund.contact_email;
    if (!recipientEmail) return errorResponse("Pas d'email destinataire (contact_email du fonds vide)", 400);

    // 4. Caller info
    const { data: profile } = await userClient
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();
    const callerName = (profile as any)?.full_name || (user.email?.split("@")[0]) || "Analyste";
    const callerEmail = (profile as any)?.email || user.email || "noreply@esono.tech";

    // 5. Watermark unique (traçabilité destinataire)
    const watermarkId = `${(teaserPayload.code_name || "PROJET").replace(/\s/g, "-")}-${fund.id.slice(0, 8)}-${Date.now()}`;

    // 6. HTML
    const html = buildTeaserEmailHtml(
      teaserPayload,
      { fund_name: fund.name, recipient_email: recipientEmail },
      { name: callerName, email: callerEmail, org_name: callerOrgName },
      body.custom_message || null,
      watermarkId,
    );

    const subject = `${teaserPayload.code_name || "Opportunité d'investissement"} — ${teaserPayload?.sections?.presentation?.secteur || "Secteur"}`;

    // 7. Invoke send-email (Resend) via adminClient (service role) car
    //    send-email a verify_jwt=true et le JWT propagé du caller peut être rejeté.
    const sendResp = await adminClient.functions.invoke("send-email", {
      body: {
        to: recipientEmail,
        subject,
        html,
        reply_to: callerEmail,
      },
    });
    if (sendResp.error) {
      // Récupère le vrai message d'erreur de send-email
      let detail = sendResp.error.message;
      try {
        const ctx: any = (sendResp.error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          detail = body?.error?.message || body?.error || JSON.stringify(body);
        }
      } catch (_) { /* keep default */ }
      return errorResponse(`send-email failed: ${detail}`, 500);
    }

    // 8. UPDATE pe_fund_outreach (status='teaser_sent') — réutilise adminClient
    const { data: existing } = await adminClient
      .from("pe_fund_outreach")
      .select("id")
      .eq("deal_id", body.deal_id)
      .eq("funding_program_id", body.funding_program_id)
      .maybeSingle();

    const outreachRow = {
      organization_id: deal.organization_id,
      deal_id: body.deal_id,
      funding_program_id: body.funding_program_id,
      status: "teaser_sent",
      last_action_at: new Date().toISOString(),
      last_action_label: `Teaser envoyé à ${recipientEmail}`,
    };

    if (existing) {
      await adminClient.from("pe_fund_outreach").update(outreachRow).eq("id", existing.id);
    } else {
      await adminClient.from("pe_fund_outreach").insert(outreachRow);
    }

    return jsonResponse({
      success: true,
      recipient: recipientEmail,
      fund: fund.name,
      watermark_id: watermarkId,
      message_id: (sendResp.data as any)?.id,
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
