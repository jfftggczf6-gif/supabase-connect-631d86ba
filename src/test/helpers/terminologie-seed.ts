// Lit le bloc de terminologie contraignante depuis la migration RENDER_DIAGNOSTIC v3.
//
// Une seule source. Le vocabulaire verrouillé est écrit UNE fois — dans le corps
// du prompt, c'est-à-dire à l'endroit qui agit — et lu ici par les tests. Le
// recopier dans un fichier de test créerait une deuxième vérité sur le sujet même
// où l'on cherche à en garantir une seule, et rien ne garantirait qu'elles ne
// divergent pas.

import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations');

/**
 * La migration de la DERNIÈRE version de RENDER_DIAGNOSTIC, par ordre
 * chronologique de nom de fichier. Règle plutôt que chemin en dur : une
 * nouvelle version du prompt ne doit pas demander de penser à éditer ce
 * fichier — sinon les tests continueraient de valider la version précédente
 * pendant que la base en sert une autre.
 */
function derniereMigrationPrompt(): string {
  const fichiers = fs.readdirSync(MIGRATIONS)
    .filter((f) => /render_diagnostic_v\d+\.sql$/.test(f))
    .sort();
  if (fichiers.length === 0) throw new Error('aucune migration RENDER_DIAGNOSTIC trouvée');
  return path.join(MIGRATIONS, fichiers[fichiers.length - 1]);
}

let cache: Record<string, string> | null = null;

/** Table « terme français → traduction fixe » du bloc de terminologie. */
export function vocabulaireVerrouille(): Record<string, string> {
  if (cache) return cache;
  const sql = fs.readFileSync(derniereMigrationPrompt(), 'utf-8');

  // Le bloc A seulement : le glossaire juridique (bloc B) n'est pas une table
  // de correspondance terme à terme et n'a pas à être comparé au référentiel.
  const debut = sql.indexOf('── A. VOCABULAIRE');
  const fin = sql.indexOf('── B. GLOSSAIRE');
  if (debut < 0 || fin < 0 || fin < debut) {
    throw new Error('bloc de terminologie A introuvable dans la dernière migration de prompt');
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
  const sql = fs.readFileSync(derniereMigrationPrompt(), 'utf-8');
  const m = sql.match(/\$SYS\$([\s\S]*?)\$SYS\$/);
  if (!m) throw new Error('corps system_prompt introuvable dans la dernière migration de prompt');
  return m[1];
}

/**
 * Table « abréviation française → équivalent anglais » du bloc C.
 * Lue dans le prompt, jamais recopiée : le registre du détecteur
 * (prose-controls.ts) et celui du prompt doivent dire la même chose, et c'est
 * une assertion qui le tient, pas une relecture.
 */
export function abreviationsProscritesDuPrompt(): Record<string, string> {
  const sql = fs.readFileSync(derniereMigrationPrompt(), 'utf-8');
  const debut = sql.indexOf('── C. ABRÉVIATIONS');
  if (debut < 0) throw new Error('bloc C (abréviations proscrites) introuvable');

  const table: Record<string, string> = {};
  const re = /«\s*([A-Z]{2,6})\s*»[^«]*?→\s*«\s*([^»]+?)\s*»/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql.slice(debut))) !== null) table[m[1]] = m[2];
  return table;
}

/** La version de prompt que les tests valident, lue dans le nom du fichier. */
export function versionPrompt(): number {
  const f = path.basename(derniereMigrationPrompt());
  return Number(f.match(/_v(\d+)\.sql$/)![1]);
}
