// @ts-nocheck
/**
 * ESONO — OVO Financial Plan Excel Mapping
 * =========================================
 * Source: 251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm
 * Analysé cellule par cellule via openpyxl.
 *
 * RÈGLES CRITIQUES pour la Supabase Edge Function :
 *  1. load_workbook(path, keep_vba=True)   ← OBLIGATOIRE pour préserver les macros VBA
 *  2. Ne JAMAIS ouvrir avec data_only=True puis sauvegarder → détruit toutes les formules
 *  3. Écrire uniquement des valeurs brutes (nombres, strings, dates Python)
 *  4. Les colonnes "FORMULA" sont calculées automatiquement — NE PAS ÉCRIRE
 *  5. Librairie : openpyxl (Node: exceljs avec keepVba:true)
 */

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type YearLabel =
  | "YEAR-2"
  | "YEAR-1"
  | "CURRENT YEAR"
  | "YEAR2"
  | "YEAR3"
  | "YEAR4"
  | "YEAR5"
  | "YEAR6";

/** Les 10 colonnes année dans FinanceData */
export type YearColumn = "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X";

// ─────────────────────────────────────────────
// CONSTANTES DE STRUCTURE
// ─────────────────────────────────────────────

/**
 * Correspondance colonne lettre → numéro (openpyxl 1-indexé)
 * Utilisé pour ws.cell(row=N, column=COL_NUM["L"])
 */
export const COL_NUM: Record<string, number> = {
  B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10,
  K: 11, L: 12, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18,
  S: 19, T: 20, U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26,
  AA: 27, AB: 28, AC: 29, AD: 30, AE: 31, AF: 32, AG: 33, AH: 34,
  AI: 35, AJ: 36, AK: 37, AL: 38, AM: 39, AN: 40, AO: 41, AP: 42,
  AQ: 43, AR: 44, AS: 45,
};

/**
 * Mapping colonne Excel → période (FinanceData)
 * O = YEAR-2 (historique), P = YEAR-1 (historique)
 * Q = H1 année courante, R = H2 année courante, S = année courante totale
 * T→X = années de prévision YEAR2 à YEAR6
 */
export const FINANCE_YEAR_COLS: Record<YearColumn, YearLabel | string> = {
  O: "YEAR-2",
  P: "YEAR-1",
  Q: "CURRENT YEAR H1",
  R: "CURRENT YEAR H2",
  S: "CURRENT YEAR",
  T: "YEAR2",
  U: "YEAR3",
  V: "YEAR4",
  W: "YEAR5",
  X: "YEAR6",
};

// ─────────────────────────────────────────────
// FEUILLE : ReadMe
// ─────────────────────────────────────────────

export const README_MAPPING = {
  /** Langue d'affichage du rapport. Valeurs: "French" | "English" | "Dutch" */
  language: { sheet: "ReadMe", cell: "L3", type: "string", default: "French" },
} as const;

// ─────────────────────────────────────────────
// FEUILLE : InputsData
// Toutes les valeurs vont en colonne J sauf indication contraire.
// ─────────────────────────────────────────────

export const INPUTS_MAPPING = {

  // ── SECTION 1 : Pays & paramètres macroéconomiques (rows 5-21) ──────────

  company:        { cell: "J5",  type: "string",  label: "Nom légal complet de l'entreprise" },
  country:        { cell: "J6",  type: "string",  label: "Pays d'opération" },
  currency:       { cell: "J8",  type: "string",  label: "Code devise locale (ex: CFA, XOF, USD)" },
  exchange_rate:  { cell: "J9",  type: "number",  label: "Taux de change devise locale / EUR", default: 655.957 },
  conversion_date:{ cell: "J10", type: "date",    label: "Date du taux de change (datetime Python)" },
  vat_rate:       { cell: "J12", type: "number",  label: "TVA applicable (décimal: 0.18 = 18%)", default: 0.18 },
  inflation_rate: { cell: "J14", type: "number",  label: "Inflation annuelle (décimal)", default: 0.03 },
  /** Régime fiscal 1 — revenus ≤ 200M FCFA */
  tax_regime_1:   { cell: "J17", type: "number",  label: "IS régime 1 (décimal)", default: 0.04 },
  /** Régime fiscal 2 — revenus > 200M FCFA */
  tax_regime_2:   { cell: "J18", type: "number",  label: "IS régime 2 (décimal)", default: 0.30 },
  // J19, J20, J21 = régimes 3/4/5 — laisser vide si non applicable

  // ── SECTION 2 : Années de référence (rows 24-33) ────────────────────────
  // Col J = valeur de l'année (entier). Col I = "ACTUAL" ou "FORECAST" (déjà rempli en template).

  year_minus_2:       { cell: "J24", type: "integer", label: "YEAR-2 (2 ans avant l'année courante)" },
  year_minus_1:       { cell: "J25", type: "integer", label: "YEAR-1 (année précédente)" },
  current_year:       { cell: "J26", type: "integer", label: "Année courante" },
  current_year_h1:    { cell: "J27", type: "integer", label: "Année courante (même valeur, pour H1)" },
  current_year_h2:    { cell: "J28", type: "integer", label: "Année courante (même valeur, pour H2)" },
  year2:              { cell: "J29", type: "integer", label: "YEAR2 = current_year + 1" },
  year3:              { cell: "J30", type: "integer", label: "YEAR3 = current_year + 2" },
  year4:              { cell: "J31", type: "integer", label: "YEAR4 = current_year + 3" },
  year5:              { cell: "J32", type: "integer", label: "YEAR5 = current_year + 4" },
  year6:              { cell: "J33", type: "integer", label: "YEAR6 = current_year + 5" },

  // ── SECTION 3 : Produits (rows 36-55) ───────────────────────────────────
  // H = nom du produit | I = filtre actif (1) ou inactif (0) | J = description libre
  // K = info gamme+canal (auto-générée via la matrice rows 79-98, ne pas écrire manuellement)

  products: Array.from({ length: 20 }, (_, i) => ({
    slot: i + 1,
    row: 36 + i,
    col_name: "H",     // Nom du produit (string) — "-" si inactif
    col_filter: "I",   // 1 = actif, 0 = inactif (integer)
    col_description: "J", // Description libre (string)
  })),

  // ── SECTION 3 : Services (rows 58-67) ───────────────────────────────────

  services: Array.from({ length: 10 }, (_, i) => ({
    slot: i + 1,
    row: 58 + i,
    col_name: "H",
    col_filter: "I",
    col_description: "J",
  })),

  // ── SECTION 4 : Gammes (rows 70-72) & Canaux (rows 75-76) ───────────────
  // H = nom de la gamme/canal | J = description libre

  ranges: [
    { slot: 1, row: 70, default_name: "LOW END",    col_name: "H", col_desc: "J" },
    { slot: 2, row: 71, default_name: "MEDIUM END", col_name: "H", col_desc: "J" },
    { slot: 3, row: 72, default_name: "HIGH END",   col_name: "H", col_desc: "J" },
  ],
  channels: [
    { slot: 1, row: 75, default_name: "B2B", col_name: "H", col_desc: "J" },
    { slot: 2, row: 76, default_name: "B2C", col_name: "H", col_desc: "J" },
  ],

  /**
   * Matrice produits × gammes/canaux (rows 79-98 pour produits, 101-110 pour services)
   * F = Range1 flag | G = Range2 flag | H = Range3 flag
   * I = Channel1 flag | J = Channel2 flag
   * Valeurs: 1 (actif) ou 0 (inactif)
   * IMPORTANT: La somme des flags Range doit = 1 (un seul range primaire par produit)
   */
  product_matrix: Array.from({ length: 20 }, (_, i) => ({
    product_slot: i + 1,
    row: 79 + i,
    col_range1: "F", col_range2: "G", col_range3: "H",
    col_channel1: "I", col_channel2: "J",
  })),
  service_matrix: Array.from({ length: 10 }, (_, i) => ({
    service_slot: i + 1,
    row: 101 + i,
    col_range1: "F", col_range2: "G", col_range3: "H",
    col_channel1: "I", col_channel2: "J",
  })),

  // ── SECTION 5 : Staff (rows 113-122) ────────────────────────────────────
  // H = catégorie professionnelle | I = nom du département | J = taux cotisations sociales (décimal)

  staff_categories: [
    { id: "STAFF_CAT01", row: 113, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT02", row: 114, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT03", row: 115, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT04", row: 116, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT05", row: 117, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT06", row: 118, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT07", row: 119, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT08", row: 120, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT09", row: 121, col_category: "H", col_department: "I", col_social_security: "J" },
    { id: "STAFF_CAT10", row: 122, col_category: "H", col_department: "I", col_social_security: "J" },
  ],

  // ── SECTION 6 : Prêts (rows 125-127) ────────────────────────────────────
  // I = taux d'intérêt annuel (décimal) | J = durée de remboursement (années entier)

  loans: {
    ovo:           { row: 125, col_rate: "I", col_duration: "J", default_rate: 0.07, default_years: 5 },
    family_friends:{ row: 126, col_rate: "I", col_duration: "J", default_rate: 0.10, default_years: 3 },
    local_bank:    { row: 127, col_rate: "I", col_duration: "J", default_rate: 0.20, default_years: 2 },
  },

  // ── SECTION 7 : Scénarios de simulation (rows 130-142) ──────────────────
  // H = worst case | I = typical case | J = best case (multiplicateurs décimaux, 1.0 = 100%)

  simulation: [
    { id: "REVENUE_PRODUCTS",        row: 130, worst: 0.95, typical: 1.0, best: 1.20 },
    { id: "COGS_PRODUCTS",           row: 131, worst: 1.10, typical: 1.0, best: 0.95 },
    { id: "REVENUE_SERVICES",        row: 132, worst: 0.60, typical: 1.0, best: 1.20 },
    { id: "COGS_SERVICES",           row: 133, worst: 1.10, typical: 1.0, best: 0.95 },
    { id: "MARKETING_COST",          row: 134, worst: 1.25, typical: 1.0, best: 0.85 },
    { id: "STAFF_SALARIES",          row: 135, worst: 1.25, typical: 1.0, best: 0.85 },
    { id: "TAXES_DUTIES_ON_STAFF",   row: 136, worst: 1.25, typical: 1.0, best: 0.85 },
    { id: "OFFICE_COSTS",            row: 137, worst: 1.10, typical: 1.0, best: 0.90 },
    { id: "OTHER_EXPENSES",          row: 138, worst: 1.10, typical: 1.0, best: 0.90 },
    { id: "TRAVEL_TRANSPORTATION",   row: 139, worst: 1.10, typical: 1.0, best: 0.90 },
    { id: "INSURANCE",               row: 140, worst: 1.10, typical: 1.0, best: 0.90 },
    { id: "MAINTENANCE",             row: 141, worst: 1.10, typical: 1.0, best: 0.90 },
    { id: "THIRD_PARTIES",           row: 142, worst: 1.20, typical: 1.0, best: 0.85 },
  ],
} as const;

// ─────────────────────────────────────────────
// FEUILLE : RevenueData
// ─────────────────────────────────────────────

/**
 * STRUCTURE RÉELLE DE REVENUEDATA (vérifiée cellule par cellule)
 *
 * Chaque produit/service occupe un BLOC DE 42 LIGNES :
 *   - 1 ligne header (col B = "PRODUCT XX___")          → NE PAS ÉCRIRE
 *   - 8 lignes VOLUME (K="VOLUME", années YEAR-2→YEAR6) → ÉCRIRE cols L,M,N,P,Q,R,S,T,U,W,X,Y,Z,AA,AB,AE,AF,AG,AH
 *   - 8 lignes REVENUE (K="REVENUE")                    → FORMULE AUTOMATIQUE — NE PAS ÉCRIRE
 *   - 8 lignes AVG SELLING PRICE (K="AVERAGE SELLING PRICE PER UNIT") → FORMULE
 *   - 8 lignes COGS (K="COST OF GOODS SOLD")            → FORMULE
 *   - 8 lignes AVG COGS (K="AVERAGE COST OF GOODS SOLD PER UNIT")     → FORMULE
 *   - 1 ligne séparatrice vide
 *
 * Donc : seules les 8 lignes VOLUME par produit/service sont éditables.
 */

/** Ligne de départ du bloc header pour chaque produit (slot 1-20) */
export const REVENUE_PRODUCT_HEADER_ROW: Record<number, number> = {
   1:   8,  2:  50,  3:  92,  4: 134,  5: 176,
   6: 218,  7: 260,  8: 302,  9: 344, 10: 386,
  11: 428, 12: 470, 13: 512, 14: 554, 15: 596,
  16: 638, 17: 680, 18: 722, 19: 764, 20: 806,
};

/** Ligne de départ du bloc header pour chaque service (slot 1-10) */
export const REVENUE_SERVICE_HEADER_ROW: Record<number, number> = {
   1: 848,  2: 890,  3: 932,  4: 974,  5: 1016,
   6: 1058, 7: 1100, 8: 1142, 9: 1184, 10: 1226,
};

/**
 * Calcule la ligne VOLUME pour un produit/service et une année donnée.
 * Les 8 lignes VOLUME sont les 8 premières lignes de données (header_row + 1 à header_row + 8)
 */
export function getVolumeRow(headerRow: number, yearIndex: number): number {
  // yearIndex: 0=YEAR-2, 1=YEAR-1, 2=CURRENT YEAR, 3=YEAR2, 4=YEAR3, 5=YEAR4, 6=YEAR5, 7=YEAR6
  return headerRow + 1 + yearIndex;
}

export const YEAR_INDEX: Record<YearLabel, number> = {
  "YEAR-2":       0,
  "YEAR-1":       1,
  "CURRENT YEAR": 2,
  "YEAR2":        3,
  "YEAR3":        4,
  "YEAR4":        5,
  "YEAR5":        6,
  "YEAR6":        7,
};

/**
 * COLONNES ÉDITABLES dans les lignes VOLUME
 * (vérifiées sur ligne 9 du template — données réelles présentes)
 */
export const REVENUE_VOLUME_WRITABLE_COLS = {
  // Prix de vente unitaire par gamme
  unit_price_range1: "L",   // Prix vente unitaire Gamme 1 (montant devise locale)
  unit_price_range2: "M",   // Prix vente unitaire Gamme 2 (0 si non utilisé)
  unit_price_range3: "N",   // Prix vente unitaire Gamme 3 (0 si non utilisé)
  // O = prix moyen pondéré → FORMULE, ne pas écrire

  // Mix volume par gamme (décimaux, somme = 1.0)
  mix_range1_pct: "P",      // % volume Gamme 1 (ex: 1.0 = 100%)
  mix_range2_pct: "Q",      // % volume Gamme 2
  mix_range3_pct: "R",      // % volume Gamme 3

  // Coût unitaire (COGS) par gamme
  unit_cogs_range1: "S",    // Coût unitaire Gamme 1
  unit_cogs_range2: "T",    // Coût unitaire Gamme 2 (0 si non utilisé)
  unit_cogs_range3: "U",    // Coût unitaire Gamme 3 (0 si non utilisé)
  // V = COGS moyen → FORMULE

  // Mix volume canal × gamme (décimaux)
  // Canal 1 (B2B par défaut)
  mix_r1_ch1_pct: "W",      // % Gamme 1 via Canal 1
  mix_r2_ch1_pct: "X",      // % Gamme 2 via Canal 1
  mix_r3_ch1_pct: "Y",      // % Gamme 3 via Canal 1
  // Canal 2 (B2C par défaut)
  mix_r1_ch2_pct: "Z",      // % Gamme 1 via Canal 2
  mix_r2_ch2_pct: "AA",     // % Gamme 2 via Canal 2
  mix_r3_ch2_pct: "AB",     // % Gamme 3 via Canal 2
  // AC, AD = COGS moyens par canal → FORMULE

  // Volumes trimestriels (entiers — nombre d'unités vendues)
  volume_q1: "AE",
  volume_q2: "AF",
  volume_q3: "AG",
  volume_q4: "AH",
  // AI→AP = totaux calculés → FORMULE — NE PAS ÉCRIRE
} as const;

/**
 * Colonnes FORMULE dans RevenueData — NE JAMAIS ÉCRIRE
 */
export const REVENUE_FORMULA_COLS = ["O", "V", "AC", "AD", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP"];

/**
 * EXEMPLES DE VALEURS TYPIQUES selon le type d'entreprise
 */
export const REVENUE_TYPICAL_VALUES = {
  /** Produit unique, une seule gamme, tout B2B, volumes croissants */
  single_product_b2b: {
    unit_price_range1: 50000,   // 50 000 FCFA
    unit_price_range2: 0,
    unit_price_range3: 0,
    mix_range1_pct: 1.0,        // 100% gamme 1
    mix_range2_pct: 0,
    mix_range3_pct: 0,
    unit_cogs_range1: 25000,    // 50% marge brute
    unit_cogs_range2: 0,
    unit_cogs_range3: 0,
    mix_r1_ch1_pct: 1.0,        // 100% canal 1 (B2B)
    mix_r2_ch1_pct: 1.0,
    mix_r3_ch1_pct: 1.0,
    mix_r1_ch2_pct: 0,
    mix_r2_ch2_pct: 0,
    mix_r3_ch2_pct: 0,
    volume_q1: 25, volume_q2: 25, volume_q3: 25, volume_q4: 25, // 100 unités/an
  },
  /** Service B2C avec deux gammes */
  service_b2c_two_ranges: {
    unit_price_range1: 15000,   // LOW END
    unit_price_range2: 35000,   // HIGH END
    unit_price_range3: 0,
    mix_range1_pct: 0.6,        // 60% LOW END
    mix_range2_pct: 0.4,        // 40% HIGH END
    mix_range3_pct: 0,
    unit_cogs_range1: 3000,     // 80% marge
    unit_cogs_range2: 7000,
    unit_cogs_range3: 0,
    mix_r1_ch1_pct: 0,          // 0% B2B
    mix_r2_ch1_pct: 0,
    mix_r3_ch1_pct: 0,
    mix_r1_ch2_pct: 1.0,        // 100% B2C
    mix_r2_ch2_pct: 1.0,
    mix_r3_ch2_pct: 1.0,
    volume_q1: 50, volume_q2: 60, volume_q3: 80, volume_q4: 90,
  },
} as const;

// ─────────────────────────────────────────────
// FEUILLE : FinanceData
// ─────────────────────────────────────────────

/**
 * SECTION 2 — DÉPENSES OPÉRATIONNELLES
 * Écrire les montants annuels dans les colonnes O→X (10 colonnes = 10 périodes)
 * Format: tableau de 10 valeurs [YEAR-2, YEAR-1, H1, H2, CY, Y2, Y3, Y4, Y5, Y6]
 */

export const FINANCE_OPEX_MAPPING = {

  // ── Marketing (rows 201-210) ─────────────────────────────────────────────
  marketing: {
    research:                  { row: 201, label: "Études et recherche" },
    purchase_studies_services: { row: 202, label: "Achats d'études et prestations de services" },
    receptions:                { row: 203, label: "Réceptions / événements clients" },
    general_documentation:     { row: 204, label: "Documentation générale" },
    advertising:               { row: 205, label: "Publicité et communication" },
    custom_1:                  { row: 206, label: "Marketing ligne X (personnalisable)" },
    custom_2:                  { row: 207, label: "Marketing ligne Y (personnalisable)" },
    custom_3:                  { row: 208, label: "Marketing ligne Z (personnalisable)" },
    custom_4:                  { row: 209, label: "Marketing ligne A (personnalisable)" },
    custom_5:                  { row: 210, label: "Marketing ligne B (personnalisable)" },
    // row 211 = TOTAL → FORMULE
  },

  // ── Staff par catégorie (rows 213-281) ──────────────────────────────────
  /**
   * Chaque catégorie occupe 7 lignes (+ 1 séparatrice) :
   *   row+0: EFT  | H="NUMBER OF EMPLOYEES"           → écrire effectif entier (cols O-X)
   *   row+1: VALUE | H="GROSS SALARY PER PERSON..."   → salaire brut mensuel par personne (cols O-X)
   *   row+2: VALUE | H="OTHER ALLOWANCES..."          → primes/avantages annuels par personne (cols O-X)
   *   row+3: VALUE | H="EMPLOYER SOCIAL SECURITY..."  → FORMULE (cotisations patronales) — NE PAS ÉCRIRE
   *   row+4: VALUE | H="COST PER PERSON PER PERIOD"   → FORMULE — NE PAS ÉCRIRE
   *   row+5: VALUE | H="TOTAL"                        → FORMULE — NE PAS ÉCRIRE
   *   row+6: séparatrice vide
   */
  staff: {
    STAFF_CAT01: { start_row: 213, eft_row: 213, salary_row: 214, allowances_row: 215 },
    STAFF_CAT02: { start_row: 220, eft_row: 220, salary_row: 221, allowances_row: 222 },
    STAFF_CAT03: { start_row: 227, eft_row: 227, salary_row: 228, allowances_row: 229 },
    STAFF_CAT04: { start_row: 234, eft_row: 234, salary_row: 235, allowances_row: 236 },
    STAFF_CAT05: { start_row: 241, eft_row: 241, salary_row: 242, allowances_row: 243 },
    STAFF_CAT06: { start_row: 248, eft_row: 248, salary_row: 249, allowances_row: 250 },
    STAFF_CAT07: { start_row: 255, eft_row: 255, salary_row: 256, allowances_row: 257 },
    STAFF_CAT08: { start_row: 262, eft_row: 262, salary_row: 263, allowances_row: 264 },
    STAFF_CAT09: { start_row: 269, eft_row: 269, salary_row: 270, allowances_row: 271 },
    STAFF_CAT10: { start_row: 276, eft_row: 276, salary_row: 277, allowances_row: 278 },
  },

  // ── Taxes et charges sur salaires (rows 283-291) ─────────────────────────
  taxes_on_staff: {
    taxes_on_salaries:       { row: 283, label: "Taxes sur appointements et salaires" },
    apprenticeship_taxes:    { row: 284, label: "Taxe d'apprentissage" },
    continuing_training:     { row: 285, label: "Formation professionnelle continue (FPC)" },
    other_taxes_duties:      { row: 286, label: "Autres impôts et taxes sur personnel" },
    custom_1:                { row: 287, label: "Taxes personnel ligne X (personnalisable)" },
    custom_2:                { row: 288, label: "Taxes personnel ligne Y" },
    custom_3:                { row: 289, label: "Taxes personnel ligne Z" },
    custom_4:                { row: 290, label: "Taxes personnel ligne A" },
    custom_5:                { row: 291, label: "Taxes personnel ligne B" },
    // row 292 = TOTAL → FORMULE
  },

  // ── Charges de bureau/boutique (rows 294-308) ────────────────────────────
  office_costs: {
    rent:                    { row: 294, label: "Loyer (bureaux + boutiques)" },
    internet:                { row: 295, label: "Internet (bureaux + boutiques)" },
    telecommunications:      { row: 296, label: "Télécommunications fixe + mobile" },
    office_supplies:         { row: 297, label: "Fournitures de bureau" },
    small_equipment_tools:   { row: 298, label: "Petit matériel et outillage" },
    lost_packaging:          { row: 299, label: "Emballages perdus" },
    fuel:                    { row: 300, label: "Carburant (usage bureaux)" },
    water:                   { row: 301, label: "Eau" },
    electricity:             { row: 302, label: "Électricité" },
    cleaning:                { row: 303, label: "Nettoyage bureaux + boutiques" },
    custom_1:                { row: 304, label: "Bureau ligne X (personnalisable)" },
    custom_2:                { row: 305, label: "Bureau ligne Y" },
    custom_3:                { row: 306, label: "Bureau ligne Z" },
    custom_4:                { row: 307, label: "Bureau ligne A" },
    custom_5:                { row: 308, label: "Bureau ligne B" },
    // row 309 = TOTAL → FORMULE
  },

  // ── Autres charges (rows 311-319) ────────────────────────────────────────
  other_expenses: {
    occupational_health:     { row: 311, label: "Médecine du travail et pharmacie" },
    directors_remuneration:  { row: 312, label: "Indemnités de fonction et rémunérations d'administrateurs" },
    donations:               { row: 313, label: "Dons" },
    sponsorship:             { row: 314, label: "Mécénat / sponsoring" },
    custom_1:                { row: 315, label: "Autres charges ligne X" },
    custom_2:                { row: 316, label: "Autres charges ligne Y" },
    custom_3:                { row: 317, label: "Autres charges ligne Z" },
    custom_4:                { row: 318, label: "Autres charges ligne A" },
    custom_5:                { row: 319, label: "Autres charges ligne B" },
    // row 320 = TOTAL → FORMULE
  },

  // ── Voyages et déplacements (rows 322-323) ───────────────────────────────
  // ATTENTION : row 322 = effectif voyageurs (EFT, entier), row 323 = coût moyen par personne (montant)
  travel: {
    nb_travellers:           { row: 322, type: "integer", label: "Nombre de personnes voyageant" },
    avg_cost_per_person:     { row: 323, type: "number",  label: "Coût moyen par voyage par personne" },
    // row 324 = TOTAL → FORMULE
  },

  // ── Assurances (rows 326-332) ────────────────────────────────────────────
  insurance: {
    building_insurance:      { row: 326, label: "Assurance du bâtiment" },
    company_insurance:       { row: 327, label: "Assurance de l'entreprise (RC, multirisque)" },
    custom_1:                { row: 328, label: "Assurance ligne X" },
    custom_2:                { row: 329, label: "Assurance ligne Y" },
    custom_3:                { row: 330, label: "Assurance ligne Z" },
    custom_4:                { row: 331, label: "Assurance ligne A" },
    custom_5:                { row: 332, label: "Assurance ligne B" },
    // row 333 = TOTAL → FORMULE
  },

  // ── Entretien et maintenance (rows 335-342) ──────────────────────────────
  maintenance: {
    movable_property:        { row: 335, label: "Entretien et réparation des biens mobiliers" },
    demolition_restoration:  { row: 336, label: "Charges de démantèlement et remise en état" },
    other_maintenance:       { row: 337, label: "Autres entretiens et réparations" },
    custom_1:                { row: 338, label: "Maintenance ligne X" },
    custom_2:                { row: 339, label: "Maintenance ligne Y" },
    custom_3:                { row: 340, label: "Maintenance ligne Z" },
    custom_4:                { row: 341, label: "Maintenance ligne A" },
    custom_5:                { row: 342, label: "Maintenance ligne B" },
    // row 343 = TOTAL → FORMULE
  },

  // ── Tiers prestataires (rows 345-357) ────────────────────────────────────
  third_parties: {
    legal_startup_costs:     { row: 345, label: "Frais de démarrage légaux (notaire, obligations gouvernementales)" },
    loan_followup_costs:     { row: 346, label: "Frais de suivi prêt / facture d'avance" },
    other_startup_costs:     { row: 347, label: "Autres frais de démarrage (si non encore actif)" },
    transport_goods_fuel:    { row: 348, label: "Transport de marchandises (carburant)" },
    delivery_goods:          { row: 349, label: "Livraison de marchandises" },
    commissions_brokerage:   { row: 350, label: "Commissions et courtages sur ventes" },
    legal_adviser:           { row: 351, label: "Conseiller juridique" },
    accounting_taxation:     { row: 352, label: "Comptabilité et fiscalité" },
    custom_1:                { row: 353, label: "Tiers ligne X" },
    custom_2:                { row: 354, label: "Tiers ligne Y" },
    custom_3:                { row: 355, label: "Tiers ligne Z" },
    custom_4:                { row: 356, label: "Tiers ligne A" },
    custom_5:                { row: 357, label: "Tiers ligne B" },
    // row 358 = TOTAL → FORMULE
  },
} as const;

/**
 * SECTION 3 — IMMOBILISATIONS / CAPEX
 *
 * Chaque ligne d'actif : écrire K=année d'acquisition, L=valeur d'acquisition, M=taux amortissement
 * Les colonnes O→X (valeur nette comptable par année) sont FORMULES → NE PAS ÉCRIRE
 *
 * OFFICE EQUIPMENT : 40 slots, rows 408-447
 * OTHER ASSETS     : 20 slots, rows 462-481
 */
export const FINANCE_CAPEX_MAPPING = {
  office_equipment: {
    investment_rows: Array.from({ length: 40 }, (_, i) => ({
      slot: i + 1,
      row: 408 + i,
      col_acquisition_year:  "K",  // Année d'acquisition (entier)
      col_acquisition_value: "L",  // Valeur d'acquisition (montant)
      col_amortisation_rate: "M",  // Taux amortissement annuel (décimal: 0.20 = 20%/an)
    })),
    // Rows 502-541 = amortissements → FORMULE
    // Rows 596-635 = valeur nette comptable → FORMULE
  },
  other_assets: {
    investment_rows: Array.from({ length: 20 }, (_, i) => ({
      slot: i + 1,
      row: 462 + i,
      col_acquisition_year:  "K",
      col_acquisition_value: "L",
      col_amortisation_rate: "M",
    })),
    // Rows 556-575 = amortissements → FORMULE
    // Rows 650-669 = valeur nette comptable → FORMULE
  },
  /** Taux d'amortissement typiques en Afrique de l'Ouest */
  typical_rates: {
    it_computers:          0.333,  // 3 ans
    office_furniture:      0.100,  // 10 ans
    vehicles:              0.200,  // 5 ans
    production_equipment:  0.100,  // 10 ans
    software:              0.333,  // 3 ans
    buildings:             0.050,  // 20 ans
    motorcycles:           0.250,  // 4 ans
  },
} as const;

/**
 * SECTION 4 — FONDS DE ROULEMENT (Working Capital)
 *
 * Valeurs par défaut du template (vérifiées ligne par ligne) :
 *   - stock_days : cols S=45, T=45, U=60, V=60, W=60, X=60 (écrire dans cols O-X)
 *   - customer_payment_days : 15 jours (toutes années)
 *   - supplier_payment_days : 30 jours (toutes années)
 *
 * IMPORTANT : écrire les jours dans TOUTES les colonnes O→X (pas seulement une)
 */
export const FINANCE_WORKING_CAPITAL = {
  stock: {
    days_row:  693,  // Nombre de jours de stock — écrire cols O-X
    value_row: 695,  // Valeur du stock → FORMULE (ne pas écrire sauf YEAR-2 initial)
    default_days_by_year: { O: 0, P: 0, Q: 45, R: 45, S: 45, T: 45, U: 60, V: 60, W: 60, X: 60 },
    note: "0 pour les années historiques sans stock, valeur réelle pour les prévisions",
  },
  accounts_receivable: {
    days_row:  697,
    value_row: 699,  // → FORMULE
    default_days_by_year: { O: 0, P: 0, Q: 15, R: 15, S: 15, T: 15, U: 15, V: 15, W: 15, X: 15 },
    note: "B2B = 30-60 jours | B2C = 0-15 jours | paiement immédiat = 0",
  },
  accounts_payable: {
    days_row:  701,
    value_row: 703,  // → FORMULE
    default_days_by_year: { O: 0, P: 0, Q: 30, R: 30, S: 30, T: 30, U: 30, V: 30, W: 30, X: 30 },
    note: "Délai de paiement fournisseurs. Typique Côte d'Ivoire : 30-45 jours",
  },
  total_row: 705,   // → FORMULE
} as const;

// ─────────────────────────────────────────────
// SCHÉMA JSON — Sortie attendue de Claude API
// ─────────────────────────────────────────────

/**
 * Structure exacte que Claude doit retourner.
 * Chaque champ est annoté avec sa cellule cible dans l'Excel.
 * L'Edge Function convertit ce JSON → écriture openpyxl cellule par cellule.
 */
export interface OVOFinancialPlanInput {

  // ── Paramètres entreprise ──────────────────────────────────────────────
  company:         string;   // InputsData J5
  country:         string;   // InputsData J6
  currency:        string;   // InputsData J8 (ex: "CFA")
  exchange_rate:   number;   // InputsData J9
  vat_rate:        number;   // InputsData J12 (ex: 0.18)
  inflation_rate:  number;   // InputsData J14
  tax_regime_1:    number;   // InputsData J17
  tax_regime_2:    number;   // InputsData J18

  // ── Années ────────────────────────────────────────────────────────────
  year_minus_2: number;      // InputsData J24
  year_minus_1: number;      // InputsData J25
  current_year: number;      // InputsData J26/J27/J28
  year2: number;             // InputsData J29
  year3: number;             // InputsData J30
  year4: number;             // InputsData J31
  year5: number;             // InputsData J32
  year6: number;             // InputsData J33

  // ── Gammes et canaux ──────────────────────────────────────────────────
  ranges: Array<{
    slot: 1 | 2 | 3;
    name: string;            // InputsData col H (row 70-72)
    description?: string;    // InputsData col J
  }>;
  channels: Array<{
    slot: 1 | 2;
    name: string;            // InputsData col H (row 75-76)
    description?: string;    // InputsData col J
  }>;

  // ── Produits ──────────────────────────────────────────────────────────
  products: Array<{
    slot: number;            // 1-20
    name: string;            // InputsData col H (row 36+slot-1)
    active: boolean;         // InputsData col I = 1 ou 0
    description?: string;    // InputsData col J
    primary_range: 1 | 2 | 3;   // InputsData matrix rows 79-98, col F/G/H
    primary_channel: 1 | 2;     // InputsData matrix, col I/J

    /** Une entrée par année. Les 8 années doivent toutes être présentes. */
    per_year: Array<{
      year: YearLabel;
      // ── Colonnes VOLUME dans RevenueData ──
      unit_price_range1: number;    // col L
      unit_price_range2: number;    // col M (0 si non utilisé)
      unit_price_range3: number;    // col N (0 si non utilisé)
      mix_range1_pct:    number;    // col P (décimal, ex: 1.0)
      mix_range2_pct:    number;    // col Q
      mix_range3_pct:    number;    // col R (P+Q+R doit = 1.0)
      unit_cogs_range1:  number;    // col S
      unit_cogs_range2:  number;    // col T
      unit_cogs_range3:  number;    // col U
      mix_r1_ch1_pct:    number;    // col W
      mix_r2_ch1_pct:    number;    // col X
      mix_r3_ch1_pct:    number;    // col Y
      mix_r1_ch2_pct:    number;    // col Z (W+Z doit = 1.0 pour Range1)
      mix_r2_ch2_pct:    number;    // col AA
      mix_r3_ch2_pct:    number;    // col AB
      volume_q1: number;            // col AE (entier)
      volume_q2: number;            // col AF
      volume_q3: number;            // col AG
      volume_q4: number;            // col AH
    }>;
  }>;

  // ── Services ──────────────────────────────────────────────────────────
  services: Array<{
    slot: number;            // 1-10
    name: string;
    active: boolean;
    description?: string;
    primary_range: 1 | 2 | 3;
    primary_channel: 1 | 2;
    per_year: OVOFinancialPlanInput["products"][0]["per_year"]; // même structure
  }>;

  // ── Staff ─────────────────────────────────────────────────────────────
  staff: Array<{
    category_id: "STAFF_CAT01" | "STAFF_CAT02" | "STAFF_CAT03" | "STAFF_CAT04" | "STAFF_CAT05"
                | "STAFF_CAT06" | "STAFF_CAT07" | "STAFF_CAT08" | "STAFF_CAT09" | "STAFF_CAT10";
    occupational_category: string;   // InputsData col H (row 113-122)
    department: string;              // InputsData col I
    social_security_rate: number;    // InputsData col J (décimal, ex: 0.1645)
    per_year: Array<{
      year: YearLabel;
      headcount: number;                        // FinanceData EFT row, cols O-X
      gross_monthly_salary_per_person: number;  // FinanceData salary row, cols O-X
      annual_allowances_per_person: number;     // FinanceData allowances row, cols O-X
    }>;
  }>;

  // ── CAPEX ─────────────────────────────────────────────────────────────
  capex: Array<{
    type: "OFFICE_EQUIPMENT" | "OTHER_ASSETS";
    slot: number;                  // 1-40 pour OE, 1-20 pour OA
    label: string;                 // Pour documentation uniquement
    acquisition_year: number;      // FinanceData col K
    acquisition_value: number;     // FinanceData col L
    amortisation_rate: number;     // FinanceData col M (ex: 0.20)
  }>;

  // ── Dépenses opérationnelles ──────────────────────────────────────────
  /**
   * Chaque champ = tableau de 10 valeurs correspondant aux 10 colonnes année
   * Index: [0=YEAR-2, 1=YEAR-1, 2=H1, 3=H2, 4=CY, 5=Y2, 6=Y3, 7=Y4, 8=Y5, 9=Y6]
   * → colonnes O, P, Q, R, S, T, U, V, W, X dans FinanceData
   */
  opex: {
    marketing: {
      research:                  number[10];
      purchase_studies_services: number[10];
      receptions:                number[10];
      general_documentation:     number[10];
      advertising:               number[10];
    };
    taxes_on_staff: {
      taxes_on_salaries:    number[10];
      apprenticeship_taxes: number[10];
      continuing_training:  number[10];
      other_taxes_duties:   number[10];
    };
    office_costs: {
      rent:                  number[10];
      internet:              number[10];
      telecommunications:    number[10];
      office_supplies:       number[10];
      small_equipment_tools: number[10];
      fuel:                  number[10];
      water:                 number[10];
      electricity:           number[10];
      cleaning:              number[10];
    };
    other_expenses: {
      occupational_health:    number[10];
      directors_remuneration: number[10];
      donations:              number[10];
    };
    travel: {
      nb_travellers:        number[10];  // effectif entier
      avg_cost_per_person:  number[10];
    };
    insurance: {
      building_insurance:   number[10];
      company_insurance:    number[10];
    };
    maintenance: {
      movable_property:     number[10];
      demolition_restoration: number[10];
      other_maintenance:    number[10];
    };
    third_parties: {
      legal_startup_costs:    number[10];
      loan_followup_costs:    number[10];
      other_startup_costs:    number[10];
      transport_goods_fuel:   number[10];
      delivery_goods:         number[10];
      commissions_brokerage:  number[10];
      legal_adviser:          number[10];
      accounting_taxation:    number[10];
    };
  };

  // ── Fonds de roulement ────────────────────────────────────────────────
  working_capital: {
    /**
     * Jours par période (10 valeurs pour cols O-X)
     * Les colonnes O/P = années historiques → souvent 0 si données non disponibles
     */
    stock_days_by_period:             number[10];  // FinanceData row 693
    customer_payment_days_by_period:  number[10];  // FinanceData row 697
    supplier_payment_days_by_period:  number[10];  // FinanceData row 701
  };

  // ── Prêts ─────────────────────────────────────────────────────────────
  loans: {
    ovo:            { rate: number; years: number };   // InputsData I125, J125
    family_friends: { rate: number; years: number };   // InputsData I126, J126
    local_bank:     { rate: number; years: number };   // InputsData I127, J127
  };

  // ── Scénario de simulation ────────────────────────────────────────────
  /** "TYPICAL_CASE" = valeur nominale | configurable dans FinanceData H2 */
  simulation_scenario: "WORST_CASE" | "TYPICAL_CASE" | "BEST_CASE";
}

// ─────────────────────────────────────────────
// FONCTION UTILITAIRE : Obtenir la ligne exacte
// ─────────────────────────────────────────────

/**
 * Retourne le numéro de ligne exact pour écrire dans RevenueData.
 *
 * @param type    "product" ou "service"
 * @param slot    Numéro du produit (1-20) ou service (1-10)
 * @param year    Label de l'année
 * @returns       Numéro de ligne openpyxl (1-indexé)
 *
 * @example
 * getRevenueDataRow("product", 1, "YEAR-2")  // → 9
 * getRevenueDataRow("product", 2, "YEAR3")   // → 55
 * getRevenueDataRow("service", 1, "YEAR-2")  // → 849
 */
export function getRevenueDataRow(
  type: "product" | "service",
  slot: number,
  year: YearLabel
): number {
  const headerRow = type === "product"
    ? REVENUE_PRODUCT_HEADER_ROW[slot]
    : REVENUE_SERVICE_HEADER_ROW[slot];
  return headerRow + 1 + YEAR_INDEX[year];
}

/**
 * Retourne la colonne numérique (openpyxl) pour une clé de REVENUE_VOLUME_WRITABLE_COLS.
 */
export function getRevenueColNum(key: keyof typeof REVENUE_VOLUME_WRITABLE_COLS): number {
  return COL_NUM[REVENUE_VOLUME_WRITABLE_COLS[key]];
}

/**
 * Retourne la colonne numérique pour une période dans FinanceData.
 * @param yearIndex 0-9 correspondant à [YEAR-2, YEAR-1, H1, H2, CY, Y2, Y3, Y4, Y5, Y6]
 */
export function getFinanceColNum(yearIndex: number): number {
  const cols = ["O", "P", "Q", "R", "S", "T", "U", "V", "W", "X"];
  return COL_NUM[cols[yearIndex]];
}

// ─────────────────────────────────────────────
// PROMPT SYSTÈME CLAUDE — Génération du JSON
// ─────────────────────────────────────────────

export const CLAUDE_SYSTEM_PROMPT = `
Tu es un expert financier spécialisé dans les PME africaines (Afrique de l'Ouest, zone FCFA).
Tu génères le plan financier OVO à 6 ans pour un entrepreneur ivoirien/sénégalais/béninois.

CONTEXTE FISCAL CÔTE D'IVOIRE :
- TVA : 18%
- IS régime simplifié (revenus ≤ 200M FCFA) : 4% du CA
- IS régime réel (revenus > 200M FCFA) : 30% du bénéfice
- Cotisations sociales patronales : 16,45% du salaire brut
- Inflation moyenne : 3%/an
- Taux change XOF/EUR : 655,957 (fixe)

RÈGLES DE PROJECTION :
1. Croissance réaliste : max 30%/an pour les 3 premières années, 15-20% ensuite
2. Marge brute produits typique : 30-60% selon secteur
3. Marge brute services typique : 60-85% selon secteur
4. Staff : saisir effectif réel, pas de sur-estimation
5. Années historiques (YEAR-2, YEAR-1) : utiliser les vraies données si disponibles, sinon estimer
6. YEAR-2 = 2 ans avant l'année courante, peut être à 0 si startup récente

INSTRUCTIONS DE SORTIE :
- Répondre UNIQUEMENT avec un objet JSON valide
- Pas de markdown, pas de commentaires, pas de texte avant/après
- Tous les montants en XOF (FCFA) — pas de conversion euros
- Les % sont des décimaux (0.18 pas 18)
- Les volumes sont des entiers
- Toujours fournir les 8 années pour chaque produit/service
- Pour les produits inactifs (active: false), mettre tous les volumes et prix à 0
`.trim();

export default {
  README_MAPPING,
  INPUTS_MAPPING,
  REVENUE_PRODUCT_HEADER_ROW,
  REVENUE_SERVICE_HEADER_ROW,
  REVENUE_VOLUME_WRITABLE_COLS,
  REVENUE_FORMULA_COLS,
  REVENUE_TYPICAL_VALUES,
  FINANCE_OPEX_MAPPING,
  FINANCE_CAPEX_MAPPING,
  FINANCE_WORKING_CAPITAL,
  FINANCE_YEAR_COLS,
  COL_NUM,
  YEAR_INDEX,
  getRevenueDataRow,
  getRevenueColNum,
  getFinanceColNum,
  CLAUDE_SYSTEM_PROMPT,
};
