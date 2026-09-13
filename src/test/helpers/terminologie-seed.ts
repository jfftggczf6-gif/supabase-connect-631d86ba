// Lit le bloc de terminologie contraignante depuis la migration RENDER_DIAGNOSTIC v3.
//
// Une seule source. Le vocabulaire verrouillé est écrit UNE fois — dans le corps
// du prompt, c'est-à-dire à l'endroit qui agit — et lu ici par les tests. Le
// recopier dans un fichier de test créerait une deuxième vérité sur le sujet même
// où l'on cherche à en garantir une seule, et rien ne garantirait qu'elles ne
// divergent pas.

import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260913120000_render_diagnostic_v3.sql',
);

let cache: Record<string, string> | null = null;

/** Table « terme français → traduction fixe » du bloc de terminologie. */
export function vocabulaireVerrouille(): Record<string, string> {
  if (cache) return cache;
  const sql = fs.readFileSync(MIGRATION, 'utf-8');

  // Le bloc A seulement : le glossaire juridique (bloc B) n'est pas une table
  // de correspondance terme à terme et n'a pas à être comparé au référentiel.
  const debut = sql.indexOf('── A. VOCABULAIRE');
  const fin = sql.indexOf('── B. GLOSSAIRE');
  if (debut < 0 || fin < 0 || fin < debut) {
    throw new Error('bloc de terminologie A introuvable dans la migration v3');
  }

  const table: Record<string, string> = {};
  const re = /«\s*([^»]+?)\s*»\s*→\s*«\s*([^»]+?)\s*»/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql.slice(debut, fin))) !== null) table[m[1]] = m[2];

  if (Object.keys(table).length === 0) {
    throw new Error('aucune correspondance lue dans le bloc de terminologie');
  }
  cache = table;
  return table;
}

/** Corps du prompt v3, pour les assertions qui portent sur le texte lui-même. */
export function systemPromptV3(): string {
  const sql = fs.readFileSync(MIGRATION, 'utf-8');
  const m = sql.match(/\$SYS\$([\s\S]*?)\$SYS\$/);
  if (!m) throw new Error('corps system_prompt introuvable dans la migration v3');
  return m[1];
}
