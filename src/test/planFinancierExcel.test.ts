import { describe, it, expect } from 'vitest';
import { buildPlanFinancierSheets } from '../lib/planFinancierExcel';

// Plan minimal réaliste reproduisant la forme de PlanFinancierComputed,
// avec un prêt incomplet (montant > 0 mais taux/durée absents → "à compléter").
const samplePlan = {
  company: 'Savoki',
  country: 'RD Congo',
  currency: 'USD',
  exchange_rate_eur: 1.163,
  inflation_rate: 0.07,
  vat_rate: 16,
  tax_regime_1: 30,
  tax_regime_2: 0,
  current_year: 2026,
  years: { 'CURRENT YEAR': 2026, YEAR2: 2027 },
  kpis: { ca: 100000, resultat_net: 12000, tresorerie: 5000, effectif: 8 },
  projections: [
    { annee: 'CURRENT YEAR', is_reel: false, ca: 100000, cogs: 60000, marge_brute: 40000, resultat_net: 12000, cashflow: 9000 },
    { annee: 'YEAR2', is_reel: false, ca: 130000, cogs: 75000, marge_brute: 55000, resultat_net: 18000, cashflow: 14000 },
  ],
  produits: [{ nom: 'Produit A', prix_unitaire: 10, cout_unitaire: 6, volume_annuel: 5000, part_ca: 0.8 }],
  services: [{ nom: 'Cleaning', prix_unitaire: 30000, cout_unitaire: 12000, volume_annuel: 1, part_ca: 0.2 }],
  staff: [{ categorie: 'Direction', departement: 'Admin', taux_charges_sociales: 0.13 }],
  capex: [{ label: 'Machine', categorie: 'Équipement', acquisition_year: 2026, acquisition_value: 20000, amortisation_rate: 0.2 }],
  loans: {
    ovo: { amount: 0, rate: 0, term_years: 0 },
    family: { amount: 0, rate: 0, term_years: 0 },
    bank: { amount: 27053, rate: 0.12, term_years: 2 },
  },
  echeancier: [
    { label: 'Prêt RAWBANK', annees: [{ annee: 2026, valeur: '13526' }, { annee: 2027, valeur: '13527' }] },
    { label: 'Prêt OVO', dim: true, annees: [{ annee: 2026, valeur: 'à compléter' }, { annee: 2027, valeur: 'à compléter' }] },
  ],
  indicateurs_decision: { van: 50000, tri: 0.25, payback_years: 3, dscr_moyen: 1.8, roi: 0.4 },
  wacc_metadata: { wacc_brut: 0.28, wacc_applique: 0.25 },
};

describe('buildPlanFinancierSheets', () => {
  it('produit les 8 onglets attendus', () => {
    const sheets = buildPlanFinancierSheets(samplePlan);
    const names = sheets.map((s) => s.name);
    expect(names).toEqual([
      'Hypothèses & Pays',
      'Situation actuelle',
      'Projections',
      'Produits & Services',
      'Ressources humaines',
      'OPEX & CAPEX',
      'Financement & Prêts',
      'Indicateurs',
    ]);
  });

  it('écrit le taux de change en clair (1 EUR = X devise)', () => {
    const sheets = buildPlanFinancierSheets(samplePlan);
    const hyp = sheets[0].rows.flat().map(String);
    expect(hyp.some((c) => c.includes('1 EUR = 1.163 USD'))).toBe(true);
  });

  it('inclut une ligne CA dans les projections avec les valeurs par année', () => {
    const proj = buildPlanFinancierSheets(samplePlan).find((s) => s.name === 'Projections')!;
    const caRow = proj.rows.find((r) => r[0] === "Chiffre d'affaires");
    expect(caRow).toBeDefined();
    expect(caRow).toContain(100000);
    expect(caRow).toContain(130000);
  });

  it('préserve "à compléter" pour les prêts vides (zéro fabrication)', () => {
    const fin = buildPlanFinancierSheets(samplePlan).find((s) => s.name === 'Financement & Prêts')!;
    const flat = fin.rows.flat().map(String);
    // Le prêt OVO (montant 0) est entièrement "à compléter"
    const ovoRow = fin.rows.find((r) => r[0] === 'Prêt OVO');
    expect(ovoRow).toEqual(['Prêt OVO', 'à compléter', 'à compléter', 'à compléter']);
    // Le prêt bancaire réel garde ses valeurs
    const bankRow = fin.rows.find((r) => r[0] === 'Prêt bancaire');
    expect(bankRow).toContain(27053);
    // L'échéancier conserve les "à compléter"
    expect(flat.filter((c) => c === 'à compléter').length).toBeGreaterThanOrEqual(2);
  });

  it('ne plante pas sur un plan vide et renvoie quand même 8 onglets', () => {
    const sheets = buildPlanFinancierSheets({});
    expect(sheets).toHaveLength(8);
    // Onglets de données vides → marqués "à compléter"
    const proj = sheets.find((s) => s.name === 'Projections')!;
    expect(proj.rows.flat().map(String)).toContain('à compléter');
  });

  it('ne plante pas sur null/undefined', () => {
    expect(() => buildPlanFinancierSheets(null)).not.toThrow();
    expect(() => buildPlanFinancierSheets(undefined)).not.toThrow();
  });
});
