// Champs « par défaut » du formulaire de candidature (refonte constructeur).
//
// Les 3 champs cœur (entreprise / contact / email) sont VERROUILLÉS : la base en a besoin
// (colonnes dédiées company_name / contact_name / contact_email), donc toujours présents et requis ;
// seul leur libellé est éditable. Téléphone / Pays / Secteur sont activables et requis/optionnels au choix.
//
// Pays et Secteur sont rendus en listes déroulantes CONTRÔLÉES (getSortedCountries / SECTORS) pour des
// stats propres (vocabulaire normalisé). Leurs valeurs sont stockées dans candidatures.form_data.

export type DefaultFieldKey =
  | "company_name"
  | "contact_name"
  | "contact_email"
  | "contact_phone"
  | "pays"
  | "secteur";

export type DefaultFieldControl = "text" | "email" | "tel" | "country" | "sector";

export interface DefaultFieldConfig {
  key: DefaultFieldKey;
  label: string;
  enabled: boolean;
  required: boolean;
  locked: boolean; // cœur : toujours présent + requis, non désactivable
  control: DefaultFieldControl;
  /** Clé i18n du libellé canonique — utilisée pour l'affichage multilingue tant qu'il n'y a pas d'override. */
  labelKey: string;
  /** true quand un libellé a été personnalisé par le programme (override en base). */
  labelIsOverride?: boolean;
}

export const DEFAULT_FIELDS: DefaultFieldConfig[] = [
  { key: "company_name", label: "Nom de l'entreprise", labelKey: "candidature.public_company_name", enabled: true, required: true, locked: true, control: "text" },
  { key: "contact_name", label: "Nom du contact", labelKey: "candidature.public_contact_name", enabled: true, required: true, locked: true, control: "text" },
  { key: "contact_email", label: "Email", labelKey: "candidature.public_email", enabled: true, required: true, locked: true, control: "email" },
  { key: "contact_phone", label: "Téléphone", labelKey: "candidature.public_phone", enabled: true, required: false, locked: false, control: "tel" },
  { key: "pays", label: "Pays", labelKey: "candidature.public_country", enabled: true, required: true, locked: false, control: "country" },
  { key: "secteur", label: "Secteur d'activité", labelKey: "candidature.public_sector", enabled: true, required: true, locked: false, control: "sector" },
];

/**
 * Fusionne la config stockée (programmes.default_fields, partielle, par clé) avec le canon :
 * - repli sur les valeurs canoniques si rien de stocké (zéro régression sur les programmes existants) ;
 * - applique les overrides label/enabled/required des champs non verrouillés ;
 * - INVARIANT : un champ locked reste toujours enabled + required quoi qu'il y ait en base ;
 * - ignore les clés inconnues et préserve l'ordre canonique.
 */
export function mergeDefaultFields(stored: unknown): DefaultFieldConfig[] {
  const byKey = new Map<string, Record<string, unknown>>();
  if (Array.isArray(stored)) {
    for (const s of stored) {
      if (s && typeof s === "object" && typeof (s as any).key === "string") {
        byKey.set((s as any).key, s as Record<string, unknown>);
      }
    }
  }
  return DEFAULT_FIELDS.map((def) => {
    const s = byKey.get(def.key) || {};
    const rawLabel = typeof s.label === "string" ? s.label.trim() : "";
    // « Override » = libellé RÉELLEMENT personnalisé (différent du canon). Un
    // libellé stocké égal au canon n'est PAS un override → il passe par i18n
    // (t(labelKey)) et suit la langue. Cette définition doit rester alignée avec
    // celle du save (ProgrammeFormPage) qui ne traduit que ce qui diffère du canon,
    // sinon le garde-fou anti-mélange exigerait des traductions jamais générées.
    const hasOverride = rawLabel.length > 0 && rawLabel !== def.label;
    const label = rawLabel.length > 0 ? rawLabel : def.label;
    if (def.locked) {
      return { ...def, label, labelIsOverride: hasOverride, enabled: true, required: true };
    }
    return {
      ...def,
      label,
      labelIsOverride: hasOverride,
      enabled: typeof s.enabled === "boolean" ? s.enabled : def.enabled,
      required: typeof s.required === "boolean" ? s.required : def.required,
    };
  });
}
