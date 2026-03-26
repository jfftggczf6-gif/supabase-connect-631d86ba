/**
 * financial-compute.ts — Module de calcul déterministe du Plan Financier
 * 
 * RÈGLE D'OR : Aucun appel IA ici. Tout est formule.
 * Entrées : données réelles (inputs_data) + hypothèses calibrées (de l'IA)
 * Sorties : ratios, projections, indicateurs — tout vérifiable
 */

// ─── TYPES ─────────────────────────────────────────────────────────

interface HistoriqueAnnee {
  annee?: number;
  ca_total?: number;
  couts_variables?: number;
  charges_fixes?: number;
  resultat_exploitation?: number;
  resultat_net?: number;
  tresorerie?: number;
  nombre_employes?: number;
  nombre_clients?: number;
  ca_par_produit?: Array<{ nom: string; ca: number }>;
}

export interface InputsData {
  compte_resultat?: {
    chiffre_affaires?: number; ca?: number;
    achats_matieres?: number; achats?: number;
    charges_personnel?: number; salaires?: number;
    charges_externes?: number;
    dotations_amortissements?: number;
    charges_financieres?: number;
    resultat_exploitation?: number;
    resultat_net?: number;
    impots?: number;
  };
  bilan?: {
    total_actif?: number;
    capitaux_propres?: number;
    dettes_totales?: number; dettes?: number;
    actif_circulant?: number;
    passif_circulant?: number;
    stocks?: number;
    creances_clients?: number;
    dettes_fournisseurs?: number;
    tresorerie?: number;
  };
  equipe?: Array<{
    poste: string; nombre: number;
    salaire_mensuel?: number;
    charges_sociales_pct?: number;
  }>;
  couts_variables?: Array<{ poste: string; montant_annuel?: number; montant_mensuel?: number }>;
  couts_fixes?: Array<{ poste: string; montant_annuel?: number; montant_mensuel?: number }>;
  bfr?: {
    delai_clients_jours?: number;
    delai_fournisseurs_jours?: number;
    stock_moyen_jours?: number;
    tresorerie_depart?: number;
  };
  investissements?: Array<{
    nature: string; montant?: number;
    annee_achat?: number; duree_amortissement_ans?: number;
  }>;
  financement?: {
    apports_capital?: number;
    subventions?: number;
    prets?: Array<{
      source: string; montant?: number;
      taux_pct?: number; duree_mois?: number; differe_mois?: number;
    }>;
  };
  hypotheses_croissance?: {
    objectifs_ca?: Array<{ annee: number; montant: number }>;
    taux_marge_brute_cible?: number;
    inflation_annuelle?: number;
    croissance_volumes_annuelle?: number;
  };
  revenue?: number;
  effectif_total?: number;
  historique_3ans?: {
    n?: HistoriqueAnnee;
    n_moins_1?: HistoriqueAnnee;
    n_moins_2?: HistoriqueAnnee;
  };
}

export interface AIHypotheses {
  taux_croissance_ca: number[];   // 5 valeurs (Y+1 à Y+5)
  taux_croissance_prix: number;
  taux_croissance_opex: number;
  taux_croissance_salariale: number;
  taux_cogs_cible: number[];      // 5 valeurs
  inflation: number;
}

export interface ProductProjection {
  nom: string;
  prix_unitaire: number;
  cout_unitaire: number;
  volume_annuel: number;
  taux_croissance_volume: number;
  taux_croissance_prix: number;
  part_ca: number;
  par_annee: YearProductData[];
}

export interface YearProductData {
  annee: string;        // "YEAR-2", "YEAR-1", "CURRENT YEAR", "YEAR2"..."YEAR6"
  annee_num: number;    // 2022, 2023, etc.
  volume: number;
  prix_r1: number; prix_r2: number; prix_r3: number;
  cogs_r1: number; cogs_r2: number; cogs_r3: number;
  mix_r1: number; mix_r2: number; mix_r3: number;
  mix_ch1: number; mix_ch2: number;
  volume_q1: number; volume_q2: number; volume_q3: number; volume_q4: number;
  ca: number;
  cogs_total: number;
  marge_brute: number;
}

export interface StaffProjection {
  categorie: string;
  departement: string;
  taux_charges_sociales: number;
  par_annee: Array<{
    annee: string;
    effectif: number;
    salaire_mensuel_brut: number;
    primes_annuelles: number;
    charges_sociales_mensuelles: number;
  }>;
}

export interface RatiosSanteFinanciere {
  rentabilite: {
    marge_brute_pct: number;
    marge_ebitda_pct: number;
    marge_nette_pct: number;
    roa: number;
    roe: number;
    couverture_interets: number | null;
  };
  liquidite: {
    ratio_courant: number | null;
    ratio_rapide: number | null;
    bfr_jours: number;
    runway_mois: number | null;
    tresorerie_nette: number;
    cashflow_operationnel: number;
  };
  solvabilite: {
    endettement_pct: number;
    autonomie_financiere_pct: number;
    capacite_remboursement_ans: number | null;
    gearing: number | null;
    dscr: number | null;
  };
  cycle_exploitation: {
    dso: number;
    dio: number;
    dpo: number;
    cycle_tresorerie: number;
    ca_par_employe: number;
  };
}

export interface Projection {
  annee: string;
  annee_num: number;
  is_reel: boolean;
  ca: number;
  cogs: number;
  marge_brute: number;
  marge_brute_pct: number;
  opex_total: number;
  ebitda: number;
  ebitda_pct: number;
  amortissements: number;
  resultat_exploitation: number;
  charges_financieres: number;
  impots: number;
  resultat_net: number;
  cashflow: number;
}

export interface IndicateursDecision {
  van: number | null;
  tri: number | null;
  payback_years: number | null;
  dscr_moyen: number | null;
  roi: number | null;
  couverture_interets: number | null;
  cycle_tresorerie: number;
  runway_mois: number | null;
}

export interface SeuilRentabilite {
  seuil_annuel: number;
  ca_actuel: number;
  marge_securite_pct: number;
}

export interface PlanFinancierComputed {
  // Identification
  company: string;
  country: string;
  currency: string;
  exchange_rate_eur: number;
  vat_rate: number;
  inflation_rate: number;
  tax_regime_1: number;
  tax_regime_2: number;
  current_year: number;
  years: Record<string, number>;

  // Situation actuelle
  kpis: { ca: number; resultat_net: number; tresorerie: number; effectif: number };
  compte_resultat_reel: Array<{ poste: string; valeurs: number[]; is_total: boolean }>;
  structure_couts: { variables: Array<{ poste: string; montant: number }>; fixes: Array<{ poste: string; montant: number }>; pct_variables: number };
  sante_financiere: RatiosSanteFinanciere;
  seuil_rentabilite: SeuilRentabilite;

  // Projections
  projections: Projection[];
  indicateurs_decision: IndicateursDecision;
  produits: ProductProjection[];
  services: ProductProjection[];
  staff: StaffProjection[];

  // Excel mapping ready
  ranges: Array<{ slot: number; name: string }>;
  channels: Array<{ slot: number; name: string }>;
  opex: Record<string, Record<string, number[]>>;
  capex: Array<{ type: string; slot: number; label: string; categorie: string; acquisition_year: number; acquisition_value: number; amortisation_rate: number }>;
  loans: {
    ovo: { amount: number; rate: number; term_years: number };
    family: { amount: number; rate: number; term_years: number };
    bank: { amount: number; rate: number; term_years: number };
  };
  financing: Record<string, number[]>;
  working_capital: { stock_days: number[]; receivable_days: number[]; payable_days: number[] };
  scenarios: Record<string, number[]>;

  // Frontend fields
  rentabilite_par_activite: Array<{ activite: string; ca: number; pct_ca: number; couts_directs: number; marge_brute: number; marge_pct: number; ebe: number }>;
  opex_categories: Array<{ poste: string; montant: number; pct: number }>;
  opex_detail: Array<{ categorie: string; sous_poste: string; montant_cy: number; montant_y5: number }>;
  echeancier: Array<{ label: string; is_total?: boolean; is_dscr?: boolean; dim?: boolean; annees: Array<{ annee: number; valeur: string }> }>;
  bfr_detail: { delai_clients_jours: number; delai_fournisseurs_jours: number; stock_moyen_jours: number; bfr_montant: number; bfr_jours: number; variation_bfr: number } | null;
}

// ─── HELPERS ───────────────────────────────────────────────────────

const safe = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const div = (a: number, b: number): number | null => (b === 0 ? null : a / b);

const pct = (a: number, b: number): number => (b === 0 ? 0 : (a / b) * 100);

const round = (v: number, precision = 0): number => {
  const f = Math.pow(10, precision);
  return Math.round(v * f) / f;
};

const roundK = (v: number): number => Math.round(v / 1000) * 1000;

const YEAR_LABELS = ["YEAR-2", "YEAR-1", "CURRENT YEAR", "YEAR2", "YEAR3", "YEAR4", "YEAR5", "YEAR6"];

// ─── EXTRACTEUR BILAN UNIVERSEL (plat ET imbriqué actif/passif) ───
function extractBilan(bil: any): {
  total_actif: number; capitaux_propres: number; dettes: number;
  actif_circulant: number; passif_circulant: number; stocks: number;
  creances_clients: number; dettes_fournisseurs: number;
  tresorerie: number; immobilisations: number;
} {
  if (!bil) return { total_actif: 0, capitaux_propres: 0, dettes: 0, actif_circulant: 0, passif_circulant: 0, stocks: 0, creances_clients: 0, dettes_fournisseurs: 0, tresorerie: 0, immobilisations: 0 };

  const actif = bil.actif || {};
  const passif = bil.passif || {};

  return {
    total_actif: safe(bil.total_actif || actif.total_actif || passif.total_passif),
    capitaux_propres: safe(bil.capitaux_propres || passif.capitaux_propres),
    dettes: safe(bil.dettes_totales || bil.dettes || (safe(passif.dettes_lt) + safe(passif.dettes_ct))),
    actif_circulant: safe(bil.actif_circulant || (safe(actif.stocks) + safe(actif.creances_clients) + safe(actif.tresorerie))),
    passif_circulant: safe(bil.passif_circulant || passif.dettes_ct),
    stocks: safe(bil.stocks || actif.stocks),
    creances_clients: safe(bil.creances_clients || actif.creances_clients),
    dettes_fournisseurs: safe(bil.dettes_fournisseurs || passif.fournisseurs),
    tresorerie: safe(bil.tresorerie || actif.tresorerie || bil.bfr?.tresorerie_depart),
    immobilisations: safe(bil.immobilisations || actif.immobilisations),
  };
}

// ─── RATIOS (situation actuelle) ───────────────────────────────────

export function computeRatios(inputs: InputsData): RatiosSanteFinanciere {
  const cr = inputs.compte_resultat || {};
  const bil = inputs.bilan || {};
  const bfr = inputs.bfr || {};

  const CA = safe(cr.chiffre_affaires || cr.ca || inputs.revenue);
  const achats = safe(cr.achats_matieres || cr.achats);
  const charges_personnel = safe(cr.charges_personnel || cr.salaires);
  const charges_externes = safe(cr.charges_externes);
  const amort = safe(cr.dotations_amortissements);
  const charges_fin = safe(cr.charges_financieres);
  const RN = safe(cr.resultat_net);
  const RE = safe(cr.resultat_exploitation);
  const impots = safe(cr.impots);

  const MB = CA - achats;
  const EBITDA = MB - charges_personnel - charges_externes;
  const bx = extractBilan(bil);
  const total_actif = bx.total_actif;
  const CP = bx.capitaux_propres;
  const dettes = bx.dettes;
  const AC = bx.actif_circulant;
  const PC = bx.passif_circulant;
  const stocks = bx.stocks;
  const creances = bx.creances_clients;
  const fournisseurs = bx.dettes_fournisseurs;
  const tresorerie = bx.tresorerie;
  const effectif = safe(inputs.effectif_total || (inputs.equipe || []).reduce((s, e) => s + safe(e.nombre), 0));

  // Charges mensuelles pour runway
  const charges_mensuelles = (achats + charges_personnel + charges_externes) / 12;

  // Service dette annuel (capital + intérêts)
  let service_dette_annuel = 0;
  if (inputs.financement?.prets) {
    for (const p of inputs.financement.prets) {
      const montant = safe(p.montant);
      const duree_ans = safe(p.duree_mois) / 12 || 3;
      const taux = safe(p.taux_pct) / 100;
      service_dette_annuel += (montant / duree_ans) + (montant * taux);
    }
  }

  // DSO/DIO/DPO — priorité aux données bfr, sinon calcul
  const dso = safe(bfr.delai_clients_jours) || (CA > 0 ? (creances / CA) * 365 : 0);
  const dio = safe(bfr.stock_moyen_jours) || (achats > 0 ? (stocks / achats) * 365 : 0);
  const dpo = safe(bfr.delai_fournisseurs_jours) || (achats > 0 ? (fournisseurs / achats) * 365 : 0);

  const cashflow_op = EBITDA - impots + amort; // simplified

  return {
    rentabilite: {
      marge_brute_pct: round(pct(MB, CA), 1),
      marge_ebitda_pct: round(pct(EBITDA, CA), 1),
      marge_nette_pct: round(pct(RN, CA), 1),
      roa: round(pct(RN, total_actif), 1),
      roe: round(pct(RN, CP), 1),
      couverture_interets: charges_fin > 0 ? round(EBITDA / charges_fin, 1) : null,
    },
    liquidite: {
      ratio_courant: PC > 0 ? round(AC / PC, 1) : null,
      ratio_rapide: PC > 0 ? round((AC - stocks) / PC, 1) : null,
      bfr_jours: round(dso + dio - dpo, 0),
      runway_mois: charges_mensuelles > 0 ? round(tresorerie / charges_mensuelles, 1) : null,
      tresorerie_nette: round(tresorerie - dettes),
      cashflow_operationnel: round(cashflow_op),
    },
    solvabilite: {
      endettement_pct: round(pct(dettes, total_actif), 1),
      autonomie_financiere_pct: round(pct(CP, total_actif), 1),
      capacite_remboursement_ans: EBITDA > 0 ? round((dettes - tresorerie) / EBITDA, 1) : null,
      gearing: CP > 0 ? round(dettes / CP, 1) : null,
      dscr: service_dette_annuel > 0 ? round(cashflow_op / service_dette_annuel, 2) : null,
    },
    cycle_exploitation: {
      dso: round(dso, 1),
      dio: round(dio, 1),
      dpo: round(dpo, 1),
      cycle_tresorerie: round(dso + dio - dpo, 1),
      ca_par_employe: effectif > 0 ? round(CA / effectif) : 0,
    },
  };
}

// ─── SEUIL DE RENTABILITÉ ──────────────────────────────────────────

export function computeSeuilRentabilite(inputs: InputsData): SeuilRentabilite {
  const cr = inputs.compte_resultat || {};
  const CA = safe(cr.chiffre_affaires || cr.ca || inputs.revenue);

  // Coûts variables = achats matières (TOUJOURS depuis le CdR)
  const couts_variables = safe(cr.achats_matieres || cr.achats);

  // Coûts fixes = charges personnel + charges externes + amortissements (TOUJOURS depuis le CdR)
  const couts_fixes = safe(cr.charges_personnel || cr.salaires)
    + safe(cr.charges_externes)
    + safe(cr.dotations_amortissements);

  const taux_cv = CA > 0 ? couts_variables / CA : 0.5;
  const seuil = taux_cv < 1 ? couts_fixes / (1 - taux_cv) : 0;

  return {
    seuil_annuel: round(seuil),
    ca_actuel: round(CA),
    marge_securite_pct: CA > 0 && seuil > 0 ? round(((CA - seuil) / CA) * 100, 1) : 0,
  };
}

// ─── RENTABILITÉ PAR ACTIVITÉ ─────────────────────────────────────

export function computeRentabiliteParActivite(
  produits: ProductProjection[],
  services: ProductProjection[],
  opexTotal: number,
  CA: number,
): Array<{ activite: string; ca: number; pct_ca: number; couts_directs: number; marge_brute: number; marge_pct: number; ebe: number }> {
  const allProducts = [...produits, ...services];
  if (allProducts.length === 0) return [];

  return allProducts.map(p => {
    const cy = p.par_annee?.find(a => a.annee === "CURRENT YEAR") || p.par_annee?.[2];
    if (!cy) return null;
    const ca_prod = cy.ca || 0;
    const cogs = cy.cogs_total || 0;
    const marge = ca_prod - cogs;
    const pct_ca = CA > 0 ? (ca_prod / CA) * 100 : 0;
    const marge_pct = ca_prod > 0 ? (marge / ca_prod) * 100 : 0;
    const opex_alloue = CA > 0 ? opexTotal * (ca_prod / CA) : 0;
    const ebe = marge - opex_alloue;
    return {
      activite: p.nom,
      ca: round(ca_prod),
      pct_ca: round(pct_ca, 1),
      couts_directs: round(cogs),
      marge_brute: round(marge),
      marge_pct: round(marge_pct, 1),
      ebe: round(ebe),
    };
  }).filter(Boolean) as any[];
}

// ─── RATIOS VS BENCHMARKS ────────────────────────────────────────

export function computeRatiosVsBenchmarks(
  ratios: RatiosSanteFinanciere,
  guardrails: { marge_brute_min: number; marge_brute_max: number; marge_ebitda_min: number; marge_ebitda_max: number; ratio_personnel_ca_min: number; ratio_personnel_ca_max: number },
  chargesPersonnel: number,
  CA: number,
): Array<{ label: string; valeur: string; benchmark: string; statut: string }> {
  const result: Array<{ label: string; valeur: string; benchmark: string; statut: string }> = [];

  const mb = ratios.rentabilite.marge_brute_pct;
  result.push({
    label: "Marge brute",
    valeur: `${mb}%`,
    benchmark: `${guardrails.marge_brute_min}-${guardrails.marge_brute_max}%`,
    statut: mb >= guardrails.marge_brute_min ? (mb <= guardrails.marge_brute_max ? "ok" : "attention") : (mb < guardrails.marge_brute_min * 0.7 ? "critique" : "sous"),
  });

  const ebitda = ratios.rentabilite.marge_ebitda_pct;
  result.push({
    label: "Marge EBITDA",
    valeur: `${ebitda}%`,
    benchmark: `${guardrails.marge_ebitda_min}-${guardrails.marge_ebitda_max}%`,
    statut: ebitda >= guardrails.marge_ebitda_min ? "ok" : (ebitda < guardrails.marge_ebitda_min * 0.5 ? "critique" : "sous"),
  });

  const ratioPerso = CA > 0 ? round((chargesPersonnel / CA) * 100, 1) : 0;
  result.push({
    label: "Charges personnel / CA",
    valeur: `${ratioPerso}%`,
    benchmark: `${guardrails.ratio_personnel_ca_min}-${guardrails.ratio_personnel_ca_max}%`,
    statut: ratioPerso <= guardrails.ratio_personnel_ca_max ? "ok" : (ratioPerso > guardrails.ratio_personnel_ca_max * 1.3 ? "critique" : "attention"),
  });

  const dscr = ratios.solvabilite.dscr;
  if (dscr != null) {
    result.push({
      label: "DSCR",
      valeur: `${dscr}x`,
      benchmark: "≥ 1.5x",
      statut: dscr >= 1.5 ? "ok" : (dscr < 1.2 ? "critique" : "attention"),
    });
  }

  const endettement = ratios.solvabilite.endettement_pct;
  if (endettement > 0) {
    result.push({
      label: "Endettement / Actif",
      valeur: `${endettement}%`,
      benchmark: "< 60%",
      statut: endettement <= 60 ? "ok" : (endettement > 80 ? "critique" : "attention"),
    });
  }

  return result;
}

// ─── OPEX CATEGORIES ─────────────────────────────────────────────

export function computeOpexCategories(
  opex: Record<string, Record<string, number[]>>,
): Array<{ poste: string; montant: number; pct: number }> {
  const LABELS: Record<string, string> = {
    marketing: "Marketing & Communication",
    taxes_on_staff: "Taxes sur salaires",
    office: "Locaux & bureaux",
    other: "Autres charges",
    travel: "Déplacements",
    insurance: "Assurances",
    maintenance: "Maintenance",
    third_parties: "Tiers & sous-traitance",
  };

  const categories: Array<{ poste: string; montant: number }> = [];
  for (const [cat, subs] of Object.entries(opex)) {
    let totalCY = 0;
    for (const [, values] of Object.entries(subs)) {
      if (Array.isArray(values) && values.length >= 4) {
        totalCY += (values[2] || 0) + (values[3] || 0);
      }
    }
    if (totalCY > 0) {
      categories.push({ poste: LABELS[cat] || cat, montant: Math.round(totalCY) });
    }
  }

  const total = categories.reduce((s, c) => s + c.montant, 0) || 1;
  return categories.map(c => ({
    poste: c.poste,
    montant: c.montant,
    pct: round((c.montant / total) * 100, 1),
  })).sort((a, b) => b.montant - a.montant);
}

// ─── OPEX DETAIL ─────────────────────────────────────────────────

export function computeOpexDetail(
  opex: Record<string, Record<string, number[]>>,
): Array<{ categorie: string; sous_poste: string; montant_cy: number; montant_y5: number }> {
  const detail: Array<{ categorie: string; sous_poste: string; montant_cy: number; montant_y5: number }> = [];
  for (const [cat, subs] of Object.entries(opex)) {
    for (const [subKey, values] of Object.entries(subs)) {
      if (Array.isArray(values) && values.length >= 9) {
        const cy = (values[2] || 0) + (values[3] || 0);
        const y5 = values[8] || 0;
        if (cy > 0 || y5 > 0) {
          detail.push({
            categorie: cat,
            sous_poste: subKey.replace(/_/g, " "),
            montant_cy: Math.round(cy),
            montant_y5: Math.round(y5),
          });
        }
      }
    }
  }
  return detail;
}

// ─── ECHEANCIER DETTE ────────────────────────────────────────────

export function computeEcheancier(
  loans: { ovo: { amount: number; rate: number; term_years: number }; family: { amount: number; rate: number; term_years: number }; bank: { amount: number; rate: number; term_years: number } },
  projections: Projection[],
  currentYear: number,
): Array<{ label: string; is_total?: boolean; is_dscr?: boolean; dim?: boolean; annees: Array<{ annee: number; valeur: string }> }> {
  if (loans.ovo.amount === 0 && loans.bank.amount === 0 && loans.family.amount === 0) return [];

  const years = [currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5];
  const rows: any[] = [];
  const totalServiceByYear = years.map(() => 0);

  const allLoans = [
    { name: "Prêt OVO", ...loans.ovo },
    { name: "Prêt bancaire", ...loans.bank },
    { name: "Prêt famille", ...loans.family },
  ].filter(l => l.amount > 0);

  for (const loan of allLoans) {
    const annuity = loan.term_years > 0 ? loan.amount / loan.term_years : 0;
    const annees = years.map((y, i) => {
      const remaining = Math.max(0, loan.term_years - i);
      if (remaining <= 0) return { annee: y, valeur: "—" };
      const capital = Math.round(annuity);
      const interest = Math.round(loan.amount * loan.rate * Math.max(0, 1 - i / loan.term_years));
      const total = capital + interest;
      totalServiceByYear[i] += total;
      return { annee: y, valeur: `${Math.round(total / 1000000)}M` };
    });
    rows.push({ label: loan.name, dim: true, annees });
  }

  rows.push({
    label: "Service dette total",
    is_total: true,
    annees: years.map((y, i) => ({ annee: y, valeur: `${Math.round(totalServiceByYear[i] / 1000000)}M` })),
  });

  const projectedYears = projections.filter(p => !p.is_reel);
  rows.push({
    label: "DSCR",
    is_dscr: true,
    annees: years.map((y, i) => {
      const proj = projectedYears[i];
      const service = totalServiceByYear[i];
      const dscr = service > 0 && proj ? round(proj.ebitda / service, 1) : 0;
      return { annee: y, valeur: dscr > 0 ? `${dscr}x` : "—" };
    }),
  });

  return rows;
}

// ─── BFR DETAIL ──────────────────────────────────────────────────

export function computeBfrDetail(
  inputs: InputsData,
  projections: Projection[],
): { delai_clients_jours: number; delai_fournisseurs_jours: number; stock_moyen_jours: number; bfr_montant: number; bfr_jours: number; variation_bfr: number } | null {
  const bfr = inputs.bfr;
  if (!bfr) return null;

  const dso = safe(bfr.delai_clients_jours) || 30;
  const dpo = safe(bfr.delai_fournisseurs_jours) || 45;
  const dio = safe(bfr.stock_moyen_jours) || 30;
  const bfrJours = dso + dio - dpo;

  const cy = projections.find(p => p.annee === "CURRENT YEAR");
  const ca_mensuel = cy ? cy.ca / 12 : 0;
  const bfr_montant = Math.round(ca_mensuel * bfrJours / 30);

  const ym1 = projections.find(p => p.annee === "YEAR-1");
  const ca_mens_ym1 = ym1 ? ym1.ca / 12 : 0;
  const bfr_ym1 = Math.round(ca_mens_ym1 * bfrJours / 30);
  const variation = bfr_montant - bfr_ym1;

  return {
    delai_clients_jours: dso,
    delai_fournisseurs_jours: dpo,
    stock_moyen_jours: dio,
    bfr_montant,
    bfr_jours: bfrJours,
    variation_bfr: variation,
  };
}

// ─── PROJECTIONS 8 ANS ────────────────────────────────────────────

export function computeProjections(
  inputs: InputsData,
  hyp: AIHypotheses,
  currentYear: number,
  taxRate: number = 0.25,
): Projection[] {
  const cr = inputs.compte_resultat || {};
  const hist = inputs.historique_3ans || {};

  // ═══ ANNÉE COURANTE : toujours depuis le CdR ═══
  const CA_reel = safe(cr.chiffre_affaires || cr.ca || inputs.revenue);
  const achats_reel = safe(cr.achats_matieres || cr.achats);
  const charges_pers_reel = safe(cr.charges_personnel || cr.salaires);
  const charges_ext_reel = safe(cr.charges_externes);
  const amort_reel = safe(cr.dotations_amortissements);
  const charges_fin_reel = safe(cr.charges_financieres);
  const impots_reel = safe(cr.impots);
  const RE_reel = safe(cr.resultat_exploitation);
  const RN_reel = safe(cr.resultat_net);
  const OPEX_reel = charges_pers_reel + charges_ext_reel;

  // ═══ ANNÉE DE BASE : depuis l'historique, PAS new Date() ═══
  const baseYear = safe(hist.n?.annee) || currentYear;

  const yearNums = [
    baseYear - 2, baseYear - 1, baseYear,
    baseYear + 1, baseYear + 2, baseYear + 3, baseYear + 4, baseYear + 5,
  ];

  const projections: Projection[] = [];

  for (let i = 0; i < 8; i++) {
    const label = YEAR_LABELS[i];
    const yearNum = yearNums[i];
    const isReel = i <= 2;

    let ca: number, cogs: number, opex: number, amort: number, charges_fin: number, impots_y: number;

    if (i === 2) {
      // ═══ CY : DONNÉES RÉELLES DU COMPTE DE RÉSULTAT ═══
      ca = CA_reel;
      cogs = achats_reel;
      opex = OPEX_reel;
      amort = amort_reel;
      charges_fin = charges_fin_reel;
      impots_y = impots_reel || (RE_reel > RN_reel ? RE_reel - RN_reel - charges_fin_reel : 0);

    } else if (i === 1) {
      // ═══ Y-1 : DONNÉES RÉELLES historique_3ans.n_moins_1 ═══
      const h = hist.n_moins_1;
      if (h?.ca_total) {
        ca = safe(h.ca_total);
        cogs = safe(h.couts_variables);
        opex = safe(h.charges_fixes);
        amort = 0;
        charges_fin = 0;
        const re_h = safe(h.resultat_exploitation);
        const rn_h = safe(h.resultat_net);
        impots_y = re_h > rn_h ? re_h - rn_h : 0;
      } else {
        // Fallback : estimer prudemment depuis CY
        ca = roundK(CA_reel * 0.92);
        cogs = roundK(ca * (achats_reel / (CA_reel || 1)));
        opex = roundK(OPEX_reel * 0.90);
        amort = 0; charges_fin = 0; impots_y = 0;
      }

    } else if (i === 0) {
      // ═══ Y-2 : DONNÉES RÉELLES historique_3ans.n_moins_2 ═══
      const h = hist.n_moins_2;
      if (h?.ca_total) {
        ca = safe(h.ca_total);
        cogs = safe(h.couts_variables);
        opex = safe(h.charges_fixes);
        amort = 0;
        charges_fin = 0;
        const re_h = safe(h.resultat_exploitation);
        const rn_h = safe(h.resultat_net);
        impots_y = re_h > rn_h ? re_h - rn_h : 0;
      } else {
        // Fallback : estimer depuis Y-1 ou CY
        const ym1Ca = hist.n_moins_1?.ca_total || CA_reel * 0.92;
        ca = roundK(safe(ym1Ca) * 0.90);
        cogs = roundK(ca * (achats_reel / (CA_reel || 1)));
        opex = roundK(OPEX_reel * 0.80);
        amort = 0; charges_fin = 0; impots_y = 0;
      }

    } else {
      // ═══ PROJECTIONS Y+1 à Y+5 ═══
      const projIdx = i - 3; // 0,1,2,3,4
      const prevProj = projections[i - 1];

      const growthCa = hyp.taux_croissance_ca[Math.min(projIdx, hyp.taux_croissance_ca.length - 1)] || 0.15;
      const cogsRate = hyp.taux_cogs_cible[Math.min(projIdx, hyp.taux_cogs_cible.length - 1)] || (achats_reel / (CA_reel || 1));

      ca = roundK(prevProj.ca * (1 + growthCa));
      cogs = roundK(ca * cogsRate);
      opex = roundK(prevProj.opex_total * (1 + hyp.taux_croissance_opex));
      amort = roundK(amort_reel * (1 + 0.05 * (projIdx + 1)));
      charges_fin = roundK(charges_fin_reel * Math.max(0.3, 1 - projIdx * 0.15));
      const re_proj = (ca - cogs) - opex - amort - charges_fin;
      impots_y = re_proj > 0 ? roundK(re_proj * taxRate) : 0;
    }

    let mb = ca - cogs;
    let ebitda = mb - opex;
    let re = ebitda - amort;
    let rn = re - charges_fin - impots_y;
    let cf = rn + amort;

    // P7 — Pour CY, overrider RE et RN avec les valeurs RÉELLES du CdR
    if (i === 2) {
      if (RE_reel > 0) re = RE_reel;
      if (RN_reel > 0) {
        rn = RN_reel;
        impots_y = RE_reel > 0 ? RE_reel - RN_reel - charges_fin : Math.max(0, re - rn - charges_fin);
      }
      cf = rn + amort;
    }

    projections.push({
      annee: label,
      annee_num: yearNum,
      is_reel: isReel,
      ca: round(ca),
      cogs: round(cogs),
      marge_brute: round(mb),
      marge_brute_pct: round(pct(mb, ca), 1),
      opex_total: round(opex),
      ebitda: round(ebitda),
      ebitda_pct: round(pct(ebitda, ca), 1),
      amortissements: round(amort),
      resultat_exploitation: round(re),
      charges_financieres: round(charges_fin),
      impots: round(impots_y),
      resultat_net: round(rn),
      cashflow: round(cf),
    });
  }

  return projections;
}

// ─── INDICATEURS DE DÉCISION ──────────────────────────────────────

export function computeIndicateurs(
  projections: Projection[],
  investissement_total: number,
  taux_actualisation: number = 0.15,
): IndicateursDecision {
  // Cashflows projetés (Y+1 à Y+5)
  const cashflows = projections.filter(p => !p.is_reel).map(p => p.cashflow);

  // VAN
  let van: number | null = null;
  if (cashflows.length > 0 && investissement_total > 0) {
    van = -investissement_total;
    for (let i = 0; i < cashflows.length; i++) {
      van += cashflows[i] / Math.pow(1 + taux_actualisation, i + 1);
    }
    van = round(van);
  }

  // TRI (Newton-Raphson)
  let tri: number | null = null;
  if (cashflows.length > 0 && investissement_total > 0) {
    let rate = 0.15;
    for (let iter = 0; iter < 100; iter++) {
      let npv = -investissement_total;
      let dnpv = 0;
      for (let i = 0; i < cashflows.length; i++) {
        const t = i + 1;
        const d = Math.pow(1 + rate, t);
        npv += cashflows[i] / d;
        dnpv -= t * cashflows[i] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(npv) < 1) { tri = round(rate * 100, 1); break; }
      if (dnpv === 0) break;
      rate -= npv / dnpv;
      if (rate < -0.99 || rate > 10) break;
    }
  }

  // Payback
  let payback: number | null = null;
  if (investissement_total > 0) {
    let cumul = 0;
    for (let i = 0; i < cashflows.length; i++) {
      cumul += cashflows[i];
      if (cumul >= investissement_total) {
        payback = round(i + 1 - (cumul - investissement_total) / cashflows[i], 1);
        break;
      }
    }
  }

  // DSCR moyen sur la période
  // Simplified: cashflow / service dette estimé
  const dscr_values = projections.filter(p => !p.is_reel).map(p => {
    const service = p.charges_financieres + (investissement_total / 5); // rough capital + interest
    return service > 0 ? p.cashflow / service : 0;
  });
  const dscr_moyen = dscr_values.length > 0 ? round(dscr_values.reduce((a, b) => a + b, 0) / dscr_values.length, 2) : null;

  // ROI
  const cumul_cashflows = cashflows.reduce((a, b) => a + b, 0);
  const roi = investissement_total > 0 ? round(((cumul_cashflows - investissement_total) / investissement_total) * 100, 1) : null;

  // Couverture intérêts (année courante)
  const cy = projections.find(p => p.annee === "CURRENT YEAR");
  const couv = cy && cy.charges_financieres > 0 ? round(cy.ebitda / cy.charges_financieres, 1) : null;

  // Cycle tréso et runway (from current year)
  const cycle = cy ? 0 : 0; // computed in ratios
  const runway = null; // computed in ratios

  return { van, tri, payback_years: payback, dscr_moyen, roi, couverture_interets: couv, cycle_tresorerie: 0, runway_mois: null };
}

// ─── PRODUITS — PROJECTION PAR ANNÉE ──────────────────────────────

export function computeProductProjections(
  aiProducts: Array<{
    nom: string; prix_unitaire: number; cout_unitaire: number;
    volume_annuel: number; taux_croissance_volume: number;
    taux_croissance_prix?: number; part_ca: number;
    range_flags?: number[]; channel_flags?: number[];
    volume_ym2?: number; volume_ym1?: number;
  }>,
  currentYear: number,
  inflation: number = 0.03,
  historique?: InputsData['historique_3ans'],
): ProductProjection[] {
  // P9 — Scale factor for historical years using real CA
  const ca_total_cy = aiProducts.reduce((s, p) => s + (p.prix_unitaire || 0) * (p.volume_annuel || 0), 0);
  const ca_hist_ym1 = safe(historique?.n_moins_1?.ca_total);
  const ca_hist_ym2 = safe(historique?.n_moins_2?.ca_total);
  const scale_ym1 = ca_total_cy > 0 && ca_hist_ym1 > 0 ? ca_hist_ym1 / ca_total_cy : 1;
  const scale_ym2 = ca_total_cy > 0 && ca_hist_ym2 > 0 ? ca_hist_ym2 / ca_total_cy : 1;

  return aiProducts.map(p => {
    const pg = p.taux_croissance_prix || inflation;
    const g = p.taux_croissance_volume;
    const rf = p.range_flags || [1, 0, 0];
    const cf = p.channel_flags || [0, 1];
    const totalCh = (cf[0] || 0) + (cf[1] || 0) || 1;
    const mixCh1 = (cf[0] || 0) / totalCh;
    const mixCh2 = (cf[1] || 0) / totalCh;

    // Use historique scaling if available, otherwise fallback to growth-based extrapolation
    const volYM2 = p.volume_ym2 || (ca_hist_ym2 > 0
      ? Math.round(p.volume_annuel * scale_ym2)
      : (p.volume_annuel > 0 ? Math.round(p.volume_annuel / Math.pow(1 + g, 2)) : 0));
    const volYM1 = p.volume_ym1 || (ca_hist_ym1 > 0
      ? Math.round(p.volume_annuel * scale_ym1)
      : (p.volume_annuel > 0 ? Math.round(p.volume_annuel / (1 + g)) : 0));

    const yearConfigs = [
      { label: "YEAR-2", yearNum: currentYear - 2, volume: volYM2, priceMul: 1 / ((1 + pg) * (1 + pg)) },
      { label: "YEAR-1", yearNum: currentYear - 1, volume: volYM1, priceMul: 1 / (1 + pg) },
      { label: "CURRENT YEAR", yearNum: currentYear, volume: p.volume_annuel, priceMul: 1 },
      { label: "YEAR2", yearNum: currentYear + 1, volume: Math.round(p.volume_annuel * (1 + g)), priceMul: 1 + pg },
      { label: "YEAR3", yearNum: currentYear + 2, volume: Math.round(p.volume_annuel * Math.pow(1 + g, 2)), priceMul: Math.pow(1 + pg, 2) },
      { label: "YEAR4", yearNum: currentYear + 3, volume: Math.round(p.volume_annuel * Math.pow(1 + g, 3)), priceMul: Math.pow(1 + pg, 3) },
      { label: "YEAR5", yearNum: currentYear + 4, volume: Math.round(p.volume_annuel * Math.pow(1 + g, 4)), priceMul: Math.pow(1 + pg, 4) },
      { label: "YEAR6", yearNum: currentYear + 5, volume: Math.round(p.volume_annuel * Math.pow(1 + g, 5)), priceMul: Math.pow(1 + pg, 5) },
    ];

    const par_annee: YearProductData[] = yearConfigs.map(yc => {
      const rawPrice = p.prix_unitaire * yc.priceMul;
      const price = rawPrice < 1000 ? round(rawPrice) : roundK(rawPrice);
      const rawCogs = p.cout_unitaire * yc.priceMul;
      const cogsUnit = rawCogs < 1000 ? round(rawCogs) : roundK(rawCogs);
      const vol = yc.volume;
      const q1 = Math.round(vol * 0.22);
      const q2 = Math.round(vol * 0.25);
      const q3 = Math.round(vol * 0.27);
      const q4 = vol - q1 - q2 - q3;

      return {
        annee: yc.label,
        annee_num: yc.yearNum,
        volume: vol,
        prix_r1: rf[0] ? price : 0,
        prix_r2: rf[1] ? price : 0,
        prix_r3: rf[2] ? price : 0,
        cogs_r1: rf[0] ? cogsUnit : 0,
        cogs_r2: rf[1] ? cogsUnit : 0,
        cogs_r3: rf[2] ? cogsUnit : 0,
        mix_r1: rf[0] ? 1.0 : 0,
        mix_r2: rf[1] ? 1.0 : 0,
        mix_r3: rf[2] ? 1.0 : 0,
        mix_ch1: mixCh1,
        mix_ch2: mixCh2,
        volume_q1: q1,
        volume_q2: q2,
        volume_q3: q3,
        volume_q4: q4,
        ca: vol * price,
        cogs_total: vol * cogsUnit,
        marge_brute: vol * (price - cogsUnit),
      };
    });

    return {
      nom: p.nom,
      prix_unitaire: p.prix_unitaire,
      cout_unitaire: p.cout_unitaire,
      volume_annuel: p.volume_annuel,
      taux_croissance_volume: g,
      taux_croissance_prix: pg,
      part_ca: p.part_ca,
      par_annee,
    };
  });
}

// ─── STAFF — PROJECTION PAR ANNÉE ─────────────────────────────────

export function computeStaffProjections(
  aiStaff: Array<{
    categorie: string; departement?: string;
    effectif_actuel: number; effectif_cible_an5: number;
    salaire_mensuel: number; taux_charges_sociales: number;
    taux_croissance_salariale?: number;
    primes_annuelles?: number;
  }>,
  currentYear: number,
  taux_croissance_salariale: number = 0.05,
): StaffProjection[] {
  return aiStaff.map(s => {
    const sg = s.taux_croissance_salariale || taux_croissance_salariale;
    const effActuel = s.effectif_actuel;
    const effCible = s.effectif_cible_an5;
    const delta = effCible - effActuel;

    // Linear interpolation for headcount over 8 years
    const headcounts = [
      Math.round(effActuel / Math.pow(1.05, 2)),  // Y-2
      Math.round(effActuel / 1.05),                // Y-1
      effActuel,                                    // CY
      Math.round(effActuel + delta * 0.2),         // Y+1
      Math.round(effActuel + delta * 0.4),         // Y+2
      Math.round(effActuel + delta * 0.6),         // Y+3
      Math.round(effActuel + delta * 0.8),         // Y+4
      effCible,                                    // Y+5
    ];

    const salaryMults = [
      1 / ((1 + sg) * (1 + sg)), 1 / (1 + sg), 1,
      1 + sg, Math.pow(1 + sg, 2), Math.pow(1 + sg, 3), Math.pow(1 + sg, 4), Math.pow(1 + sg, 5),
    ];

    const par_annee = YEAR_LABELS.map((label, i) => ({
      annee: label,
      effectif: headcounts[i],
      salaire_mensuel_brut: roundK(s.salaire_mensuel * salaryMults[i]),
      primes_annuelles: roundK((s.primes_annuelles || 0) * salaryMults[i]),
      charges_sociales_mensuelles: roundK(s.salaire_mensuel * salaryMults[i] * s.taux_charges_sociales),
    }));

    return {
      categorie: s.categorie,
      departement: s.departement || "GENERAL",
      taux_charges_sociales: s.taux_charges_sociales,
      par_annee,
    };
  });
}

// ─── OPEX — EXPANSION PAR CATÉGORIE ──────────────────────────────

const OPEX_SPLITS: Record<string, Record<string, number>> = {
  marketing: { research: 0.15, purchase_studies: 0.05, receptions: 0.20, documentation: 0.10, advertising: 0.50 },
  taxes_on_staff: { salaries_tax: 0.70, apprenticeship: 0.10, training: 0.15, other: 0.05 },
  office: { rent: 0.35, internet: 0.12, telecom: 0.10, supplies: 0.10, fuel: 0.08, water: 0.05, electricity: 0.15, cleaning: 0.05 },
  other: { health: 0.50, directors: 0.30, donations: 0.20 },
  insurance: { building: 0.30, company: 0.70 },
  maintenance: { movable: 0.60, other: 0.40 },
  third_parties: { legal: 0.25, accounting: 0.30, transport: 0.20, commissions: 0.15, delivery: 0.10 },
};

export function computeOpexExpanded(
  aiOpex: Record<string, { total_cy: number; growth: number }>,
): Record<string, Record<string, number[]>> {
  const result: Record<string, Record<string, number[]>> = {};

  for (const [category, catData] of Object.entries(aiOpex)) {
    if (category === "travel") {
      // Travel is special: nb_travellers + avg_cost
      const td = catData as any;
      const nbCY = td.nb_travellers_cy || td.total_cy || 0;
      const avgCY = td.avg_cost_cy || 200000;
      const growth = td.growth || 0.05;
      result.travel = {
        nb_travellers: buildTimeSeries10Int(nbCY, growth),
        avg_cost: buildTimeSeries10(avgCY, growth),
      };
      continue;
    }

    const totalCY = catData.total_cy || 0;
    const growth = catData.growth || 0.05;
    const splits = OPEX_SPLITS[category] || { main: 1.0 };
    const expanded: Record<string, number[]> = {};

    for (const [subKey, ratio] of Object.entries(splits)) {
      const subCY = roundK(totalCY * ratio);
      expanded[subKey] = buildTimeSeries10(subCY, growth);
    }

    result[category] = expanded;
  }

  return result;
}

// 10-value time series: [YM2, YM1, H1, H2, CY(0), Y2, Y3, Y4, Y5, Y6]
function buildTimeSeries10(valueCY: number, growth: number): number[] {
  const ym2 = roundK(valueCY / Math.pow(1 + growth, 2));
  const ym1 = roundK(valueCY / (1 + growth));
  const h1 = roundK(valueCY * 0.45);
  const h2 = roundK(valueCY * 0.55);
  const cy = 0; // CY total is formula in Excel
  const vals = [ym2, ym1, h1, h2, cy];
  for (let i = 1; i <= 5; i++) {
    vals.push(roundK(valueCY * Math.pow(1 + growth, i)));
  }
  return vals;
}

function buildTimeSeries10Int(valueCY: number, growth: number): number[] {
  const ym2 = Math.round(valueCY / Math.pow(1 + growth, 2));
  const ym1 = Math.round(valueCY / (1 + growth));
  const h1 = Math.round(valueCY * 0.5);
  const h2 = Math.round(valueCY * 0.5);
  const cy = 0;
  const vals = [ym2, ym1, h1, h2, cy];
  for (let i = 1; i <= 5; i++) {
    vals.push(Math.round(valueCY * Math.pow(1 + growth, i)));
  }
  return vals;
}

// ─── SCENARIOS ────────────────────────────────────────────────────

export function computeScenarios(
  ca_actuel: number,
  taux_pessimiste: number,
  taux_realiste: number,
  taux_optimiste: number,
  nbYears: number = 5,
): Record<string, number[]> {
  const build = (taux: number) => {
    const vals: number[] = [];
    let ca = ca_actuel;
    for (let i = 0; i < nbYears; i++) {
      ca = roundK(ca * (1 + taux));
      vals.push(ca);
    }
    return vals;
  };

  return {
    pessimiste: build(taux_pessimiste),
    realiste: build(taux_realiste),
    optimiste: build(taux_optimiste),
  };
}

// ─── ASSEMBLAGE FINAL ─────────────────────────────────────────────

export function computeFullPlan(
  inputs: InputsData,
  aiAnalysis: any,
  company: string,
  country: string,
  currentYear: number,
  fiscalParams: { tva: number; is: number; devise: string; currency_iso: string; exchange_rate_eur: number },
): PlanFinancierComputed {

  const hyp: AIHypotheses = {
    taux_croissance_ca: aiAnalysis.hypotheses?.taux_croissance_ca || [0.15, 0.15, 0.15, 0.12, 0.12],
    taux_croissance_prix: aiAnalysis.hypotheses?.taux_croissance_prix || 0.03,
    taux_croissance_opex: aiAnalysis.hypotheses?.taux_croissance_opex || 0.08,
    taux_croissance_salariale: aiAnalysis.hypotheses?.taux_croissance_salariale || 0.05,
    taux_cogs_cible: aiAnalysis.hypotheses?.taux_cogs_cible || [0.72, 0.71, 0.70, 0.70, 0.70],
    inflation: aiAnalysis.hypotheses?.inflation || 0.03,
  };

  // 0. Base year from historique
  const baseYearEarly = safe(inputs.historique_3ans?.n?.annee) || currentYear;

  // 1. Ratios situation actuelle
  const ratios = computeRatios(inputs);
  const seuil = computeSeuilRentabilite(inputs);

  // 2. Projections 8 ans
  const projections = computeProjections(inputs, hyp, baseYearEarly, fiscalParams.is / 100);

  // 3. Investissement total (depuis CAPEX IA)
  const capexItems = aiAnalysis.capex || [];
  const capex_total = capexItems.reduce((s: number, c: any) => s + safe(c.montant || c.acquisition_value), 0);

  // Investissement total = prêts + capital (PAS les CAPEX IA qui peuvent être incomplets)
  const prets_total = (inputs.financement?.prets || []).reduce((s, p) => s + safe(p.montant), 0);
  const capital_apport = safe(inputs.financement?.apports_capital);
  const investissement_total = prets_total + capital_apport || capex_total || 1;

  // 4. Indicateurs de décision
  // WACC simplifié par zone monétaire
  const WACC_PAR_ZONE: Record<string, number> = {
    'XOF': 0.18, 'XAF': 0.20, 'CDF': 0.25, 'GNF': 0.22,
  };
  const taux_actualisation = WACC_PAR_ZONE[fiscalParams.currency_iso] || 0.18;

  const indicateurs = computeIndicateurs(projections, investissement_total, taux_actualisation);
  // Merge cycle_tresorerie and runway from ratios
  indicateurs.cycle_tresorerie = ratios.cycle_exploitation.cycle_tresorerie;
  indicateurs.runway_mois = ratios.liquidite.runway_mois;

  // 5. Produits projetés — ESTIMATION CASCADE BIDIRECTIONNELLE
  const inputsProducts = (inputs as any).produits_services || [];
  const cr_for_enrich = inputs.compte_resultat || {};
  const CA_total = safe(cr_for_enrich.chiffre_affaires || cr_for_enrich.ca || inputs.revenue);

  // Phase 1: Match AI products with inputs_data products
  const aiProds = (aiAnalysis.produits || []).map((p: any) => {
    const match = inputsProducts.find((ip: any) =>
      ip.nom && p.nom && (ip.nom.toLowerCase().includes(p.nom.toLowerCase().slice(0, 10)) || p.nom.toLowerCase().includes(ip.nom.toLowerCase().slice(0, 10)))
    );
    if (match) {
      p._inputCA = safe(match.ca_estime || match.ca_annuel);
      p._inputVol = safe(match.volume_annuel);
      p._inputPrix = safe(match.prix_unitaire);
      p._inputPart = safe(match.part_ca_pct) / 100;
      p._inputMarge = safe(match.marge_pct) || 30;
    }
    return p;
  });

  // Phase 2: DESCENDANT — CA total → CA par produit via parts
  for (const p of aiProds) {
    if (!p._inputCA && p._inputPart > 0 && CA_total > 0) {
      p._inputCA = Math.round(CA_total * p._inputPart);
      console.log(`[cascade↓] ${p.nom}: CA=${p._inputCA} from part=${p._inputPart}`);
    }
  }

  // Phase 3: RÉSIDUEL — CA restant = CA_total - Σ connus
  const knownCA = aiProds.reduce((s: number, p: any) => s + (p._inputCA || 0), 0);
  const unknownProds = aiProds.filter((p: any) => !p._inputCA || p._inputCA === 0);
  if (unknownProds.length > 0 && CA_total > knownCA) {
    const residualCA = CA_total - knownCA;
    const perProd = Math.round(residualCA / unknownProds.length);
    for (const p of unknownProds) {
      // Only assign residual if product has no CA at all
      if (safe(p.prix_unitaire) > 0) {
        // Has prix, estimate CA as 1-5% of total
        p._inputCA = Math.round(CA_total * 0.02);
      }
      console.log(`[cascade↓] ${p.nom}: residual CA=${p._inputCA || 0}`);
    }
  }

  // Phase 4: CROISÉ + MONTANT — derive prix/vol from CA
  for (const p of aiProds) {
    const ca = p._inputCA || 0;
    let prix = safe(p.prix_unitaire) || safe(p._inputPrix);
    let vol = safe(p.volume_annuel) || safe(p._inputVol);
    const marge = p._inputMarge || 30;

    // Derive missing values
    if (ca > 0 && prix > 0 && vol === 0) {
      vol = Math.round(ca / prix);
    } else if (ca > 0 && vol > 0 && prix === 0) {
      prix = Math.round(ca / vol);
    } else if (ca > 0 && prix === 0 && vol === 0) {
      // Both missing: estimate prix as median for sector, derive vol
      prix = Math.max(1000, Math.round(ca / 10000));
      vol = Math.round(ca / prix);
    } else if (ca === 0 && prix > 0 && vol === 0) {
      // Startup: estimate minimal volume (1% CA / prix)
      const startupCA = Math.round(CA_total * 0.01);
      vol = Math.max(100, Math.round(startupCA / prix));
      console.log(`[cascade↑] ${p.nom}: startup vol=${vol} from 1% CA`);
    }

    // Apply
    if (prix > 0) p.prix_unitaire = prix;
    if (vol > 0) p.volume_annuel = vol;
    if (!safe(p.cout_unitaire) && prix > 0) {
      p.cout_unitaire = Math.round(prix * (1 - marge / 100));
    }
    if (ca > 0) p.part_ca = ca / (CA_total || 1);

    console.log(`[cascade✓] ${p.nom}: prix=${p.prix_unitaire} vol=${p.volume_annuel} cout=${p.cout_unitaire} CA≈${(p.prix_unitaire||0)*(p.volume_annuel||0)}`);
  }

  // Phase 5: COMPLÉTION — ajouter les produits de inputs_data que l'IA a ignorés
  const aiProdNames = new Set(aiProds.map((p: any) => p.nom?.toLowerCase().slice(0, 15)));
  for (const ip of inputsProducts) {
    const ipKey = ip.nom?.toLowerCase().slice(0, 15);
    if (ipKey && !aiProdNames.has(ipKey)) {
      // Check if any AI product matches this input product (fuzzy)
      const alreadyMatched = aiProds.some((p: any) =>
        p.nom && ip.nom && (p.nom.toLowerCase().includes(ipKey) || ipKey.includes(p.nom.toLowerCase().slice(0, 10)))
      );
      if (!alreadyMatched) {
        const ca = safe(ip.ca_estime || ip.ca_annuel);
        const prix = safe(ip.prix_unitaire) || (ca > 0 ? Math.max(1000, Math.round(ca / 10000)) : 1000);
        const vol = safe(ip.volume_annuel) || (ca > 0 && prix > 0 ? Math.round(ca / prix) : Math.max(100, Math.round(CA_total * 0.01 / prix)));
        const marge = safe(ip.marge_pct) || 30;
        const newProd = {
          nom: ip.nom,
          prix_unitaire: prix,
          cout_unitaire: Math.round(prix * (1 - marge / 100)),
          volume_annuel: vol,
          taux_croissance_volume: 0.15,
          taux_croissance_prix: 0.03,
          part_ca: ca > 0 ? ca / (CA_total || 1) : 0.01,
          range_flags: [1, 0, 0],
          channel_flags: [0, 1],
        };
        aiProds.push(newProd);
        console.log(`[cascade+] Added missing product: ${ip.nom} prix=${prix} vol=${vol}`);
      }
    }
  }

  const produits = computeProductProjections(aiProds, baseYearEarly, hyp.inflation, inputs.historique_3ans);
  const services = computeProductProjections(aiAnalysis.services || [], baseYearEarly, hyp.inflation, inputs.historique_3ans);

  // 6. Staff projeté
  const staff = computeStaffProjections(aiAnalysis.staff || [], baseYearEarly, hyp.taux_croissance_salariale);

  // 7. OPEX expanded
  const opex = computeOpexExpanded(aiAnalysis.opex || {});

  // 8. Scenarios
  const scenarios_taux = aiAnalysis.scenarios || {};
  const ca_cy = projections.find(p => p.annee === "CURRENT YEAR")?.ca || 0;
  const scenariosCalc = computeScenarios(
    ca_cy,
    scenarios_taux.pessimiste?.taux_croissance || 0.10,
    scenarios_taux.realiste?.taux_croissance || 0.20,
    scenarios_taux.optimiste?.taux_croissance || 0.28,
  );

  // 9. KPIs
  const cr = inputs.compte_resultat || {};
  const bil = inputs.bilan || {};
  const b = extractBilan(bil);
  const baseYear = safe(inputs.historique_3ans?.n?.annee) || currentYear;

  const kpis = {
    ca: safe(cr.chiffre_affaires || cr.ca || inputs.revenue),
    resultat_net: safe(cr.resultat_net),
    tresorerie: b.tresorerie || safe(inputs.bfr?.tresorerie_depart),
    effectif: safe(inputs.effectif_total
      || inputs.historique_3ans?.n?.nombre_employes
      || (inputs.equipe || []).reduce((s, e) => s + safe(e.nombre), 0)),
  };

  // 10. Compte de résultat réel formaté
  const CA = kpis.ca;
  const compte_resultat_reel = [
    { poste: "Chiffre d'affaires", valeurs: projections.filter(p => p.is_reel).map(p => p.ca), is_total: true },
    { poste: "Achats matières", valeurs: projections.filter(p => p.is_reel).map(p => p.cogs), is_total: false },
    { poste: "Marge brute", valeurs: projections.filter(p => p.is_reel).map(p => p.marge_brute), is_total: true },
    { poste: "OPEX total", valeurs: projections.filter(p => p.is_reel).map(p => p.opex_total), is_total: false },
    { poste: "EBITDA", valeurs: projections.filter(p => p.is_reel).map(p => p.ebitda), is_total: true },
    { poste: "Résultat net", valeurs: projections.filter(p => p.is_reel).map(p => p.resultat_net), is_total: true },
  ];

  // 11. Structure des coûts
  const couts_var = (inputs.couts_variables || []).map(c => ({
    poste: c.poste, montant: safe(c.montant_annuel || (c.montant_mensuel || 0) * 12),
  }));
  const couts_fix = (inputs.couts_fixes || []).map(c => ({
    poste: c.poste, montant: safe(c.montant_annuel || (c.montant_mensuel || 0) * 12),
  }));
  const total_var = couts_var.reduce((s, c) => s + c.montant, 0);
  const total_fix = couts_fix.reduce((s, c) => s + c.montant, 0);
  const total_couts = total_var + total_fix || 1;

  // 12. Years mapping (use baseYear from historique_3ans)
  const years: Record<string, number> = {
    year_minus_2: baseYear - 2, year_minus_1: baseYear - 1, current_year: baseYear,
    year2: baseYear + 1, year3: baseYear + 2, year4: baseYear + 3,
    year5: baseYear + 4, year6: baseYear + 5,
  };

  // 13. Loans
  const fin = inputs.financement || {};
  const prets = fin.prets || [];
  const findLoan = (src: string) => prets.find(p => (p.source || '').toLowerCase().includes(src)) || {};
  const loansOvo = findLoan('ovo');
  const loansFamily = findLoan('fam');
  const loansBank = findLoan('ban');

  // 14. Rentabilité par activité
  const opexReel = safe(cr.charges_personnel || cr.salaires) + safe(cr.charges_externes);
  const rentabiliteParActivite = computeRentabiliteParActivite(produits, services, opexReel, CA);

  // 15. OPEX catégories & détail
  const opexCategories = computeOpexCategories(opex);
  const opexDetail = computeOpexDetail(opex);

  // 16. Échéancier dette
  const loansForEcheancier = {
    ovo: { amount: safe(loansOvo.montant), rate: safe(loansOvo.taux_pct) / 100 || 0.07, term_years: safe(loansOvo.duree_mois) / 12 || 5 },
    family: { amount: safe(loansFamily.montant), rate: safe(loansFamily.taux_pct) / 100 || 0.10, term_years: safe(loansFamily.duree_mois) / 12 || 3 },
    bank: { amount: safe(loansBank.montant), rate: safe(loansBank.taux_pct) / 100 || 0.12, term_years: safe(loansBank.duree_mois) / 12 || 2 },
  };
  const echeancier = computeEcheancier(loansForEcheancier, projections, currentYear);

  // 17. BFR détaillé
  const bfrDetail = computeBfrDetail(inputs, projections);

  // 18. CAPEX formatted for Excel
  const capexFormatted = capexItems.map((c: any, i: number) => ({
    type: (c.categorie || "other").toUpperCase(),
    slot: i + 1,
    label: c.label || c.nature || `Investissement ${i + 1}`,
    categorie: c.categorie || "other",
    acquisition_year: c.annee || currentYear + 1,
    acquisition_value: safe(c.montant || c.acquisition_value),
    amortisation_rate: safe(c.taux_amortissement || 0.20),
  }));

  return {
    company,
    country,
    currency: fiscalParams.currency_iso,
    exchange_rate_eur: fiscalParams.exchange_rate_eur,
    vat_rate: fiscalParams.tva / 100,
    inflation_rate: hyp.inflation,
    tax_regime_1: 0.04,
    tax_regime_2: fiscalParams.is / 100,
    current_year: baseYearEarly,
    years,
    kpis,
    compte_resultat_reel,
    structure_couts: {
      variables: couts_var,
      fixes: couts_fix,
      pct_variables: round((total_var / total_couts) * 100, 1),
    },
    sante_financiere: ratios,
    seuil_rentabilite: seuil,
    projections,
    indicateurs_decision: indicateurs,
    produits,
    services,
    staff,
    ranges: aiAnalysis.ranges || [{ slot: 1, name: "STANDARD" }, { slot: 2, name: "-" }, { slot: 3, name: "-" }],
    channels: aiAnalysis.channels || [{ slot: 1, name: "B2B" }, { slot: 2, name: "B2C" }],
    opex,
    capex: capexFormatted,
    loans: {
      ovo: { amount: safe(loansOvo.montant), rate: safe(loansOvo.taux_pct) / 100 || 0.07, term_years: safe(loansOvo.duree_mois) / 12 || 5 },
      family: { amount: safe(loansFamily.montant), rate: safe(loansFamily.taux_pct) / 100 || 0.10, term_years: safe(loansFamily.duree_mois) / 12 || 3 },
      bank: { amount: safe(loansBank.montant), rate: safe(loansBank.taux_pct) / 100 || 0.12, term_years: safe(loansBank.duree_mois) / 12 || 2 },
    },
    financing: aiAnalysis.financing || {},
    working_capital: {
      stock_days: Array(10).fill(ratios.cycle_exploitation.dio),
      receivable_days: Array(10).fill(ratios.cycle_exploitation.dso),
      payable_days: Array(10).fill(ratios.cycle_exploitation.dpo),
    },
    scenarios: scenariosCalc,

    // Champs additionnels pour le frontend
    rentabilite_par_activite: rentabiliteParActivite,
    opex_categories: opexCategories,
    opex_detail: opexDetail,
    echeancier,
    bfr_detail: bfrDetail,
  };
}
