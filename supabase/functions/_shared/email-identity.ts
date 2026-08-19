// Identité d'émission par organisation (brief 2) — côté serveur (edge functions).
//
// Résout l'en-tête `from` (nom d'expéditeur de l'org) et l'adresse de réponse
// `reply_to` selon la cascade décidée :
//   profiles.correspondence_email → e-mail du JWT → organizations.email_reply_to → BLOCAGE.
// Le blocage est DUR (critère 13) : un e-mail qui appelle une réponse ne part pas
// sans canal de retour. S'applique aux DEUX types d'envoi (critère 14).
//
// Le nom d'expéditeur miroir src/lib/email-identity.ts (computeSenderName). Garder synchro.

export function computeSenderName(org: any): string {
  const explicit = (org?.email_sender_name ?? "").trim();
  if (explicit) return explicit;
  const name = (org?.name ?? "").trim();
  return name || "ESONO";
}

export interface IdentityInput {
  org: any;                        // ligne organizations (name, email_sender_name, email_reply_to)
  correspondenceEmail?: string | null; // profiles.correspondence_email de l'émetteur
  authEmail?: string | null;       // e-mail du JWT de l'émetteur
}

export type IdentityResult =
  | { ok: true; from: string; reply_to: string }
  | { ok: false; raison: string };

export function resolveEmissionIdentity(input: IdentityInput): IdentityResult {
  const from = `${computeSenderName(input.org)} <noreply@esono.tech>`;

  const correspondence = (input.correspondenceEmail ?? "").trim();
  const auth = (input.authEmail ?? "").trim();
  const orgReply = (input.org?.email_reply_to ?? "").trim();
  const replyTo = correspondence || auth || orgReply;

  if (!replyTo) {
    return {
      ok: false,
      raison: "Aucune adresse de réponse disponible : renseigne une adresse de correspondance sur ton compte, ou une adresse de réponse d'organisation, avant d'envoyer.",
    };
  }
  return { ok: true, from, reply_to: replyTo };
}
