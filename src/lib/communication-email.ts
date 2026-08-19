// Builder du SECOND type d'envoi : communication libre (brief 1).
//
// Communication = corps INTÉGRALEMENT composé par l'utilisateur + formule de
// clôture. Aucun bouton d'action, aucune URL de récupération, aucune phrase
// d'invitation à déposer des documents, aucune introduction pré-remplie, aucun
// titre injecté (critères 2 et 3). Rien n'est inséré entre la saisie et la clôture.
//
// Fonction PURE : les variables du corps/objet sont déjà résolues par l'appelant
// (email-variables.applyVariables), destinataire par destinataire → aperçu = envoi.

import { escMultiline, neutraliserPrefixeObjet } from './email-format';

export interface CommunicationEmailInput {
  /** Objet, variables déjà résolues. Un préfixe « Objet : » est neutralisé. */
  subject: string;
  /** Corps composé par l'utilisateur, variables déjà résolues. */
  body: string;
  /** Formule de clôture (l'identité d'émission est traitée au brief 2). */
  closing?: string;
}

export interface CommunicationEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildCommunicationEmail(input: CommunicationEmailInput): CommunicationEmail {
  const subject = neutraliserPrefixeObjet((input.subject ?? '').trim());
  const body = input.body ?? '';
  const closing = (input.closing ?? '').trim();

  const closingHtml = closing
    ? `<p style="color:#666; font-size:12px; margin-top:24px;">${escMultiline(closing)}</p>`
    : '';

  // Un seul <p> pour le corps ; escMultiline préserve paragraphes et lignes vides.
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color:#1a2744;">
      <p>${escMultiline(body)}</p>
      ${closingHtml}
    </div>
  `.trim();

  // Version texte : brut (pas d'échappement en clair), corps puis clôture.
  const text = [body, closing ? `\n${closing}` : ''].filter(Boolean).join('\n');

  return { subject, html, text };
}
