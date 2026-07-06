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

// ─────────────────────────────────────────────────────────────────────────────
// Traduction automatique au save : découpe le contenu de base en segments
// courts (une ligne chacun, compatible avec le format à marqueurs de
// translate-content), puis reconstruit un objet FormLangTranslations à partir de
// la réponse. Fonctions PURES → la partie fragile (le round-trip) est testée.
// La présentation Markdown est découpée LIGNE par LIGNE (les lignes vides sont
// préservées telles quelles, non traduites) pour rester dans le contrat
// « un segment par ligne ».
// ─────────────────────────────────────────────────────────────────────────────

export type SegmentDescriptor =
  | { kind: 'presentation'; line: number }
  | { kind: 'field_label'; id: string }
  | { kind: 'field_option'; id: string; value: string }
  | { kind: 'default_label'; key: string };

export interface TranslationSegment {
  descriptor: SegmentDescriptor;
  text: string;
}

/** Découpe la surface de base en segments traduisibles (texte non vide uniquement). */
export function collectTranslatableSegments(surface: TranslatableSurface): TranslationSegment[] {
  const segments: TranslationSegment[] = [];

  const presLines = (surface.presentation || '').split('\n');
  presLines.forEach((line, i) => {
    if (norm(line)) segments.push({ descriptor: { kind: 'presentation', line: i }, text: line });
  });

  for (const f of surface.fields) {
    if (norm(f.label)) segments.push({ descriptor: { kind: 'field_label', id: f.id }, text: f.label });
    for (const o of f.options || []) {
      if (norm(o)) segments.push({ descriptor: { kind: 'field_option', id: f.id, value: o }, text: o });
    }
  }

  for (const [key, label] of Object.entries(surface.defaultOverrides || {})) {
    if (norm(label)) segments.push({ descriptor: { kind: 'default_label', key }, text: label });
  }

  return segments;
}

/** Construit le prompt à marqueurs attendu par translate-content : « [0] …\n[1] … ». */
export function buildMarkedPrompt(segments: TranslationSegment[]): string {
  return segments.map((s, i) => `[${i}] ${s.text}`).join('\n');
}

/**
 * Reconstruit FormLangTranslations depuis la réponse marquée. `surface` sert à
 * réassembler la présentation (positions des lignes vides). Un segment sans
 * traduction récupérable est simplement omis (le rendu retombe alors sur la base).
 */
export function parseMarkedResponse(
  raw: string,
  segments: TranslationSegment[],
  surface: TranslatableSurface,
): FormLangTranslations {
  // Map index -> texte traduit
  const byIndex = new Map<number, string>();
  for (const rawLine of (raw || '').split('\n')) {
    const m = rawLine.match(/^\s*\[(\d+)\]\s?(.*)$/);
    if (m) byIndex.set(Number(m[1]), m[2]);
  }

  const out: FormLangTranslations = {};
  const presByLine = new Map<number, string>();

  segments.forEach((seg, i) => {
    const translated = byIndex.get(i);
    if (translated === undefined || !norm(translated)) return;
    const d = seg.descriptor;
    switch (d.kind) {
      case 'presentation':
        presByLine.set(d.line, translated);
        break;
      case 'field_label':
        (out.form_fields ||= {})[d.id] = { ...(out.form_fields?.[d.id] || {}), label: translated };
        break;
      case 'field_option': {
        const ff = (out.form_fields ||= {});
        const entry = (ff[d.id] ||= {});
        (entry.options ||= {})[d.value] = translated;
        break;
      }
      case 'default_label':
        (out.default_fields ||= {})[d.key] = translated;
        break;
    }
  });

  // Réassemble la présentation : ligne traduite si dispo, sinon ligne d'origine
  // (préserve les lignes vides et la structure Markdown).
  if (presByLine.size > 0) {
    const original = (surface.presentation || '').split('\n');
    out.presentation = original.map((line, i) => presByLine.get(i) ?? line).join('\n');
  }

  return out;
}
