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


/**
 * Repli statique des libellés d'INTERFACE.
 *
 * Le référentiel en base est la source ; ceci garantit qu'un écran ou un extract
 * ne dégrade jamais vers une clé technique (« doc.extract_titre ») si la table
 * est injoignable — RLS, réseau, ou appel direct au builder en test.
 *
 * ⚠️ MIROIR de la migration 20260910180000_diagnostic_labels.sql (category='ui').
 * Le test diagnostic-locale-invariants compare les deux et échoue en cas de dérive.
 */
export const DEFAULT_UI_LABELS: Record<string, { fr: string; en: string }> = {
  'doc.reporting_titre': { fr: 'Reporting de candidatures', en: 'Application report' },
  'doc.extract_titre': { fr: 'Extract candidature', en: 'Application extract' },
  'doc.candidature': { fr: 'Candidature', en: 'Application' },
  'doc.programme': { fr: 'Programme', en: 'Programme' },
  'section.fiche': { fr: 'Fiche entreprise', en: 'Company profile' },
  'section.dimensions': { fr: 'Dimensions diagnostiques', en: 'Diagnostic dimensions' },
  'section.indicateurs': { fr: 'Indicateurs financiers', en: 'Financial indicators' },
  'section.marche': { fr: 'Marché & positionnement', en: 'Market & positioning' },
  'section.equipe': { fr: 'Équipe & gouvernance', en: 'Team & governance' },
  'section.impact': { fr: 'Impact mesurable', en: 'Measurable impact' },
  'section.besoin': { fr: 'Besoin de financement', en: 'Funding need' },
  'section.risques': { fr: 'Risques programme', en: 'Programme risks' },
  'section.traction': { fr: 'Traction & preuves', en: 'Traction & evidence' },
  'section.benchmark': { fr: 'Benchmark sectoriel', en: 'Sector benchmark' },
  'section.matching': { fr: 'Matching critères programme', en: 'Programme criteria match' },
  'section.points_forts': { fr: 'Points forts', en: 'Strengths' },
  'section.vigilance': { fr: 'Points de vigilance', en: 'Points of attention' },
  'section.incoherences': { fr: 'Incohérences détectées', en: 'Detected inconsistencies' },
  'section.synthese': { fr: 'Synthèse', en: 'Summary' },
  'section.resume_comite': { fr: 'Résumé pour le comité', en: 'Committee summary' },
  'champ.nom': { fr: 'Nom', en: 'Name' },
  'champ.pays': { fr: 'Pays', en: 'Country' },
  'champ.contact': { fr: 'Contact', en: 'Contact' },
  'champ.email': { fr: 'Email', en: 'Email' },
  'champ.tel': { fr: 'Tél', en: 'Phone' },
  'champ.anciennete': { fr: 'Ancienneté', en: 'Age' },
  'champ.effectif': { fr: 'Effectif', en: 'Headcount' },
  'champ.employes': { fr: 'Employés', en: 'Employees' },
  'champ.taille': { fr: 'Taille', en: 'Size' },
  'champ.ca_annuel': { fr: 'CA annuel', en: 'Annual revenue' },
  'champ.croissance': { fr: 'Croissance', en: 'Growth' },
  'champ.marge': { fr: 'Marge', en: 'Margin' },
  'champ.rentabilite': { fr: 'Rentabilité', en: 'Profitability' },
  'champ.tresorerie': { fr: 'Trésorerie', en: 'Cash position' },
  'champ.endettement': { fr: 'Endettement', en: 'Leverage' },
  'champ.marche': { fr: 'Marché', en: 'Market' },
  'champ.positionnement': { fr: 'Positionnement', en: 'Positioning' },
  'champ.concurrence': { fr: 'Concurrence', en: 'Competition' },
  'champ.avantage': { fr: 'Avantage', en: 'Advantage' },
  'champ.equipe': { fr: 'Équipe', en: 'Team' },
  'champ.dirigeant': { fr: 'Dirigeant', en: 'Founder / CEO' },
  'champ.key_man_risk': { fr: 'Key-man risk', en: 'Key-man risk' },
  'champ.emplois_actuels': { fr: 'Emplois actuels', en: 'Current jobs' },
  'champ.femmes': { fr: 'Femmes', en: 'Women' },
  'champ.jeunes': { fr: 'Jeunes', en: 'Youth' },
  'champ.beneficiaires': { fr: 'Bénéficiaires', en: 'Beneficiaries' },
  'champ.absorption': { fr: 'Absorption', en: 'Absorption capacity' },
  'champ.type_adapte': { fr: 'Type adapté', en: 'Suitable instrument' },
  'champ.vs_ca': { fr: 'vs CA', en: 'vs revenue' },
  'champ.evolution_ca': { fr: 'Évolution CA', en: 'Revenue trend' },
  'champ.projection': { fr: 'Projection', en: 'Projection' },
  'champ.preuves': { fr: 'Preuves', en: 'Evidence' },
  'champ.score_ia': { fr: 'Score IA', en: 'AI score' },
  'champ.documents': { fr: 'Documents', en: 'Documents' },
  'matching.valides': { fr: 'Validés', en: 'Met' },
  'matching.partiels': { fr: 'Partiels', en: 'Partially met' },
  'matching.non_remplis': { fr: 'Non remplis', en: 'Not met' },
  'etat.non_renseigne': { fr: 'Non renseigné', en: 'Not provided' },
  'etat.donnees_decl': { fr: 'Données déclaratives', en: 'Self-reported data' },
  'etat.aucun_diagnostic': { fr: 'Diagnostic à générer', en: 'Diagnostic to be generated' },
};

// ── Consultation ────────────────────────────────────────────────────────────

export interface LabelLookup {
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
    label: (key) => {
      const row = byKey.get(key);
      if (row) return pick(row);
      const fallback = DEFAULT_UI_LABELS[key];
      if (fallback) return locale === 'en' ? fallback.en : fallback.fr;
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
