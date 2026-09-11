// Charge le référentiel de libellés depuis le seed SQL, pour les tests.
//
// Les tests ne doivent PAS s'appuyer sur un repli statique : c'était précisément
// le défaut corrigé — le repli protégeait le test pendant que le lecteur, lui,
// recevait un document faux. Un test qui rend un document doit donc fournir un
// contexte de rendu réel, tiré de la même source que la production.

import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticLabelRow } from '@/lib/diagnostic-labels';

const MIGRATION = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260910180000_diagnostic_labels.sql',
);

let cached: DiagnosticLabelRow[] | null = null;

/** Toutes les lignes du seed : énumérations (5 colonnes) + libellés d'interface (4). */
export function seedLabelRows(): DiagnosticLabelRow[] {
  if (cached) return cached;
  const sql = fs.readFileSync(MIGRATION, 'utf-8');
  const rows: DiagnosticLabelRow[] = [];

  // Bloc énumérations : (key, category, fr, en, match_fr)
  const enumBlock = sql.split(
    'insert into public.diagnostic_labels (key, category, fr, en, match_fr) values',
  )[1]?.split('insert into public.diagnostic_labels (key, category, fr, en) values')[0] ?? '';
  const enumRe = /\('([^']+)',\s*'([^']+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)/g;
  let m: RegExpExecArray | null;
  while ((m = enumRe.exec(enumBlock)) !== null) {
    rows.push({
      key: m[1], category: m[2],
      fr: m[3].replace(/''/g, "'"), en: m[4].replace(/''/g, "'"),
      match_fr: m[5].replace(/''/g, "'"),
    });
  }

  // Bloc interface : (key, category, fr, en)
  const uiBlock = sql.split(
    'insert into public.diagnostic_labels (key, category, fr, en) values',
  )[1] ?? '';
  const uiRe = /\('([^']+)',\s*'ui',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)/g;
  while ((m = uiRe.exec(uiBlock)) !== null) {
    rows.push({
      key: m[1], category: 'ui',
      fr: m[2].replace(/''/g, "'"), en: m[3].replace(/''/g, "'"),
      match_fr: null,
    });
  }

  cached = rows;
  return rows;
}

/** Valeurs françaises du référentiel — sert au détecteur de littéraux en dur. */
export function seedFrenchValues(): Set<string> {
  return new Set(seedLabelRows().map((r) => r.fr));
}
