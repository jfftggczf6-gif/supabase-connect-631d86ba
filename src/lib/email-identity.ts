// Identité d'émission par organisation (brief 2) — côté client.
//
// La signature et le nom d'expéditeur sont TOUJOURS calculés quand la colonne
// d'organisation est vide : aucune valeur en dur, jamais « L'équipe ESONO » ou
// « L'équipe OVO » figée. La cascade reply-to (avec blocage) est résolue SERVEUR
// dans les edge functions (supabase/functions/_shared/email-identity.ts) — ici on
// ne calcule que ce dont le composeur et l'aperçu ont besoin.

export interface OrgIdentity {
  name?: string | null;
  email_signature?: string | null;
  email_sender_name?: string | null;
  email_reply_to?: string | null;
  logo_url?: string | null;
}

/** Nom d'expéditeur affiché : réglage org, sinon nom de l'org, sinon ESONO. */
export function computeSenderName(org: OrgIdentity | null | undefined): string {
  const explicit = (org?.email_sender_name ?? '').trim();
  if (explicit) return explicit;
  const name = (org?.name ?? '').trim();
  return name || 'ESONO';
}

/**
 * Formule de clôture par défaut : réglage org, sinon « — L'équipe {nom de l'org} ».
 * Calculée, jamais codée en dur (critères 5, 6).
 */
export function computeSignature(org: OrgIdentity | null | undefined): string {
  const explicit = (org?.email_signature ?? '').trim();
  if (explicit) return explicit;
  const name = (org?.name ?? '').trim() || 'ESONO';
  return `— L'équipe ${name}`;
}

/** Validation de FORME d'une adresse e-mail (même règle que le CHECK SQL). */
export function isValidEmail(s: string | null | undefined): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((s ?? '').trim());
}
