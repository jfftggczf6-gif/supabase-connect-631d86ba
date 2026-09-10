// Référentiel de libellés du diagnostic (table public.diagnostic_labels).
//
// Deux usages, une seule source :
//   - `label(key)`      → libellé d'interface (titres, noms de champs)
//   - `enumLabel(cat,v)` → habillage d'une valeur d'énumération STOCKÉE EN FRANÇAIS
//
// ⚠️ RÈGLE : ce module ne sert QU'À L'AFFICHAGE. Les comparaisons de code
// continuent de porter sur les chaînes françaises stockées dans screening_data,
// via `normalizeEnum` ci-dessous. Traduire avant de comparer casserait toute la
// logique de couleur et de seuil.

export type Locale = 'fr' | 'en';

export interface DiagnosticLabelRow {
  key: string;
  category: string;
  fr: string;
  en: string;
  match_fr: string | null;
}

/**
 * Normalise une valeur d'énumération pour comparaison : minuscules, sans accent,
 * espaces de bord retirés, espaces internes réduits.
 *
 * Existe parce que le front comparait des chaînes françaises produites par le
 * modèle par égalité stricte (`=== 'Élevée'`). Un accent manquant, une majuscule
 * différente ou une espace en trop faisait silencieusement perdre la couleur ou
 * le seuil — sans erreur, sans trace.
 */
export function normalizeEnum(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // dépose les diacritiques combinants
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Compare une valeur d'énumération stockée à une ou plusieurs valeurs françaises
 * attendues, en normalisant les deux côtés. Remplace les `===` fragiles.
 */
export function enumIs(value: unknown, ...expected: string[]): boolean {
  const v = normalizeEnum(value);
  if (!v) return false;
  return expected.some((e) => normalizeEnum(e) === v);
}

/** Vrai si la valeur normalisée contient le fragment attendu (normalisé aussi). */
export function enumIncludes(value: unknown, fragment: string): boolean {
  const v = normalizeEnum(value);
  if (!v) return false;
  return v.includes(normalizeEnum(fragment));
}


// ── Consultation ────────────────────────────────────────────────────────────

export class LabelReferentialUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LabelReferentialUnavailable';
  }
}

export interface LabelLookup {
  /** Nombre de libellés chargés. 0 = référentiel injoignable. */
  size: number;
  /** Libellé d'interface par clé. Repli : la clé elle-même, visible donc corrigeable. */
  label: (key: string) => string;
  /**
   * Habillage d'une valeur d'énumération stockée en français.
   * Repli : la valeur stockée telle quelle — jamais de vide, jamais de clé technique.
   */
  enumLabel: (category: string, storedValue: unknown) => string;
}

export function buildLookup(rows: DiagnosticLabelRow[], locale: Locale): LabelLookup {
  const byKey = new Map<string, DiagnosticLabelRow>();
  const byMatch = new Map<string, DiagnosticLabelRow>();
  for (const r of rows) {
    byKey.set(r.key, r);
    if (r.match_fr) byMatch.set(`${r.category}::${normalizeEnum(r.match_fr)}`, r);
  }
  const pick = (r: DiagnosticLabelRow) => (locale === 'en' ? r.en : r.fr);

  return {
    size: rows.length,
    label: (key) => {
      const row = byKey.get(key);
      if (row) return pick(row);
      // Pas de repli. Un libellé manquant doit se voir : la clé technique
      // apparaît, et `assertUsable()` refuse de rendre un document dans ce cas.
      // Un repli français silencieux protégeait le test, pas le lecteur — il
      // faisait sortir un PDF « anglais » entièrement en français.
      return key;
    },
    enumLabel: (category, storedValue) => {
      const raw = storedValue === null || storedValue === undefined ? '' : String(storedValue);
      if (!raw) return '';
      const row = byMatch.get(`${category}::${normalizeEnum(raw)}`);
      // Repli volontaire sur la valeur stockée : une énumération non référencée
      // reste lisible en français plutôt que de disparaître de l'écran.
      return row ? pick(row) : raw;
    },
  };
}
