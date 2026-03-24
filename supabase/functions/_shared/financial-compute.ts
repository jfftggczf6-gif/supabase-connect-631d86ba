/**
 * financial-compute.ts — Module de calcul déterministe du Plan Financier
 * 
 * RÈGLE D'OR : Aucun appel IA ici. Tout est formule.
 * Entrées : données réelles (inputs_data) + hypothèses calibrées (de l'IA)
 * Sorties : ratios, projections, indicateurs — tout vérifiable
 */

// ─── TYPES ─────────────────────────────────────────────────────────

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
  const total_actif = safe(bil.total_actif);
  const CP = safe(bil.capitaux_propres);
  const dettes = safe(bil.dettes_totales || bil.dettes);
  const AC = safe(bil.actif_circulant);
  const PC = safe(bil.passif_circulant);
  const stocks = safe(bil.stocks);
  const creances = safe(bil.creances_clients);
  const fournisseurs = safe(bil.dettes_fournisseurs);
  const tresorerie = safe(bil.tresorerie);
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
  const achats = safe(cr.achats_matieres || cr.achats);

  // Coûts variables = achats matières + transport (approximation)
  let couts_variables = achats;
  if (inputs.couts_variables) {
    couts_variables = inputs.couts_variables.reduce((s, c) => s + safe(c.montant_annuel || (c.montant_mensuel || 0) * 12), 0);
  }

  // Coûts fixes = charges personnel + charges externes + amortissements
  let couts_fixes = safe(cr.charges_personnel || cr.salaires) + safe(cr.charges_externes) + safe(cr.dotations_amortissements);
  if (inputs.couts_fixes) {
    couts_fixes = inputs.couts_fixes.reduce((s, c) => s + safe(c.montant_annuel || (c.montant_mensuel || 0) * 12), 0);
  }

  const taux_cv = CA > 0 ? couts_variables / CA : 0.72;
  const seuil = taux_cv < 1 ? couts_fixes / (1 - taux_cv) : 0;

  return {
    seuil_annuel: round(seuil),
    ca_actuel: round(CA),
    marge_securite_pct: CA > 0 && seuil > 0 ? round(((CA - seuil) / CA) * 100, 1) : 0,
  };
}

// ─── PROJECTIONS 8 ANS ────────────────────────────────────────────

export function computeProjections(
  inputs: InputsData,
  hyp: AIHypotheses,
  currentYear: number,
): Projection[] {
  const cr = inputs.compte_resultat || {};
  const CA_reel = safe(cr.chiffre_affaires || cr.ca || inputs.revenue);
  const achats_reel = safe(cr.achats_matieres || cr.achats);
  const charges_pers_reel = safe(cr.charges_personnel || cr.salaires);
  const charges_ext_reel = safe(cr.charges_externes);
  const amort_reel = safe(cr.dotations_amortissements);
  const charges_fin_reel = safe(cr.charges_financieres);
  const impots_reel = safe(cr.impots);
  const RN_reel = safe(cr.resultat_net);

  const MB_reel = CA_reel - achats_reel;
  const OPEX_reel = charges_pers_reel + charges_ext_reel;
  const EBITDA_reel = MB_reel - OPEX_reel;
  const RE_reel = EBITDA_reel - amort_reel;

  // Build 8-year projections
  const projections: Projection[] = [];
  const yearNums = [
    currentYear - 2, currentYear - 1, currentYear,
    currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5,
  ];

  // For historical years (Y-2, Y-1), we'd need historical data
  // For now, we estimate backwards from current year
  const taux_hist = 0.15; // average historical growth assumption

  for (let i = 0; i < 8; i++) {
    const label = YEAR_LABELS[i];
    const yearNum = yearNums[i];
    const isReel = i <= 2; // Y-2, Y-1, CY are "real" (or reconstructed)

    let ca: number, cogs: number, opex: number, amort: number, charges_fin: number, impots_y: number;

    if (i === 2) {
      // CURRENT YEAR — données réelles
      ca = CA_reel;
      cogs = achats_reel;
      opex = OPEX_reel;
      amort = amort_reel;
      charges_fin = charges_fin_reel;
      impots_y = impots_reel;
    } else if (i < 2) {
      // HISTORICAL — reconstruit
      const yearsBack = 2 - i;
      ca = roundK(CA_reel / Math.pow(1 + taux_hist, yearsBack));
      const cogsRate = achats_reel / (CA_reel || 1);
      cogs = roundK(ca * cogsRate);
      opex = roundK(OPEX_reel / Math.pow(1 + hyp.taux_croissance_opex, yearsBack));
      amort = roundK(amort_reel * 0.9);
      charges_fin = roundK(charges_fin_reel);
      impots_y = roundK(impots_reel / Math.pow(1.1, yearsBack));
    } else {
      // PROJECTED (Y+1 to Y+5)
      const projIdx = i - 3; // 0,1,2,3,4
      const prevProj = projections[i - 1];

      const growthCa = hyp.taux_croissance_ca[Math.min(projIdx, hyp.taux_croissance_ca.length - 1)] || 0.15;
      const cogsRate = hyp.taux_cogs_cible[Math.min(projIdx, hyp.taux_cogs_cible.length - 1)] || 0.70;

      ca = roundK(prevProj.ca * (1 + growthCa));
      cogs = roundK(ca * cogsRate);
      opex = roundK(prevProj.opex_total * (1 + hyp.taux_croissance_opex));
      amort = roundK(amort_reel * (1 + 0.05 * (projIdx + 1))); // slow growth
      charges_fin = roundK(charges_fin_reel * Math.max(0.5, 1 - projIdx * 0.15)); // decreasing as loans repaid
      const re = (ca - cogs) - opex - amort - charges_fin;
      impots_y = re > 0 ? roundK(re * 0.25) : 0; // IS 25% simplified
    }

    const mb = ca - cogs;
    const ebitda = mb - opex;
    const re = ebitda - amort;
    const rn = re - charges_fin - impots_y;
    const cf = rn + amort;

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
): ProductProjection[] {
  return aiProducts.map(p => {
    const pg = p.taux_croissance_prix || inflation;
    const g = p.taux_croissance_volume;
    const rf = p.range_flags || [1, 0, 0];
    const cf = p.channel_flags || [0, 1];
    const totalCh = (cf[0] || 0) + (cf[1] || 0) || 1;
    const mixCh1 = (cf[0] || 0) / totalCh;
    const mixCh2 = (cf[1] || 0) / totalCh;

    const volYM2 = p.volume_ym2 || (p.volume_annuel > 0 ? Math.round(p.volume_annuel / Math.pow(1 + g, 2)) : 0);
    const volYM1 = p.volume_ym1 || (p.volume_annuel > 0 ? Math.round(p.volume_annuel / (1 + g)) : 0);

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
      const price = roundK(p.prix_unitaire * yc.priceMul);
      const cogsUnit = roundK(p.cout_unitaire * yc.priceMul);
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

  // 1. Ratios situation actuelle
  const ratios = computeRatios(inputs);
  const seuil = computeSeuilRentabilite(inputs);

  // 2. Projections 8 ans
  const projections = computeProjections(inputs, hyp, currentYear);

  // 3. Investissement total (depuis CAPEX IA)
  const capexItems = aiAnalysis.capex || [];
  const investissement_total = capexItems.reduce((s: number, c: any) => s + safe(c.montant || c.acquisition_value), 0);

  // 4. Indicateurs de décision
  const indicateurs = computeIndicateurs(projections, investissement_total);
  // Merge cycle_tresorerie and runway from ratios
  indicateurs.cycle_tresorerie = ratios.cycle_exploitation.cycle_tresorerie;
  indicateurs.runway_mois = ratios.liquidite.runway_mois;

  // 5. Produits projetés
  const produits = computeProductProjections(aiAnalysis.produits || [], currentYear, hyp.inflation);
  const services = computeProductProjections(aiAnalysis.services || [], currentYear, hyp.inflation);

  // 6. Staff projeté
  const staff = computeStaffProjections(aiAnalysis.staff || [], currentYear, hyp.taux_croissance_salariale);

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
  const kpis = {
    ca: safe(cr.chiffre_affaires || cr.ca || inputs.revenue),
    resultat_net: safe(cr.resultat_net),
    tresorerie: safe(bil.tresorerie),
    effectif: safe(inputs.effectif_total || (inputs.equipe || []).reduce((s, e) => s + safe(e.nombre), 0)),
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

  // 12. Years mapping
  const years: Record<string, number> = {
    year_minus_2: currentYear - 2, year_minus_1: currentYear - 1, current_year: currentYear,
    year2: currentYear + 1, year3: currentYear + 2, year4: currentYear + 3,
    year5: currentYear + 4, year6: currentYear + 5,
  };

  // 13. Loans
  const fin = inputs.financement || {};
  const prets = fin.prets || [];
  const findLoan = (src: string) => prets.find(p => (p.source || '').toLowerCase().includes(src)) || {};
  const loansOvo = findLoan('ovo');
  const loansFamily = findLoan('fam');
  const loansBank = findLoan('ban');

  // 14. CAPEX formatted for Excel
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
    current_year: currentYear,
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
  };
}
