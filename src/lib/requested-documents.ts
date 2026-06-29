/**
 * Construit la checklist des documents demandés pour la complétion d'un dossier.
 *
 * Sources, dans l'ordre d'affichage :
 *   1. les champs « document » du formulaire du programme (source: 'form') ;
 *   2. les demandes sur-mesure ajoutées par le chef de programme (source: 'custom').
 *
 * Chaque entrée est marquée fournie/manquante selon les documents déjà attachés
 * à la candidature. Fonction pure → testable, utilisée telle quelle par la page
 * publique de complétion.
 */
import type { CandidatureDoc } from './merge-documents';

export interface RequestedDocument {
  label: string;
  source: 'form' | 'custom';
  provided: boolean;
  fileName: string | null;
}

export interface BuildRequestedInput {
  formFileLabels: string[];
  customLabels: string[];
  existingDocs: CandidatureDoc[];
}

export function buildRequestedDocuments(input: BuildRequestedInput): RequestedDocument[] {
  const { formFileLabels, customLabels, existingDocs } = input;

  const byLabel = new Map<string, CandidatureDoc>();
  for (const d of existingDocs) {
    if (d?.field_label && !byLabel.has(d.field_label)) byLabel.set(d.field_label, d);
  }

  const out: RequestedDocument[] = [];
  const seen = new Set<string>();

  const push = (rawLabel: string, source: 'form' | 'custom') => {
    const label = (rawLabel || '').trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    const existing = byLabel.get(label);
    out.push({
      label,
      source,
      provided: !!existing,
      fileName: existing?.file_name ?? null,
    });
  };

  for (const l of formFileLabels) push(l, 'form');
  for (const l of customLabels) push(l, 'custom');

  return out;
}
