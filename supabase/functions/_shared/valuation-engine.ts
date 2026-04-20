/**
 * VALUATION ENGINE — Calculs déterministes pour PME Afrique
 * 
 * 3 méthodes : DCF, Multiples EBITDA, Multiples CA
 * Décotes/primes calibrées
 * Synthèse dérivée mathématiquement
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ValuationInputs {
  ca_dernier_exercice: number;
  ebitda_dernier_exercice: number;
  resultat_net: number;
  tresorerie_nette: number;
  dette_financiere: number;
  cashflows_projetes: number[];
  ca_projetes: number[];
  ebitda_projetes: number[];
  pays: string;
  secteur: string;
  ca_historique_3ans: number[];
  effectifs: number;
  has_audit_externe: boolean;
  has_gouvernance_formelle: boolean;
  forme_juridique: string;
}

export interface ValuationResult {
  dcf: DCFResult;
  multiples: MultiplesResult;
  decotes_primes: DecotesPrimes;
  synthese: SyntheseResult;
  metadata: {
    inputs_quality: string;
    methodes_applicables: string[];
    date_calcul: string;
  };
}

interface DCFResult {
  wacc_pct: number;
  wacc_detail: {
    risk_free_rate: number;
    equity_risk_premium: number;
    size_premium: number;
    illiquidity_premium: number;
    cost_of_equity: number;
    cost_of_debt: number;
    debt_weight: number;
    equity_weight: number;
  };
  projections_cashflow: { annee: string; fcf: number }[];
  pv_cashflows: number;
  terminal_growth_rate: number;
  terminal_value: number;
  pv_terminal_value: number;
  enterprise_value: number;
  equity_value: number;
  sensitivity: {
    wacc_minus_2: number;
    wacc_base: number;
    wacc_plus_2: number;
    growth_minus_1: number;
    growth_plus_1: number;
  };
}

interface MultiplesResult {
  ebitda_dernier_exercice: number;
  ca_dernier_exercice: number;
  multiple_ebitda_retenu: number;
  multiple_ca_retenu: number;
  fourchette_ebitda: [number, number];
  fourchette_ca: [number, number];
  valeur_par_ebitda: number;
  valeur_par_ca: number;
  valeur_moyenne_multiples: number;
}

interface DecotesPrimes {
  decote_illiquidite_pct: number;
  decote_taille_pct: number;
  decote_gouvernance_pct: number;
  prime_croissance_pct: number;
  ajustement_total_pct: number;
  detail: string[];
}

interface SyntheseResult {
  valeur_basse: number;
  valeur_mediane: number;
  valeur_haute: number;
  valeurs_par_methode: { methode: string; brute: number; ajustee: number }[];
  methode_privilegiee: string;
}

// ═══════════════════════════════════════════════════════
// PARAMÈTRES PAR ZONE GÉOGRAPHIQUE (fallback si knowledge_risk_params indispo)
// ═══════════════════════════════════════════════════════

export interface WaccZoneParams {
  risk_free: number;
  erp_min: number;
  erp_max: number;
  size_min: number;
  size_max: number;
  illiq_min: number;
  illiq_max: number;
  cost_of_debt: number;
  tax_rate: number;
}

const WACC_PARAMS: Record<string, WaccZoneParams> = {
  uemoa:       { risk_free: 3.0, erp_min: 8,  erp_max: 10, size_min: 3, size_max: 5, illiq_min: 2, illiq_max: 4, cost_of_debt: 8.0,  tax_rate: 0.25 },
  cemac:       { risk_free: 3.0, erp_min: 9,  erp_max: 12, size_min: 3, size_max: 5, illiq_min: 3, illiq_max: 5, cost_of_debt: 10.0, tax_rate: 0.30 },
  rdc:         { risk_free: 3.0, erp_min: 12, erp_max: 15, size_min: 4, size_max: 6, illiq_min: 4, illiq_max: 6, cost_of_debt: 14.0, tax_rate: 0.30 },
  east_africa: { risk_free: 3.0, erp_min: 7,  erp_max: 9,  size_min: 3, size_max: 4, illiq_min: 2, illiq_max: 3, cost_of_debt: 9.0,  tax_rate: 0.30 },
};

const COUNTRY_TO_ZONE: Record<string, string> = {
  "cote_d_ivoire": "uemoa", "senegal": "uemoa", "burkina_faso": "uemoa", "mali": "uemoa",
  "benin": "uemoa", "togo": "uemoa", "niger": "uemoa", "guinee_bissau": "uemoa",
  "cameroun": "cemac", "gabon": "cemac", "congo": "cemac", "tchad": "cemac",
  "rdc": "rdc", "republique_democratique_du_congo": "rdc",
  "kenya": "east_africa", "tanzanie": "east_africa", "ouganda": "east_africa", "rwanda": "east_africa",
};

const SECTOR_MULTIPLES: Record<string, { ebitda: [number, number]; ca: [number, number] }> = {
  agro_industrie:           { ebitda: [5, 7],   ca: [0.8, 1.2] },
  aviculture:               { ebitda: [5, 7],   ca: [0.8, 1.2] },
  agriculture:              { ebitda: [4, 6],   ca: [0.5, 1.0] },
  commerce_detail:          { ebitda: [3, 5],   ca: [0.3, 0.7] },
  commerce_alimentaire:     { ebitda: [3, 5],   ca: [0.3, 0.7] },
  restauration:             { ebitda: [4, 6],   ca: [0.5, 1.0] },
  services_b2b:             { ebitda: [5, 8],   ca: [1.0, 2.0] },
  tic:                      { ebitda: [8, 12],  ca: [2.0, 5.0] },
  services_it:              { ebitda: [6, 10],  ca: [1.5, 3.0] },
  sante:                    { ebitda: [6, 9],   ca: [1.0, 2.0] },
  btp:                      { ebitda: [3, 5],   ca: [0.3, 0.6] },
  industrie_manufacturiere: { ebitda: [4, 6],   ca: [0.5, 0.8] },
  transport_logistique:     { ebitda: [4, 6],   ca: [0.5, 1.0] },
  education_formation:      { ebitda: [5, 7],   ca: [1.0, 2.0] },
  energie:                  { ebitda: [7, 10],  ca: [1.5, 3.0] },
  immobilier:               { ebitda: [5, 8],   ca: [1.0, 2.0] },
};

// ═══════════════════════════════════════════════════════
// CALCULS
// ═══════════════════════════════════════════════════════

function getZone(pays: string): string {
  const key = pays.toLowerCase().replace(/[\s\-']/g, '_');
  return COUNTRY_TO_ZONE[key] || 'uemoa';
}

function getSectorMultiples(secteur: string): { ebitda: [number, number]; ca: [number, number] } {
  const key = secteur.toLowerCase().replace(/[\s\-\/]/g, '_');
  return SECTOR_MULTIPLES[key] || SECTOR_MULTIPLES['services_b2b'];
}

/**
 * Construit les paramètres WACC — priorité à knowledge_risk_params (DB) si fourni,
 * sinon fallback sur les constantes par zone UEMOA/CEMAC/RDC/East Africa.
 */
function resolveWaccParams(inputs: ValuationInputs, riskParamsDB?: any): WaccZoneParams {
  const zone = getZone(inputs.pays);
  const fallback = WACC_PARAMS[zone] || WACC_PARAMS.uemoa;
  if (!riskParamsDB) return fallback;

  // knowledge_risk_params stocke les valeurs finales (pas min/max) — on les encadre ±1pt
  const rf = Number(riskParamsDB.risk_free_rate);
  const erp = Number(riskParamsDB.equity_risk_premium);
  const crp = Number(riskParamsDB.country_risk_premium ?? 0);
  const sizePMicro = Number(riskParamsDB.size_premium_micro);
  const sizePMedium = Number(riskParamsDB.size_premium_medium);
  const illiqMin = Number(riskParamsDB.illiquidity_premium_min);
  const illiqMax = Number(riskParamsDB.illiquidity_premium_max);
  const cod = Number(riskParamsDB.cost_of_debt);
  const tax = Number(riskParamsDB.tax_rate);

  return {
    risk_free: Number.isFinite(rf) ? rf : fallback.risk_free,
    erp_min: Number.isFinite(erp) ? erp + crp - 1 : fallback.erp_min,
    erp_max: Number.isFinite(erp) ? erp + crp + 1 : fallback.erp_max,
    size_min: Number.isFinite(sizePMedium) ? sizePMedium : fallback.size_min,
    size_max: Number.isFinite(sizePMicro) ? sizePMicro : fallback.size_max,
    illiq_min: Number.isFinite(illiqMin) ? illiqMin : fallback.illiq_min,
    illiq_max: Number.isFinite(illiqMax) ? illiqMax : fallback.illiq_max,
    cost_of_debt: Number.isFinite(cod) ? cod : fallback.cost_of_debt,
    tax_rate: Number.isFinite(tax) ? tax / 100 : fallback.tax_rate,
  };
}

function computeWACC(inputs: ValuationInputs, riskParamsDB?: any): DCFResult['wacc_detail'] & { wacc: number } {
  const params = resolveWaccParams(inputs, riskParamsDB);

  const sizeP = inputs.ca_dernier_exercice < 200_000_000
    ? params.size_max
    : inputs.ca_dernier_exercice < 1_000_000_000
      ? (params.size_min + params.size_max) / 2
      : params.size_min;

  const erp = (params.erp_min + params.erp_max) / 2;
  const illiq = (params.illiq_min + params.illiq_max) / 2;
  const costOfEquity = params.risk_free + erp + sizeP + illiq;

  // Poids D/E : si pas d'EV pré-calculée, proxy par equity basée sur résultat_net × multiple sectoriel médian
  // Ça donne une estimation plus proche de la réalité qu'un arbitraire CA × 0.5
  const sectorMult = getSectorMultiples(inputs.secteur);
  const equityProxy = inputs.resultat_net > 0
    ? inputs.resultat_net * ((sectorMult.ebitda[0] + sectorMult.ebitda[1]) / 2)
    : Math.max(inputs.ca_dernier_exercice * 0.5, 1);
  const totalCapital = (inputs.dette_financiere || 0) + equityProxy;
  const debtWeight = totalCapital > 0 ? (inputs.dette_financiere || 0) / totalCapital : 0.2;
  const equityWeight = 1 - debtWeight;

  const wacc = equityWeight * costOfEquity + debtWeight * params.cost_of_debt * (1 - params.tax_rate);
  const finalWacc = Math.max(wacc, 14);

  return {
    risk_free_rate: params.risk_free,
    equity_risk_premium: erp,
    size_premium: sizeP,
    illiquidity_premium: illiq,
    cost_of_equity: Math.round(costOfEquity * 10) / 10,
    cost_of_debt: params.cost_of_debt,
    debt_weight: Math.round(debtWeight * 100) / 100,
    equity_weight: Math.round(equityWeight * 100) / 100,
    wacc: Math.round(finalWacc * 10) / 10,
  };
}

function estimateFCFs(inputs: ValuationInputs): number[] {
  const ebitda = inputs.ebitda_dernier_exercice;
  const taxRate = 0.25;
  const fcfConversion = 0.70;
  const growth = 0.10;
  return Array.from({ length: 5 }, (_, i) =>
    Math.round(ebitda * (1 - taxRate) * fcfConversion * Math.pow(1 + growth, i + 1))
  );
}

function computeDCF(inputs: ValuationInputs, riskParamsDB?: any): DCFResult {
  const waccResult = computeWACC(inputs, riskParamsDB);
  const wacc = waccResult.wacc / 100;

  const fcfs = inputs.cashflows_projetes.length >= 5
    ? inputs.cashflows_projetes.slice(0, 5)
    : estimateFCFs(inputs);

  let pvCashflows = 0;
  const projections: { annee: string; fcf: number }[] = [];
  for (let i = 0; i < fcfs.length; i++) {
    const pv = fcfs[i] / Math.pow(1 + wacc, i + 1);
    pvCashflows += pv;
    projections.push({ annee: `Y${i + 1}`, fcf: Math.round(fcfs[i]) });
  }

  const terminalGrowth = 0.03;
  const lastFCF = fcfs[fcfs.length - 1] || 0;
  const terminalValue = lastFCF > 0 ? (lastFCF * (1 + terminalGrowth)) / (wacc - terminalGrowth) : 0;
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, fcfs.length);

  const enterpriseValue = pvCashflows + pvTerminalValue;
  const equityValue = enterpriseValue - (inputs.dette_financiere || 0) + (inputs.tresorerie_nette || 0);

  const computeEVAtWacc = (w: number) => {
    let pv = 0;
    for (let i = 0; i < fcfs.length; i++) pv += fcfs[i] / Math.pow(1 + w, i + 1);
    const tv = lastFCF > 0 ? (lastFCF * (1 + terminalGrowth)) / (w - terminalGrowth) : 0;
    pv += tv / Math.pow(1 + w, fcfs.length);
    return pv - (inputs.dette_financiere || 0) + (inputs.tresorerie_nette || 0);
  };

  const computeEVAtGrowth = (g: number) => {
    let pv = 0;
    for (let i = 0; i < fcfs.length; i++) pv += fcfs[i] / Math.pow(1 + wacc, i + 1);
    const tv = lastFCF > 0 ? (lastFCF * (1 + g)) / (wacc - g) : 0;
    pv += tv / Math.pow(1 + wacc, fcfs.length);
    return pv - (inputs.dette_financiere || 0) + (inputs.tresorerie_nette || 0);
  };

  return {
    wacc_pct: waccResult.wacc,
    wacc_detail: waccResult,
    projections_cashflow: projections,
    pv_cashflows: Math.round(pvCashflows),
    terminal_growth_rate: terminalGrowth * 100,
    terminal_value: Math.round(terminalValue),
    pv_terminal_value: Math.round(pvTerminalValue),
    enterprise_value: Math.round(enterpriseValue),
    equity_value: Math.round(Math.max(equityValue, 0)),
    sensitivity: {
      wacc_minus_2: Math.round(computeEVAtWacc(wacc - 0.02)),
      wacc_base: Math.round(Math.max(equityValue, 0)),
      wacc_plus_2: Math.round(computeEVAtWacc(wacc + 0.02)),
      growth_minus_1: Math.round(computeEVAtGrowth(terminalGrowth - 0.01)),
      growth_plus_1: Math.round(computeEVAtGrowth(terminalGrowth + 0.01)),
    },
  };
}

function computeMultiples(inputs: ValuationInputs): MultiplesResult {
  const sm = getSectorMultiples(inputs.secteur);

  const cagr = inputs.ca_historique_3ans.length >= 3 && inputs.ca_historique_3ans[0] > 0
    ? Math.pow(inputs.ca_historique_3ans[2] / inputs.ca_historique_3ans[0], 1 / 2) - 1
    : 0;

  let position = 0.5;
  if (cagr > 0.25) position += 0.2;
  if (cagr < 0) position -= 0.2;
  if (inputs.has_gouvernance_formelle) position += 0.1;
  if (inputs.has_audit_externe) position += 0.1;
  if (inputs.effectifs > 50) position += 0.05;
  position = Math.max(0, Math.min(1, position));

  const multipleEbitda = Math.round((sm.ebitda[0] + (sm.ebitda[1] - sm.ebitda[0]) * position) * 10) / 10;
  const multipleCa = Math.round((sm.ca[0] + (sm.ca[1] - sm.ca[0]) * position) * 10) / 10;

  const valeurParEbitda = Math.round(inputs.ebitda_dernier_exercice * multipleEbitda);
  const valeurParCa = Math.round(inputs.ca_dernier_exercice * multipleCa);
  const valeurMoyenne = Math.round((valeurParEbitda + valeurParCa) / 2);

  return {
    ebitda_dernier_exercice: inputs.ebitda_dernier_exercice,
    ca_dernier_exercice: inputs.ca_dernier_exercice,
    multiple_ebitda_retenu: multipleEbitda,
    multiple_ca_retenu: multipleCa,
    fourchette_ebitda: sm.ebitda,
    fourchette_ca: sm.ca,
    valeur_par_ebitda: valeurParEbitda,
    valeur_par_ca: valeurParCa,
    valeur_moyenne_multiples: valeurMoyenne,
  };
}

function computeDecotesPrimes(inputs: ValuationInputs): DecotesPrimes {
  const detail: string[] = [];

  const illiq = 25;
  detail.push(`Illiquidité : -${illiq}% (PME non cotée)`);

  let taille = 0;
  if (inputs.ca_dernier_exercice < 200_000_000) {
    taille = 20;
    detail.push(`Taille : -${taille}% (micro, CA < 200M)`);
  } else if (inputs.ca_dernier_exercice < 1_000_000_000) {
    taille = 10;
    detail.push(`Taille : -${taille}% (petite, CA 200M-1B)`);
  } else {
    detail.push('Taille : 0% (CA > 1B)');
  }

  let gouv = 0;
  if (!inputs.has_gouvernance_formelle) {
    gouv += 8;
    detail.push('Gouvernance : -8% (pas de structure formelle)');
  }
  if (!inputs.has_audit_externe) {
    gouv += 5;
    detail.push("Audit : -5% (pas d'audit externe)");
  }

  let croissance = 0;
  const cagr = inputs.ca_historique_3ans.length >= 3 && inputs.ca_historique_3ans[0] > 0
    ? Math.pow(inputs.ca_historique_3ans[2] / inputs.ca_historique_3ans[0], 1 / 2) - 1
    : 0;
  if (cagr > 0.20) {
    croissance = Math.min(Math.round(cagr * 50), 25);
    detail.push(`Croissance : +${croissance}% (CAGR ${(cagr * 100).toFixed(0)}%)`);
  }

  const total = -(illiq + taille + gouv) + croissance;
  detail.push(`Total : ${total}%`);

  return {
    decote_illiquidite_pct: illiq,
    decote_taille_pct: taille,
    decote_gouvernance_pct: gouv,
    prime_croissance_pct: croissance,
    ajustement_total_pct: total,
    detail,
  };
}

function computeSynthese(dcf: DCFResult, multiples: MultiplesResult, decotes: DecotesPrimes): SyntheseResult {
  const ajustement = 1 + (decotes.ajustement_total_pct / 100);

  const valeurs: { methode: string; brute: number; ajustee: number }[] = [];

  if (dcf.equity_value > 0) {
    valeurs.push({ methode: 'DCF', brute: dcf.equity_value, ajustee: Math.round(dcf.equity_value * ajustement) });
  }
  if (multiples.valeur_par_ebitda > 0) {
    valeurs.push({ methode: 'Multiples EBITDA', brute: multiples.valeur_par_ebitda, ajustee: Math.round(multiples.valeur_par_ebitda * ajustement) });
  }
  if (multiples.valeur_par_ca > 0) {
    valeurs.push({ methode: 'Multiples CA', brute: multiples.valeur_par_ca, ajustee: Math.round(multiples.valeur_par_ca * ajustement) });
  }

  valeurs.sort((a, b) => a.ajustee - b.ajustee);

  const basse = valeurs[0]?.ajustee || 0;
  const haute = valeurs[valeurs.length - 1]?.ajustee || 0;
  const mediane = valeurs.length === 3
    ? valeurs[1].ajustee
    : Math.round((basse + haute) / 2);

  const methode = dcf.equity_value > 0 ? 'DCF' : 'Multiples EBITDA';

  return {
    valeur_basse: basse,
    valeur_mediane: mediane,
    valeur_haute: haute,
    valeurs_par_methode: valeurs,
    methode_privilegiee: methode,
  };
}

// ═══════════════════════════════════════════════════════
// FONCTION PRINCIPALE — EXPORT
// ═══════════════════════════════════════════════════════

export function computeValuation(inputs: ValuationInputs, riskParamsDB?: any): ValuationResult {
  const dcf = computeDCF(inputs, riskParamsDB);
  const multiples = computeMultiples(inputs);
  const decotes = computeDecotesPrimes(inputs);
  const synthese = computeSynthese(dcf, multiples, decotes);

  return {
    dcf,
    multiples,
    decotes_primes: decotes,
    synthese,
    metadata: {
      inputs_quality: inputs.cashflows_projetes.length >= 5 ? 'plan_ovo' : 'estimation',
      methodes_applicables: [
        dcf.equity_value > 0 ? 'DCF' : null,
        multiples.valeur_par_ebitda > 0 ? 'Multiples EBITDA' : null,
        multiples.valeur_par_ca > 0 ? 'Multiples CA' : null,
      ].filter(Boolean) as string[],
      date_calcul: new Date().toISOString(),
    },
  };
}

/**
 * Extraire les inputs de valorisation depuis les livrables existants
 */
export function extractValuationInputs(
  planOvo: any, inputs: any, framework: any, enterprise: any
): ValuationInputs {
  const YEAR_KEYS = ['year2', 'year3', 'year4', 'year5', 'year6'];

  const ca = inputs?.compte_resultat?.chiffre_affaires || framework?.kpis?.ca_annee_n || 0;
  const ebitda = inputs?.ebe || inputs?.ebitda || framework?.kpis?.ebitda || 0;
  const rn = inputs?.compte_resultat?.resultat_net || framework?.kpis?.resultat_net || 0;

  const treso = inputs?.bilan?.actif?.tresorerie || framework?.tresorerie_bfr?.tresorerie_nette || 0;
  const dette = inputs?.bilan?.passif?.dettes_financieres || 0;

  let cashflows: number[] = [];
  if (planOvo?.cashflow) {
    cashflows = YEAR_KEYS.map(k => Number(planOvo.cashflow[k]) || 0);
  } else if (planOvo?.ebitda) {
    cashflows = YEAR_KEYS.map(k => Math.round((Number(planOvo.ebitda[k]) || 0) * 0.65));
  }

  const caProjectes = planOvo?.revenue
    ? YEAR_KEYS.map(k => Number(planOvo.revenue[k]) || 0)
    : [];

  const ebitdaProjectes = planOvo?.ebitda
    ? YEAR_KEYS.map(k => Number(planOvo.ebitda[k]) || 0)
    : [];

  const hist3 = inputs?.historique_3ans || {};
  const caHist = [
    hist3.n_minus_2?.chiffre_affaires || hist3.n_minus_2?.ca || 0,
    hist3.n_minus_1?.chiffre_affaires || hist3.n_minus_1?.ca || 0,
    ca,
  ];

  // Détection heuristique de la gouvernance et de l'audit externe
  // Priorité 1 : info explicite dans les livrables (framework / inputs / enterprise)
  // Priorité 2 : proxies (forme juridique SA = conseil d'administration obligatoire, effectifs > 50)
  // Priorité 3 : par défaut true (bénéfice du doute — on ne pénalise pas sans preuve)
  const formeJur = (enterprise?.legal_form || 'SARL').toString().toUpperCase();
  const effectifs = Number(enterprise?.employees_count || 0);

  const explicitAudit =
    inputs?.metadata?.audit_externe ??
    framework?.gouvernance?.audit_externe ??
    framework?.audit_externe ??
    enterprise?.has_audit_externe ??
    null;

  const explicitGouv =
    inputs?.metadata?.gouvernance_formelle ??
    framework?.gouvernance?.conseil_administration ??
    framework?.gouvernance_formelle ??
    enterprise?.has_gouvernance_formelle ??
    null;

  // SA/SAS = gouvernance formelle obligatoire (conseil d'administration)
  const isSA = /^(SA|SAS)$/.test(formeJur);
  const hasAuditExterne = explicitAudit !== null ? !!explicitAudit : (isSA && effectifs >= 50);
  const hasGouvernanceFormelle = explicitGouv !== null ? !!explicitGouv : (isSA || effectifs >= 50);

  return {
    ca_dernier_exercice: ca,
    ebitda_dernier_exercice: ebitda,
    resultat_net: rn,
    tresorerie_nette: treso,
    dette_financiere: dette,
    cashflows_projetes: cashflows,
    ca_projetes: caProjectes,
    ebitda_projetes: ebitdaProjectes,
    pays: enterprise?.country || '',
    secteur: enterprise?.sector || 'services_b2b',
    ca_historique_3ans: caHist,
    effectifs,
    has_audit_externe: hasAuditExterne,
    has_gouvernance_formelle: hasGouvernanceFormelle,
    forme_juridique: enterprise?.legal_form || 'SARL',
  };
}
