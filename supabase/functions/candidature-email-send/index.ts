// candidature-email-send — envoi GROUPÉ d'e-mails candidats (brief 1).
//
// Reçoit une opération : un type ('relance' | 'communication'), un batch_id, et
// N destinataires (candidature_id + contenu déjà construit côté client, variables
// résolues). Produit N e-mails DISTINCTS (un appel Resend par destinataire, jamais
// d'en-tête partagé — critère 5), applique le garde-fou (30/op, 150/j/org, allowlist
// sur 'communication'), journalise chaque ligne avec le batch_id, et REPREND sur
// reliquat en sautant les destinataires déjà servis du même batch (critère 11).
//
// Sécurité : l'adresse `to` est TOUJOURS résolue en base (candidatures.contact_email),
// jamais celle transmise par le client. L'organisation est dérivée des candidatures
// et doit être unique (une opération = une cohorte = une org).
//
// Relance groupée : chaque destinataire reçoit SON token (N liens distincts). Le
// client construit le HTML avec un placeholder de lien ; l'EF génère le vrai token
// (échéance COMMUNE = operation_expires_at, identique pour tous, y compris le
// reliquat) et remplace le placeholder avant l'envoi.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierOperation, ALLOWLIST_ACTIVE } from "../_shared/email-garde-fou.ts";
import { resolveEmissionIdentity } from "../_shared/email-identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DOIT correspondre exactement à la constante du composeur front (RECOVERY_URL_PLACEHOLDER).
const RECOVERY_URL_PLACEHOLDER = "{{__RECOVERY_URL__}}";

// Miroir de src/lib/relance-link-guard.ts (source de vérité testée, 7 tests).
// Garder SYNCHRO. Allowlist : le lien relance apparaît 2× en HTML (bouton + secours)
// et 1× en texte, aucun href autre que le placeholder, aucun chemin en dur.
const RELANCE_PLACEHOLDER_COUNT_HTML = 2;
const RELANCE_PLACEHOLDER_COUNT_TEXT = 1;
function countOcc(hay: string, needle: string): number { return hay.split(needle).length - 1; }
function checkRelanceLinks(html: string, text: string): { ok: boolean; raison?: string } {
  const nHtml = countOcc(html, RECOVERY_URL_PLACEHOLDER);
  if (nHtml !== RELANCE_PLACEHOLDER_COUNT_HTML) return { ok: false, raison: `placeholder ${nHtml}× en HTML (attendu ${RELANCE_PLACEHOLDER_COUNT_HTML})` };
  if (text) {
    const nText = countOcc(text, RECOVERY_URL_PLACEHOLDER);
    if (nText !== RELANCE_PLACEHOLDER_COUNT_TEXT) return { ok: false, raison: `placeholder ${nText}× en texte (attendu ${RELANCE_PLACEHOLDER_COUNT_TEXT})` };
  }
  for (const m of html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)) {
    if (m[1] !== RECOVERY_URL_PLACEHOLDER) return { ok: false, raison: "href non conforme (lien en dur)" };
  }
  if (/\/candidature\/recovery\//.test(html) || /\/candidature\/recovery\//.test(text)) {
    return { ok: false, raison: "URL de récupération en dur" };
  }
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateToken(): string {
  return crypto.getRandomValues(new Uint8Array(32))
    .reduce((acc, b) => acc + b.toString(16).padStart(2, "0"), "");
}

async function envoyerViaResend(apiKey: string, payload: Record<string, unknown>):
  Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) return { ok: false, error: JSON.stringify(data) };
  return { ok: true, id: data.id };
}

interface RecipientIn {
  candidature_id: string;
  subject: string;
  html: string;
  text?: string;
  requested_docs?: string[]; // relance : pièces demandées à CE destinataire
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const type: "relance" | "communication" = body.type === "communication" ? "communication" : "relance";
    const batch_id: string = String(body.batch_id ?? "");
    // Origin des liens : SERVEUR uniquement, jamais le client (anti-phishing /
    // open-redirect). Le front ne transmet plus `origin` — il est ignoré s'il le fait.
    const origin: string = (Deno.env.get("APP_BASE_URL") ?? "https://esono.tech").replace(/\/+$/, "");
    const operationExpiresAt: string | null = body.operation_expires_at ?? null;
    const recipients: RecipientIn[] = Array.isArray(body.recipients) ? body.recipients : [];

    if (!UUID_RE.test(batch_id)) return jsonRes({ error: "batch_id (uuid) requis" }, 400);
    if (recipients.length === 0) return jsonRes({ error: "Aucun destinataire" }, 400);
    // Garde-fou d'entrée : le plafond par opération est aussi une borne dure ici.
    if (recipients.some((r) => !r || !UUID_RE.test(String(r.candidature_id)))) {
      return jsonRes({ error: "candidature_id invalide dans la sélection" }, 400);
    }

    // Émetteur = utilisateur du JWT — AUTHENTIFICATION REQUISE (pas d'envoi anonyme).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Authentification requise" }, 401);
    const { data: u, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !u?.user) return jsonRes({ error: "Non authentifié" }, 401);
    const sent_by = u.user.id;

    // Résolution serveur des candidatures : org (unique) + adresse réelle.
    const ids = [...new Set(recipients.map((r) => String(r.candidature_id)))];
    const { data: cands, error: candErr } = await admin
      .from("candidatures")
      .select("id, organization_id, contact_email, assigned_coach_id")
      .in("id", ids);
    if (candErr) return jsonRes({ error: candErr.message }, 500);
    const byId = new Map((cands ?? []).map((c: any) => [c.id, c]));
    const orgs = new Set((cands ?? []).map((c: any) => c.organization_id));
    if (orgs.size === 0) return jsonRes({ error: "Candidatures introuvables" }, 404);
    if (orgs.size > 1) return jsonRes({ error: "Une opération d'envoi ne peut cibler qu'une seule organisation." }, 400);
    const organization_id = [...orgs][0] as string;

    // AUTORISATION D'ÉMISSION (vérifiée ICI, côté serveur — masquer un bouton n'est
    // pas une protection). Autorisé si :
    //   · super_admin, OU
    //   · owner/admin/manager de l'org émettrice, OU
    //   · coach assigné de TOUS les destinataires de l'opération.
    // EFFET DE BORD ASSUMÉ : « coach assigné de TOUS » ⇒ un coach assigné à N
    // candidatures peut faire un ENVOI GROUPÉ sur ces N-là depuis la vue liste. C'est
    // voulu (il écrit aux entreprises qu'il suit, le journal trace, le garde-fou tient).
    // Un coach assigné à une PARTIE seulement est refusé sur l'opération ENTIÈRE,
    // jamais partiellement servi.
    //
    // ⚠ MIROIR FRONT — src/lib/email-emission-auth.ts (estAutoriseEmission, testé).
    // Cette règle est DUPLIQUÉE dans la lib front ; aucun test ne relie les deux
    // copies. TOUTE modification ici DOIT être répercutée à l'identique dans
    // email-emission-auth.ts, et inversement. Ne jamais toucher l'une sans l'autre.
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", sent_by)
      .eq("is_active", true)
      .maybeSingle();
    const { data: estSuperAdmin } = await admin.rpc("has_role", { _user_id: sent_by, _role: "super_admin" });
    const superAdmin = estSuperAdmin === true;
    const orgManager = ["owner", "admin", "manager"].includes((membership?.role as string) ?? "");
    const recipientCoachIds = recipients.map((r) => (byId.get(String(r.candidature_id))?.assigned_coach_id ?? null));
    const coachDeTous = recipientCoachIds.length > 0 && recipientCoachIds.every((c: any) => !!c && c === sent_by);
    if (!(superAdmin || orgManager || coachDeTous)) {
      return jsonRes({
        error: "Émission réservée aux owner/admin/manager de l'organisation, ou au coach assigné de TOUS les destinataires.",
      }, 403);
    }

    // Identité d'émission (brief 2) : from = nom d'expéditeur de l'org (calculé si
    // vide) ; reply_to = cascade correspondance utilisateur → e-mail JWT →
    // org.email_reply_to → BLOCAGE. S'applique aux deux types (critère 14).
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name, email_sender_name, email_reply_to")
      .eq("id", organization_id)
      .maybeSingle();
    const { data: prof } = await admin
      .from("profiles")
      .select("correspondence_email")
      .eq("user_id", sent_by)
      .maybeSingle();
    const identite = resolveEmissionIdentity({
      org: orgRow,
      correspondenceEmail: prof?.correspondence_email,
      authEmail: u.user.email,
    });
    if (!identite.ok) {
      return jsonRes({ error: identite.raison, blocage_reply_to: true }, 422);
    }

    // Compte du jour pour l'org (fuseau Africa/Abidjan, 'failed' exclu) → plafond quotidien.
    const jourLocal = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Abidjan" }).format(new Date());
    const debutJour = `${jourLocal}T00:00:00+00:00`;
    const { count: dejaAujourdhui } = await admin
      .from("candidature_emails")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .neq("delivery_status", "failed")
      .gte("sent_at", debutJour);

    // Adresses réelles (résolues serveur) pour le garde-fou.
    const destinataires = recipients
      .map((r) => byId.get(String(r.candidature_id))?.contact_email as string | undefined)
      .filter((e): e is string => !!e);

    const verdict = verifierOperation({
      type,
      destinataires,
      envoisAujourdhuiPourOrg: dejaAujourdhui ?? 0,
    });
    // Plafond (opération ou quotidien) → refus GLOBAL, rien n'est envoyé.
    if (verdict.motif_operation) {
      return jsonRes({ error: verdict.motif_operation, refuse_par_garde_fou: true }, 422);
    }
    const refusesAllowlist = new Set(verdict.refuses.map((r) => r.email.toLowerCase()));

    // Reprise : destinataires déjà servis pour CE batch (ligne non-'failed').
    const { data: servisRows } = await admin
      .from("candidature_emails")
      .select("candidature_id")
      .eq("batch_id", batch_id)
      .neq("delivery_status", "failed");
    const dejaServis = new Set((servisRows ?? []).map((r: any) => r.candidature_id));

    const results: { candidature_id: string; to: string | null; statut: "sent" | "failed" | "refused" | "skipped"; error?: string }[] = [];

    for (const r of recipients) {
      const cid = String(r.candidature_id);
      const cand = byId.get(cid);
      const to = (cand?.contact_email as string | undefined) ?? null;

      if (dejaServis.has(cid)) { results.push({ candidature_id: cid, to, statut: "skipped" }); continue; }
      if (!cand) { results.push({ candidature_id: cid, to: null, statut: "failed", error: "candidature introuvable" }); continue; }
      if (!to) { results.push({ candidature_id: cid, to: null, statut: "failed", error: "adresse candidat inconnue" }); continue; }

      // Refus allowlist (communication) : journalisé en 'failed', non envoyé.
      if (refusesAllowlist.has(to.toLowerCase())) {
        await admin.from("candidature_emails").insert({
          candidature_id: cid, organization_id, type, subject: r.subject, body_html: r.html,
          sent_by, delivery_status: "failed", error: "Garde-fou : hors liste blanche du chantier.", batch_id,
        });
        results.push({ candidature_id: cid, to, statut: "refused", error: "hors liste blanche" });
        continue;
      }

      // Relance : génère le token (échéance COMMUNE) + remplace le placeholder de lien.
      let html = r.html;
      let text = r.text ?? "";
      if (type === "relance") {
        // GARDE ANTI-FUITE DE LIEN (critique) — allowlist : le HTML ne doit porter
        // QUE le placeholder, au bon nombre, sans aucun lien en dur (href non conforme
        // ou chemin de récupération, même encodé). Un bug client ne doit jamais pouvoir
        // envoyer un même lien à plusieurs destinataires (accès croisé aux dossiers).
        // En cas d'écart : on refuse ce destinataire (journalisé), rien n'est généré.
        const garde = checkRelanceLinks(html, text);
        if (!garde.ok) {
          await admin.from("candidature_emails").insert({
            candidature_id: cid, organization_id, type, subject: r.subject, body_html: r.html,
            sent_by, delivery_status: "failed", batch_id,
            error: `Garde anti-fuite de lien : ${garde.raison}.`,
          });
          results.push({ candidature_id: cid, to, statut: "failed", error: "garde anti-fuite de lien" });
          continue;
        }
        const token = generateToken();
        const expiresAt = operationExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error: updErr } = await admin.from("candidatures").update({
          recovery_token: token,
          recovery_expires_at: expiresAt,
          recovery_used_at: null,
          recovery_requested_docs: Array.isArray(r.requested_docs)
            ? r.requested_docs.map((s) => String(s).trim()).filter(Boolean).slice(0, 30)
            : [],
        }).eq("id", cid);
        if (updErr) {
          await admin.from("candidature_emails").insert({
            candidature_id: cid, organization_id, type, subject: r.subject, body_html: r.html,
            sent_by, delivery_status: "failed", error: `Génération du lien : ${updErr.message}`, batch_id,
          });
          results.push({ candidature_id: cid, to, statut: "failed", error: "génération du lien" });
          continue;
        }
        const url = `${origin}/candidature/recovery/${token}`;
        html = html.split(RECOVERY_URL_PLACEHOLDER).join(url);
        text = text.split(RECOVERY_URL_PLACEHOLDER).join(url);
      }

      const payload: Record<string, unknown> = {
        from: identite.from,
        to: [to],
        subject: r.subject,
        html,
        reply_to: identite.reply_to,
      };
      if (text) payload.text = text;

      const sent = await envoyerViaResend(RESEND_API_KEY, payload);
      await admin.from("candidature_emails").insert({
        candidature_id: cid, organization_id, type, subject: r.subject, body_html: html,
        sent_by, batch_id,
        delivery_status: sent.ok ? "sent" : "failed",
        provider_message_id: sent.ok ? sent.id : null,
        error: sent.ok ? null : sent.error,
      });
      results.push({ candidature_id: cid, to, statut: sent.ok ? "sent" : "failed", error: sent.ok ? undefined : sent.error });
    }

    const bilan = {
      envoyes: results.filter((r) => r.statut === "sent").length,
      echecs: results.filter((r) => r.statut === "failed").length,
      refuses: results.filter((r) => r.statut === "refused").length,
      deja_servis: results.filter((r) => r.statut === "skipped").length,
    };
    console.log(`[candidature-email-send] batch ${batch_id} type=${type} allowlist=${ALLOWLIST_ACTIVE} →`, JSON.stringify(bilan));
    return jsonRes({ success: true, batch_id, bilan, results });
  } catch (e: any) {
    console.error("[candidature-email-send] error:", e);
    return jsonRes({ error: e.message }, 500);
  }
});
