// Charge le référentiel de libellés depuis les migrations SQL, pour les tests.
//
// Les tests ne doivent PAS s'appuyer sur un repli statique : c'était précisément
// le défaut corrigé — le repli protégeait le test pendant que le lecteur, lui,
// recevait un document faux. Un test qui rend un document doit donc fournir un
// contexte de rendu réel, tiré de la même source que la production.
//
// Lit TOUTES les migrations qui alimentent diagnostic_labels, pas seulement le
// seed initial. Sans quoi une migration de complément serait invisible au test :
// le référentiel de production porterait une clé que le garde-fou ignorerait,
// et le garde-fou échouerait sur un défaut déjà corrigé.

import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticLabelRow } from '@/lib/diagnostic-labels';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../supabase/migrations');

let cached: DiagnosticLabelRow[] | null = null;

/** Migrations contenant un insert dans diagnostic_labels, par ordre chronologique. */
function fichiersReferentiel(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f))
    .filter((p) => fs.readFileSync(p, 'utf-8').includes('insert into public.diagnostic_labels'));
}

const ENTETE_ENUM = 'insert into public.diagnostic_labels (key, category, fr, en, match_fr) values';
const ENTETE_UI   = 'insert into public.diagnostic_labels (key, category, fr, en) values';

function deSql(v: string): string {
  return v.replace(/''/g, "'");
}

/** Toutes les lignes des seeds : énumérations (5 colonnes) + libellés d'interface (4). */
export function seedLabelRows(): DiagnosticLabelRow[] {
  if (cached) return cached;

  // Clé → ligne : une migration de complément REMPLACE la ligne antérieure,
  // exactement comme le fait `on conflict (key) do update` en base.
  const parCle = new Map<string, DiagnosticLabelRow>();

  for (const fichier of fichiersReferentiel()) {
    const sql = fs.readFileSync(fichier, 'utf-8');

    // Bloc énumérations : (key, category, fr, en, match_fr)
    const apresEnum = sql.split(ENTETE_ENUM)[1] ?? '';
    const blocEnum = apresEnum.split(ENTETE_UI)[0] ?? '';
    const reEnum = /\('([^']+)',\s*'([^']+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)/g;
    let m: RegExpExecArray | null;
    while ((m = reEnum.exec(blocEnum)) !== null) {
      parCle.set(m[1], {
        key: m[1], category: m[2],
        fr: deSql(m[3]), en: deSql(m[4]), match_fr: deSql(m[5]),
      });
    }

    // Bloc interface : (key, category, fr, en) — category littéralement 'ui'.
    const blocUi = sql.split(ENTETE_UI)[1] ?? '';
    const reUi = /\('([^']+)',\s*'ui',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)/g;
    while ((m = reUi.exec(blocUi)) !== null) {
      parCle.set(m[1], {
        key: m[1], category: 'ui',
        fr: deSql(m[2]), en: deSql(m[3]), match_fr: null,
      });
    }
  }

  cached = [...parCle.values()];
  return cached;
}

/** Valeurs françaises du référentiel — sert au détecteur de littéraux en dur. */
export function seedFrenchValues(): Set<string> {
  return new Set(seedLabelRows().map((r) => r.fr));
}

/** Libellé anglais d'une clé d'interface — pour les assertions du garde-fou. */
export function labelEn(key: string): string {
  const row = seedLabelRows().find((r) => r.key === key);
  if (!row) throw new Error(`clé absente du référentiel : ${key}`);
  return row.en;
}
