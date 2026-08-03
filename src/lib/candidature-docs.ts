/**
 * Helpers purs pour les documents de candidature (ajout côté coordinateur).
 * La traçabilité faisant autorité est stampée par l'edge function ; ces helpers
 * servent à l'affichage optimiste (badge « ajouté par X ») en attendant le reload.
 */

export interface CandidatureDoc {
  field_label?: string;
  file_name: string;
  file_size?: number | null;
  storage_path: string;
  source?: string;
  added_by_id?: string;
  added_by_name?: string;
  added_at?: string;
}

/** Fusionne deux listes de docs en dédupliquant par file_name (les `added` gagnent). */
export function mergeDocuments(existing: CandidatureDoc[], added: CandidatureDoc[]): CandidatureDoc[] {
  const byName = new Map<string, CandidatureDoc>();
  for (const d of existing || []) if (d?.file_name) byName.set(d.file_name, d);
  for (const d of added || []) if (d?.file_name) byName.set(d.file_name, d);
  return Array.from(byName.values());
}

/** Construit une entrée doc « coordinateur » pour l'affichage optimiste. */
export function buildCoordinatorDoc(
  f: { file_name: string; file_size?: number | null; storage_path: string; field_label?: string },
  by: { id: string; name: string },
  atISO: string,
): CandidatureDoc {
  return {
    field_label: f.field_label || "Ajouté par le coordinateur",
    file_name: f.file_name,
    file_size: f.file_size ?? null,
    storage_path: f.storage_path,
    source: "coordinator",
    added_by_id: by.id,
    added_by_name: by.name,
    added_at: atISO,
  };
}
