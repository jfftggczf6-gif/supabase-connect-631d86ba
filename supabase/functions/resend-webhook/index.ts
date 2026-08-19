// resend-webhook — met à jour delivery_status du journal candidature_emails à
// partir des événements Resend (brief 1). Public (verify_jwt=false), mais la
// signature Svix est vérifiée : sans secret valide, l'événement est rejeté.
//
// Rapprochement par provider_message_id (= id Resend renvoyé à l'envoi).
// Événements → statut : email.delivered→'delivered', email.bounced→'bounced',
// email.complained→'complained'. On NE rétrograde jamais un statut : une remise
// (delivered) n'écrase pas un rebond (bounced) déjà enregistré.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as b64decode, encode as b64encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const EVENT_TO_STATUS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

// Un statut « parti puis rejeté/remis » ne doit pas être réécrit par un événement
// moins avancé. Ordre de finalité (plus grand = plus définitif).
const FINALITE: Record<string, number> = {
  queued: 0, sent: 1, delivered: 2, complained: 3, bounced: 3, failed: 3,
};

async function verifierSignatureSvix(
  secret: string, svixId: string, svixTimestamp: string, svixSignature: string, payload: string,
): Promise<boolean> {
  try {
    const secretBytes = b64decode(secret.replace(/^whsec_/, ""));
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
    const expected = b64encode(new Uint8Array(sig));
    // En-tête svix-signature = "v1,<sig> v1,<sig2> …" (rotation de secrets possible).
    return svixSignature.split(" ").some((part) => part.split(",")[1] === expected);
  } catch {
    return false;
  }
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method !== "POST") return jsonRes({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return jsonRes({ error: "webhook secret not configured" }, 500);

  const raw = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTs = req.headers.get("svix-timestamp") ?? "";
  const svixSig = req.headers.get("svix-signature") ?? "";
  if (!svixId || !svixTs || !svixSig) return jsonRes({ error: "missing svix headers" }, 400);

  // Anti-rejeu : timestamp à ±5 min.
  const tsMs = Number(svixTs) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return jsonRes({ error: "stale timestamp" }, 400);
  }
  if (!(await verifierSignatureSvix(secret, svixId, svixTs, svixSig, raw))) {
    return jsonRes({ error: "invalid signature" }, 401);
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return jsonRes({ error: "invalid json" }, 400); }

  const nouveauStatut = EVENT_TO_STATUS[event?.type];
  const messageId = event?.data?.email_id;
  if (!nouveauStatut || !messageId) {
    return jsonRes({ ok: true, ignored: event?.type ?? "unknown" }); // ack : événement non suivi
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await admin
    .from("candidature_emails")
    .select("id, delivery_status")
    .eq("provider_message_id", messageId);

  for (const row of rows ?? []) {
    // Ne pas rétrograder un statut plus définitif (ex. bounced arrivé avant delivered).
    if ((FINALITE[nouveauStatut] ?? 0) < (FINALITE[row.delivery_status] ?? 0)) continue;
    await admin.from("candidature_emails")
      .update({ delivery_status: nouveauStatut })
      .eq("id", row.id);
  }

  return jsonRes({ ok: true, updated: (rows ?? []).length, statut: nouveauStatut });
});
