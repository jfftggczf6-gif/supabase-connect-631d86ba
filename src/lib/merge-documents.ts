/**
 * Fusion des documents d'une candidature lors d'une complétion de dossier.
 *
 * Principe (corrige le « point 1 » : ne jamais écraser le dossier existant) :
 *   - un document re-déposé pour une PIÈCE DEMANDÉE (slot nommé) remplace
 *     l'ancien du même slot ;
 *   - les documents libres ("Document supplémentaire") s'ajoutent les uns aux
 *     autres ;
 *   - les documents existants non concernés sont conservés tels quels ;
 *   - dédoublonnage par storage_path (un même fichier n'apparaît qu'une fois).
 *
 * Fonction pure → testable. Le client envoie la liste fusionnée complète à
 * l'edge function, qui se contente de la stocker.
 */
export const FREE_DOC_LABEL = 'Document supplémentaire';

export interface CandidatureDoc {
  field_label: string;
  file_name: string;
  file_size: number | null;
  storage_path: string;
}

export function mergeDocuments(existing: CandidatureDoc[], incoming: CandidatureDoc[]): CandidatureDoc[] {
  // Slots (pièces nommées) re-déposés → on retire l'ancien du même slot.
  const replacedSlots = new Set(
    incoming.filter(d => d.field_label && d.field_label !== FREE_DOC_LABEL).map(d => d.field_label),
  );

  const kept = existing.filter(d => !replacedSlots.has(d.field_label));
  const merged = [...kept, ...incoming];

  // Dédoublonnage par storage_path (première occurrence gagne).
  const seen = new Set<string>();
  const out: CandidatureDoc[] = [];
  for (const d of merged) {
    if (d.storage_path && seen.has(d.storage_path)) continue;
    if (d.storage_path) seen.add(d.storage_path);
    out.push(d);
  }
  return out;
}
