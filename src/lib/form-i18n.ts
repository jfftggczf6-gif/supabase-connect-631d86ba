// Résolution bilingue du formulaire de candidature (toggle FR<->EN, zéro mélange).
//
// La langue de RÉDACTION (form_base_lang) vit dans les colonnes de base du
// programme : form_presentation, form_fields[].label/options, et les overrides
// default_fields[].label. Les traductions vers les autres langues vivent dans
// programmes.form_translations, indexées par code langue.
//
// Ces résolveurs sont PURS (aucun effet de bord, aucune dépendance React) : ils
// sont donc testables isolément, et utilisés à l'identique par le rendu public
// et par l'aperçu d'édition. Repli systématique sur la langue de base -> tant
// qu'aucune traduction n'existe, le comportement est celui d'aujourd'hui.

export interface FormFieldTranslation {
  label?: string;
  options?: Record<string, string>; // clé = valeur d'option (langue de base) -> libellé traduit
}

export interface FormLangTranslations {
  presentation?: string;
  default_fields?: Record<string, string>; // clé = DefaultFieldKey -> libellé traduit (overrides uniquement)
  form_fields?: Record<string, FormFieldTranslation>; // clé = field.id
}

export type FormTranslations = Record<string, FormLangTranslations>;

export interface TranslatableField {
  id: string;
  label: string;
  type?: string;
  options?: string[];
}

const norm = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');
const baseOf = (lang: string | null | undefined): string => (lang || 'fr').slice(0, 2);

/** Libellé d'une question personnalisée dans la langue d'affichage (repli = base). */
export function resolveFieldLabel(
  field: TranslatableField,
  lang: string,
  baseLang: string,
  tr?: FormTranslations | null,
): string {
  if (baseOf(lang) === baseOf(baseLang)) return field.label;
  return norm(tr?.[baseOf(lang)]?.form_fields?.[field.id]?.label) || field.label;
}

/** Libellé affiché d'une option (la valeur stockée reste la valeur de base, stable). */
export function resolveOptionLabel(
  field: TranslatableField,
  optionValue: string,
  lang: string,
  baseLang: string,
  tr?: FormTranslations | null,
): string {
  if (baseOf(lang) === baseOf(baseLang)) return optionValue;
  return norm(tr?.[baseOf(lang)]?.form_fields?.[field.id]?.options?.[optionValue]) || optionValue;
}

/** Présentation Markdown dans la langue d'affichage (repli = base). */
export function resolvePresentation(
  basePresentation: string | null | undefined,
  lang: string,
  baseLang: string,
  tr?: FormTranslations | null,
): string {
  const base = basePresentation || '';
  if (baseOf(lang) === baseOf(baseLang)) return base;
  return norm(tr?.[baseOf(lang)]?.presentation) || base;
}

/**
 * Libellé traduit d'un OVERRIDE de champ par défaut (ex. programme ayant renommé
 * « Secteur d'activité »). Sans override, le libellé canon passe par i18n (t()),
 * pas par ici. Renvoie undefined s'il n'y a pas d'override à traduire.
 */
export function resolveDefaultFieldOverride(
  key: string,
  baseOverride: string | undefined,
  lang: string,
  baseLang: string,
  tr?: FormTranslations | null,
): string | undefined {
  if (!norm(baseOverride)) return undefined;
  if (baseOf(lang) === baseOf(baseLang)) return baseOverride;
  return norm(tr?.[baseOf(lang)]?.default_fields?.[key]) || baseOverride;
}

/** Éléments de base à traduire, pour le calcul de complétude (garde-fou). */
export interface TranslatableSurface {
  presentation?: string | null;
  fields: TranslatableField[];
  /** overrides de libellés par défaut présents dans la langue de base : { key: label } */
  defaultOverrides?: Record<string, string>;
}

export interface LangCompleteness {
  complete: boolean;
  missing: string[]; // descriptions lisibles des éléments non traduits
}

/**
 * Garde-fou anti-mélange : une langue n'est « complète » que si CHAQUE élément
 * de base non vide possède une traduction non vide. Une langue incomplète ne
 * doit pas être proposée au toggle côté candidat (sinon on afficherait un
 * formulaire à moitié traduit).
 */
export function computeLangCompleteness(
  surface: TranslatableSurface,
  lang: string,
  baseLang: string,
  tr?: FormTranslations | null,
): LangCompleteness {
  const L = baseOf(lang);
  if (L === baseOf(baseLang)) return { complete: true, missing: [] };
  const t = tr?.[L] || {};
  const missing: string[] = [];

  if (norm(surface.presentation) && !norm(t.presentation)) missing.push('présentation');

  for (const f of surface.fields) {
    if (norm(f.label) && !norm(t.form_fields?.[f.id]?.label)) {
      missing.push(`question « ${f.label} »`);
    }
    for (const o of f.options || []) {
      if (norm(o) && !norm(t.form_fields?.[f.id]?.options?.[o])) {
        missing.push(`option « ${o} »`);
      }
    }
  }

  for (const [key, label] of Object.entries(surface.defaultOverrides || {})) {
    if (norm(label) && !norm(t.default_fields?.[key])) {
      missing.push(`libellé « ${label} »`);
    }
  }

  return { complete: missing.length === 0, missing };
}
