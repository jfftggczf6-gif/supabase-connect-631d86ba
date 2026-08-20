// Autorisation d'émission d'un e-mail candidat (bouton « Envoyer un message » +
// envoi groupé — même EF candidature-email-send). Logique PURE et testée ; l'EF
// (Deno) en tient un miroir. La décision réelle est TOUJOURS prise côté serveur —
// masquer un bouton n'est pas une protection.
//
// ⚠️ MIROIR SERVEUR — supabase/functions/candidature-email-send/index.ts
// La règle ci-dessous est DUPLIQUÉE dans l'EF (le serveur décide seul ; aucun test
// ne relie les deux copies). TOUTE modification de la logique ici DOIT être
// répercutée à l'identique dans candidature-email-send, et inversement. Ne jamais
// toucher l'une sans l'autre.
//
// Règle : super_admin, OU owner/admin/manager de l'org émettrice, OU coach assigné
// de TOUS les destinataires de l'opération.
//
// Effet de bord ASSUMÉ : « coach assigné de TOUS » implique qu'un coach assigné à
// N candidatures peut faire un envoi groupé sur ces N-là depuis la vue liste. C'est
// voulu — un coach qui écrit aux entreprises qu'il suit fait son travail, le journal
// en garde trace, le garde-fou tient. Un coach assigné à une PARTIE seulement est
// refusé sur l'opération ENTIÈRE (jamais partiellement servi).

export interface EmissionAuthInput {
  superAdmin: boolean;
  /** owner/admin/manager de l'organisation émettrice. */
  orgManager: boolean;
  /** user id de l'émetteur (JWT). */
  sentBy: string;
  /** assigned_coach_id de CHAQUE destinataire de l'opération. */
  recipientCoachIds: (string | null | undefined)[];
}

export function estAutoriseEmission(input: EmissionAuthInput): boolean {
  if (input.superAdmin) return true;
  if (input.orgManager) return true;
  // Coach assigné de TOUS les destinataires : aucun non-assigné, aucun assigné à
  // quelqu'un d'autre. Sinon → refus sur l'opération entière.
  const ids = input.recipientCoachIds;
  return ids.length > 0 && ids.every((c) => !!c && c === input.sentBy);
}
