// Pièces réellement manquantes d'une candidature (brief 1).
//
// Sert au défaut automatique de la relance groupée (chaque destinataire est
// pré-rempli avec SES pièces manquantes) et à la colonne « pièces manquantes »
// de la vue liste. Même définition que candidature-recovery (action info) :
//   pièces attendues = champs "file" du formulaire du programme,
//   reçues = documents ayant un field_label correspondant et un fichier.

export interface FormField { type?: string; label?: string }
export interface CandidatureDoc { field_label?: string; file_name?: string; storage_path?: string }

/** Libellés des champs "fichier" demandés par le formulaire du programme. */
export function fileFieldLabels(formFields: unknown): string[] {
  const arr = Array.isArray(formFields) ? (formFields as FormField[]) : [];
  return arr
    .filter((f) => f && f.type === 'file' && typeof f.label === 'string' && f.label.trim())
    .map((f) => (f.label as string).trim());
}

/** Libellés effectivement reçus (un document avec un fichier). */
export function receivedDocLabels(documents: unknown): Set<string> {
  const arr = Array.isArray(documents) ? (documents as CandidatureDoc[]) : [];
  return new Set(
    arr
      .filter((d) => d && d.field_label && (d.storage_path || d.file_name))
      .map((d) => String(d.field_label).trim()),
  );
}

/**
 * Pièces manquantes = champs "file" du formulaire non encore reçus.
 * (La complétude « métier » du dossier n'entre pas en jeu ; on ne considère que
 * les pièces documentaires attendues par le formulaire.)
 */
export function missingDocLabels(formFields: unknown, documents: unknown): string[] {
  const recus = receivedDocLabels(documents);
  return fileFieldLabels(formFields).filter((label) => !recus.has(label));
}
