/**
 * Construit l'email envoyé au candidat pour qu'il complète/re-dépose les
 * documents manquants de sa candidature, via le lien de récupération.
 *
 * Fonction pure (aucun effet de bord) : testable et réutilisable. L'envoi
 * effectif passe par l'edge function `send-email` (Resend), à qui on transmet
 * { to, subject, html, text }.
 */
export interface CompletionEmailInput {
  companyName: string | null;
  contactName: string | null;
  programmeName: string | null;
  recoveryUrl: string;
  /** ISO string ou null si pas d'expiration connue. */
  expiresAt: string | null;
}

export interface CompletionEmail {
  subject: string;
  html: string;
  text: string;
}

/** Échappe les caractères HTML pour éviter une injection / un rendu cassé. */
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatExpiry(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} à ${time}`;
}

export function buildCompletionEmail(input: CompletionEmailInput): CompletionEmail {
  const { companyName, contactName, programmeName, recoveryUrl, expiresAt } = input;

  const subject = programmeName
    ? `Complétez votre candidature — ${programmeName}`
    : 'Complétez votre candidature';

  const greeting = contactName ? `Bonjour ${esc(contactName)},` : 'Bonjour,';
  const greetingText = contactName ? `Bonjour ${contactName},` : 'Bonjour,';

  const company = companyName ? esc(companyName) : 'votre entreprise';
  const programmePart = programmeName ? ` dans le cadre du programme <strong>${esc(programmeName)}</strong>` : '';
  const programmePartText = programmeName ? ` dans le cadre du programme ${programmeName}` : '';

  const expiryFormatted = expiresAt ? formatExpiry(expiresAt) : null;
  const expiryHtml = expiryFormatted
    ? `<p style="color: #92400e; font-size: 13px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px;">⏳ Ce lien expire le ${expiryFormatted}.</p>`
    : '';
  const expiryText = expiryFormatted ? `\nCe lien expire le ${expiryFormatted}.\n` : '';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color:#1a2744;">
      <h2>Complétez votre candidature</h2>
      <p>${greeting}</p>
      <p>Votre dossier de candidature pour <strong>${company}</strong>${programmePart} est incomplet : certaines pièces justificatives n'ont pas été reçues.</p>
      <p>Merci de cliquer sur le bouton ci-dessous pour déposer les documents manquants :</p>
      <p style="margin: 24px 0;">
        <a href="${esc(recoveryUrl)}" style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Compléter mon dossier
        </a>
      </p>
      <p style="color:#666; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${esc(recoveryUrl)}</p>
      ${expiryHtml}
      <p style="color:#666; font-size: 12px;">— L'équipe ESONO</p>
    </div>
  `.trim();

  const text = [
    greetingText,
    ``,
    `Votre dossier de candidature pour ${companyName || 'votre entreprise'}${programmePartText} est incomplet : certaines pièces justificatives n'ont pas été reçues.`,
    ``,
    `Complétez votre dossier ici : ${recoveryUrl}`,
    expiryText,
    `— L'équipe ESONO`,
  ].filter(line => line !== undefined).join('\n');

  return { subject, html, text };
}
