import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  verifierOperation,
  ALLOWLIST_ACTIVE,
} from "../_shared/email-garde-fou.ts";
import { resolveEmissionIdentity } from "../_shared/email-identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Envoi Resend brut, BLOQUANT : on attend la réponse et on la capture (id ou erreur).
// C'est cette réponse qui alimente delivery_status / provider_message_id du journal.
async function envoyerViaResend(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) return { ok: false, status: resp.status, error: JSON.stringify(data) };
  return { ok: true, id: data.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const {
      to, subject, html, text, from, reply_to,
      // Contexte candidat (opt-in) : présent UNIQUEMENT pour les envois de
      // relance/communication émis par le composeur. Absent pour tous les autres
      // appelants (invitations, digests, création d'org…) → chemin générique inchangé.
      candidature_id, type,
    } = await req.json();

    if (!to || !subject || !html) {
      return json({ error: "to, subject, html required" }, 400);
    }

    const payload: Record<string, unknown> = {
      from: from || "ESONO <noreply@esono.tech>",
      to: [to],
      subject,
      html,
    };
    if (text) payload.text = text;
    if (reply_to) payload.reply_to = reply_to;

    // ─────────────────────────────────────────────────────────────────────────
    // CHEMIN GÉNÉRIQUE — aucun contexte candidat : comportement historique EXACT.
    // (Ne jamais y appliquer le garde-fou : il barrerait invitations et digests.)
    // ─────────────────────────────────────────────────────────────────────────
    if (!candidature_id) {
      const r = await envoyerViaResend(RESEND_API_KEY, payload);
      if (!r.ok) {
        console.error("[send-email] Resend error:", r.error);
        return json({ error: r.error }, r.status);
      }
      console.log(`[send-email] ✅ Sent to ${to}: ${subject}`);
      return json({ success: true, id: r.id });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHEMIN CANDIDAT — relance documentaire / communication.
    // Garde-fou (allowlist + plafonds) PUIS journalisation obligatoire, quel que
    // soit le résultat (envoyé, refusé, échoué). Tout est côté EF, jamais front.
    // ─────────────────────────────────────────────────────────────────────────
    const typeEnvoi = type === "communication" ? "communication" : "relance";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Organisation dérivée de la candidature (jamais transmise par le front).
    const { data: cand, error: candErr } = await admin
      .from("candidatures")
      .select("organization_id")
      .eq("id", candidature_id)
      .maybeSingle();
    if (candErr || !cand) {
      return json({ error: "Candidature introuvable — envoi refusé." }, 404);
    }
    const organization_id = cand.organization_id as string;

    // 2. Émetteur = utilisateur du JWT (transmis automatiquement par invoke()).
    let sent_by: string | null = null;
    let authEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: u } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
      sent_by = u?.user?.id ?? null;
      authEmail = u?.user?.email ?? null;
    }

    // 3. Compte des envois du jour pour l'org → plafond quotidien.
    //    « Aujourd'hui » = journée calendaire dans le fuseau de travail des cohortes.
    //    Abidjan/Dakar = UTC+00 SANS heure d'été : minuit local = minuit UTC, donc
    //    le plafond se réinitialise à minuit heure de travail, pas en pleine journée.
    //    (Si ce fuseau devenait non-UTC, il faudrait recalculer l'offset ci-dessous.)
    const FUSEAU_PLAFOND = "Africa/Abidjan"; // UTC+00
    const jourLocal = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU_PLAFOND }).format(new Date()); // "YYYY-MM-DD"
    const debutJour = `${jourLocal}T00:00:00+00:00`;
    //    Le quota compte tout e-mail RÉELLEMENT PARTI. On exclut UNIQUEMENT 'failed'
    //    (refus garde-fou ou erreur Resend : le mail n'est jamais parti). Tout le
    //    reste consomme le quota, Y COMPRIS 'bounced' et 'complained' : un rebond
    //    n'est pas un échec d'envoi — le mail est parti, puis rejeté à l'arrivée.
    //    Liste noire (≠ 'failed'), volontairement PAS une liste blanche de succès,
    //    pour ne pas oublier à l'avenir un statut « parti » (ex. 'delivered').
    const { count } = await admin
      .from("candidature_emails")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .neq("delivery_status", "failed")
      .gte("sent_at", debutJour);
    const envoisAujourdhui = count ?? 0;

    // 4. Garde-fou. Plafonds sur les deux types ; allowlist selon ALLOWLIST_PAR_TYPE
    //    (Option 2 : seule la 'communication' est bridée, la relance jamais).
    const verdict = verifierOperation({
      type: typeEnvoi,
      destinataires: [to],
      envoisAujourdhuiPourOrg: envoisAujourdhui,
    });

    if (!verdict.autorise) {
      const motif = verdict.motif_operation ?? verdict.refuses[0]?.motif ?? "Envoi refusé par le garde-fou.";
      // Refus JOURNALISÉ (le plafond dépassé comme le hors-liste laissent une trace).
      await admin.from("candidature_emails").insert({
        candidature_id, organization_id, type: typeEnvoi,
        subject, body_html: html, sent_by,
        delivery_status: "failed", error: `Garde-fou : ${motif}`,
      });
      console.warn(`[send-email] ⛔ garde-fou refuse ${to} : ${motif}`);
      return json({ error: motif, refuse_par_garde_fou: true }, 422);
    }

    // 5. Identité d'émission (brief 2) : from = nom d'expéditeur de l'org ; reply_to
    //    = cascade correspondance utilisateur → e-mail JWT → org.email_reply_to →
    //    BLOCAGE (422). S'applique aux deux types, relance comprise (critère 14).
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name, email_sender_name, email_reply_to")
      .eq("id", organization_id)
      .maybeSingle();
    let correspondenceEmail: string | null = null;
    if (sent_by) {
      const { data: prof } = await admin
        .from("profiles").select("correspondence_email").eq("user_id", sent_by).maybeSingle();
      correspondenceEmail = prof?.correspondence_email ?? null;
    }
    const identite = resolveEmissionIdentity({ org: orgRow, correspondenceEmail, authEmail });
    if (!identite.ok) {
      return json({ error: identite.raison, blocage_reply_to: true }, 422);
    }
    payload.from = identite.from;
    payload.reply_to = identite.reply_to;

    // 6. Envoi réel bloquant, puis journalisation du résultat capturé.
    const r = await envoyerViaResend(RESEND_API_KEY, payload);
    await admin.from("candidature_emails").insert({
      candidature_id, organization_id, type: typeEnvoi,
      subject, body_html: html, sent_by,
      delivery_status: r.ok ? "sent" : "failed",
      provider_message_id: r.ok ? r.id : null,
      error: r.ok ? null : r.error,
    });

    if (!r.ok) {
      console.error("[send-email] Resend error (candidat):", r.error);
      return json({ error: r.error }, r.status);
    }
    console.log(`[send-email] ✅ ${typeEnvoi} → ${to} (allowlist ${ALLOWLIST_ACTIVE ? "active" : "levée"})`);
    return json({ success: true, id: r.id });
  } catch (e: any) {
    console.error("[send-email] error:", e);
    return json({ error: e.message }, 500);
  }
});
