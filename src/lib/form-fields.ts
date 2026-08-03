/**
 * Helpers purs pour les champs personnalisés du formulaire de candidature.
 * Isolés de la page (testables sans monter React / le client Supabase).
 */

export interface FreeTextField {
  options?: string[];
  freeTextOptions?: Record<string, string>;
}

/**
 * Nettoie `freeTextOptions` : ne garde que les clés qui correspondent encore à une
 * option existante (après trim). Retourne `undefined` s'il ne reste rien — pour ne pas
 * persister un objet vide dans `form_fields`.
 */
/**
 * Réordonne une liste d'éléments identifiés par `id` : déplace `activeId` à la
 * position de `overId` (glisser-déposer). No-op si identiques ou introuvables.
 * Préserve les objets (les propriétés — options, freeTextOptions… — restent attachées).
 */
export function reorderById<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  if (activeId === overId) return items;
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function cleanFreeTextOptions(f: FreeTextField): Record<string, string> | undefined {
  const ft = f.freeTextOptions;
  if (!ft) return undefined;
  const opts = new Set((f.options || []).map((o) => o.trim()).filter(Boolean));
  const kept = Object.fromEntries(Object.entries(ft).filter(([k]) => opts.has(k.trim())));
  return Object.keys(kept).length ? kept : undefined;
}
