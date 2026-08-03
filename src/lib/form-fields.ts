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
export function cleanFreeTextOptions(f: FreeTextField): Record<string, string> | undefined {
  const ft = f.freeTextOptions;
  if (!ft) return undefined;
  const opts = new Set((f.options || []).map((o) => o.trim()).filter(Boolean));
  const kept = Object.fromEntries(Object.entries(ft).filter(([k]) => opts.has(k.trim())));
  return Object.keys(kept).length ? kept : undefined;
}
