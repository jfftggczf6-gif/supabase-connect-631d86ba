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
}

export const DEFAULT_FIELDS: DefaultFieldConfig[] = [
  { key: "company_name", label: "Nom de l'entreprise", enabled: true, required: true, locked: true, control: "text" },
  { key: "contact_name", label: "Nom du contact", enabled: true, required: true, locked: true, control: "text" },
  { key: "contact_email", label: "Email", enabled: true, required: true, locked: true, control: "email" },
  { key: "contact_phone", label: "Téléphone", enabled: true, required: false, locked: false, control: "tel" },
  { key: "pays", label: "Pays", enabled: true, required: true, locked: false, control: "country" },
  { key: "secteur", label: "Secteur d'activité", enabled: true, required: true, locked: false, control: "sector" },
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
    const label = typeof s.label === "string" && s.label.trim() ? s.label : def.label;
    if (def.locked) {
      return { ...def, label, enabled: true, required: true };
    }
    return {
      ...def,
      label,
      enabled: typeof s.enabled === "boolean" ? s.enabled : def.enabled,
      required: typeof s.required === "boolean" ? s.required : def.required,
    };
  });
}
