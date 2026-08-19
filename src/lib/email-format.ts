// Helpers de formatage partagés des e-mails candidats.
//
// Volontairement séparés de completion-email.ts (relance), qui garde ses propres
// copies figées : on ne retouche pas le gabarit de la relance pour le brief 1.
// Ce module sert le NOUVEAU type (communication) et tout code futur.

/** Échappe les caractères HTML (anti-injection / rendu cassé). */
export function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Rend un texte multi-lignes en HTML : on échappe D'ABORD, PUIS on convertit
 * les \n en <br>. L'ordre est critique — l'inverse serait une injection.
 */
export function escMultiline(s: string | null | undefined): string {
  return esc(s).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>\n');
}

/** Neutralise un préfixe « Objet : » recopié dans le champ objet. */
export function neutraliserPrefixeObjet(s: string): string {
  return (s || '').replace(/^\s*objet\s*:\s*/i, '').trim();
}
