/**
 * Construit l'email envoyé au candidat pour qu'il complète/re-dépose les
 * documents manquants de sa candidature, via le lien de récupération.
 *
 * Fonction pure (aucun effet de bord) : testable et réutilisable. L'envoi
 * effectif passe par l'edge function `send-email` (Resend), à qui on transmet
 * { to, subject, html, text }.
 *
 * Édition structurée par champs (pas d'éditeur HTML libre) : le programme peut
 * ajuster l'objet, l'intro, un mot personnel et la clôture. Chacun est traité
 * comme du TEXTE échappé via esc(). Le squelette — salutation nominative,
 * liste des documents demandés, bouton CTA — reste piloté par le gabarit et
 * n'est jamais éditable.
 */

/** Champs éditables par le programme. Absent → valeur par défaut du gabarit. */
export interface CompletionEmailFields {
  subject?: string;
  intro?: string;
  personalNote?: string;
  closing?: string;
}

export interface CompletionEmailInput {
  companyName: string | null;
  contactName: string | null;
  programmeName: string | null;
  recoveryUrl: string;
  /** ISO string ou null si pas d'expiration connue. */
  expiresAt: string | null;
  /** Documents demandés au candidat — rendus par le gabarit (non éditables). */
  requestedDocs?: string[];
  /** Champs éditables ; chacun absent → défaut du gabarit. */
  fields?: CompletionEmailFields;
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

/**
 * Valeurs par défaut du gabarit pour les champs éditables. Exportée pour que le
 * dialog préremplisse EXACTEMENT le même texte que celui appliqué en fallback
 * ici — garantit qu'un envoi sans modification reproduit le message historique.
 */
export function completionEmailDefaults(input: {
  companyName: string | null;
  programmeName: string | null;
}): { subject: string; intro: string; closing: string } {
  const { companyName, programmeName } = input;

  const subject = programmeName
    ? `Complétez votre candidature — ${programmeName}`
    : 'Complétez votre candidature';

  const company = companyName || 'votre entreprise';
  const programmePart = programmeName ? ` dans le cadre du programme ${programmeName}` : '';
  const intro = `Votre dossier de candidature pour ${company}${programmePart} est incomplet : certaines pièces justificatives n'ont pas été reçues.`;

  const closing = "— L'équipe ESONO";

  return { subject, intro, closing };
}

export function buildCompletionEmail(input: CompletionEmailInput): CompletionEmail {
  const { companyName, contactName, programmeName, recoveryUrl, expiresAt, requestedDocs, fields } = input;

  const defaults = completionEmailDefaults({ companyName, programmeName });

  // Champs éditables : fallback vers le défaut du gabarit si absent ou vide.
  // Le sujet est un en-tête (plein texte) → jamais passé dans le HTML, donc non
  // échappé (sinon un « & » légitime deviendrait « &amp; » dans la ligne objet).
  const subject = fields?.subject?.trim() ? fields.subject : defaults.subject;
  const intro = fields?.intro?.trim() ? fields.intro : defaults.intro;
  const closing = fields?.closing?.trim() ? fields.closing : defaults.closing;
  // Mot personnel : réellement optionnel — absent/vide → bloc omis (pas de défaut).
  const personalNote = fields?.personalNote?.trim() ? fields.personalNote : null;

  // Salutation nominative (gabarit).
  const greeting = contactName ? `Bonjour ${esc(contactName)},` : 'Bonjour,';
  const greetingText = contactName ? `Bonjour ${contactName},` : 'Bonjour,';

  // Liste des documents demandés (gabarit, non éditable) — corrige le bug qui la
  // faisait disparaître de l'email. Toujours rendue quand des docs sont fournis.
  const docs = (requestedDocs ?? []).map(d => (d ?? '').trim()).filter(Boolean);
  const docsHtml = docs.length
    ? `<p style="margin: 16px 0 4px;"><strong>Documents à fournir :</strong></p>
      <ul style="margin: 0 0 4px; padding-left: 20px; color:#1a2744;">
        ${docs.map(d => `<li>${esc(d)}</li>`).join('\n        ')}
      </ul>`
    : '';
  const docsText = docs.length
    ? `\nDocuments à fournir :\n${docs.map(d => `- ${esc(d)}`).join('\n')}\n`
    : '';

  const personalNoteHtml = personalNote
    ? `<p style="background:#f5f3ff; border-left:3px solid #7c3aed; padding:10px 12px; border-radius:4px;">${esc(personalNote)}</p>`
    : '';
  const personalNoteText = personalNote ? `\n${esc(personalNote)}\n` : '';

  const expiryFormatted = expiresAt ? formatExpiry(expiresAt) : null;
  const expiryHtml = expiryFormatted
    ? `<p style="color: #92400e; font-size: 13px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px;">⏳ Ce lien expire le ${expiryFormatted}.</p>`
    : '';
  const expiryText = expiryFormatted ? `\nCe lien expire le ${expiryFormatted}.\n` : '';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color:#1a2744;">
      <h2>Complétez votre candidature</h2>
      <p>${greeting}</p>
      <p>${esc(intro)}</p>
      ${personalNoteHtml}
      ${docsHtml}
      <p>Merci de cliquer sur le bouton ci-dessous pour déposer les documents manquants :</p>
      <p style="margin: 24px 0;">
        <a href="${esc(recoveryUrl)}" style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Compléter mon dossier
        </a>
      </p>
      <p style="color:#666; font-size: 12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${esc(recoveryUrl)}</p>
      ${expiryHtml}
      <p style="color:#666; font-size: 12px;">${esc(closing)}</p>
    </div>
  `.trim();

  const text = [
    greetingText,
    ``,
    esc(intro),
    personalNoteText,
    docsText,
    `Complétez votre dossier ici : ${recoveryUrl}`,
    expiryText,
    esc(closing),
  ].filter(line => line !== undefined).join('\n');

  return { subject, html, text };
}
