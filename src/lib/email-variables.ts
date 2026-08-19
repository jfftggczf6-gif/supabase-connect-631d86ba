// Variables de personnalisation des e-mails candidats (brief 1).
//
// Jeu volontairement restreint aux données FIABLES du modèle (cartographie du
// 19/08/2026) : la civilité est absente du schéma, et contact_name est un champ
// libre contenant des titres, des numéros de téléphone et des capitales — donc
// pas de {{prenom}}/{{nom}} dérivés. On n'offre que ce qui se résout proprement.
// La qualité de {{contact}} est contrôlée automatiquement (inspectContact).

export interface VariableDef {
  key: string;
  label: string;
  description: string;
}

/** Palette proposée dans le composeur. Ordre = ordre d'affichage. */
export const EMAIL_VARIABLES: VariableDef[] = [
  { key: 'contact',    label: 'Contact',    description: 'Nom du contact, tel que saisi' },
  { key: 'entreprise', label: 'Entreprise', description: "Nom de l'entreprise" },
  { key: 'programme',  label: 'Programme',  description: 'Nom du programme' },
  { key: 'pays',       label: 'Pays',       description: 'Pays (réponse au formulaire)' },
];

const KNOWN_KEYS = new Set(EMAIL_VARIABLES.map((v) => v.key));

/** Données d'une candidature nécessaires à la résolution des variables. */
export interface RecipientSource {
  contact_name?: string | null;
  company_name?: string | null;
  programme_name?: string | null;
  pays?: string | null;
}

export type ResolvedVariables = Record<string, string>;

export function resolveRecipientVariables(r: RecipientSource): ResolvedVariables {
  return {
    contact: (r.contact_name ?? '').trim(),
    entreprise: (r.company_name ?? '').trim(),
    programme: (r.programme_name ?? '').trim(),
    pays: (r.pays ?? '').trim(),
  };
}

// {{ cle }} — tolère les espaces internes, insensible à la casse.
const VAR_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/** Variables CONNUES effectivement utilisées dans le template. */
export function extractUsedVariables(template: string): string[] {
  const used = new Set<string>();
  for (const m of (template || '').matchAll(VAR_RE)) {
    const key = m[1].toLowerCase();
    if (KNOWN_KEYS.has(key)) used.add(key);
  }
  return [...used];
}

/** Remplace chaque {{cle}} connue par sa valeur résolue. Les inconnues restent telles quelles. */
export function applyVariables(template: string, resolved: ResolvedVariables): string {
  return (template || '').replace(VAR_RE, (whole, k) => {
    const key = String(k).toLowerCase();
    return KNOWN_KEYS.has(key) ? (resolved[key] ?? '') : whole;
  });
}

/** Variables UTILISÉES dont la valeur résolue est vide (critère 7). */
export function findEmptyVariables(template: string, resolved: ResolvedVariables): string[] {
  return extractUsedVariables(template).filter((k) => !(resolved[k] ?? '').trim());
}

// ── Contrôle automatique de {{contact}} (règles brief 1) ────────────────────
// contact_name est un champ libre : on signale AVANT envoi les valeurs douteuses
// plutôt que de compter sur l'inspection manuelle des aperçus un par un.
const CIVILITE_ROOTS = new Set([
  'mme', 'mlle', 'm', 'mr', 'monsieur', 'madame', 'mademoiselle', 'dr', 'pr', 'docteur', 'professeur',
]);

export interface ContactInspection {
  suspect: boolean;
  raisons: string[];          // libellés lisibles pour l'UI
  valeurNettoyee?: string;    // proposition quand une civilité est en tête
}

/**
 * Inspecte une valeur de contact. Suspecte si elle :
 *  - contient un chiffre (numéros de téléphone dans le champ nom),
 *  - est un token unique de moins de 3 caractères,
 *  - commence par une civilité reconnue → propose la valeur nettoyée (sans rejet).
 */
export function inspectContact(value: string | null | undefined): ContactInspection {
  const v = (value ?? '').trim();
  if (!v) return { suspect: true, raisons: ['valeur vide'] };

  const raisons: string[] = [];
  let valeurNettoyee: string | undefined;

  if (/\d/.test(v)) raisons.push('contient un chiffre');

  const tokens = v.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && v.length < 3) raisons.push('trop court');

  const firstNorm = (tokens[0] || '').toLowerCase().replace(/[.,]+$/, '');
  if (tokens.length > 1 && CIVILITE_ROOTS.has(firstNorm)) {
    raisons.push('commence par une civilité');
    valeurNettoyee = tokens.slice(1).join(' ');
  }

  return { suspect: raisons.length > 0, raisons, valeurNettoyee };
}
