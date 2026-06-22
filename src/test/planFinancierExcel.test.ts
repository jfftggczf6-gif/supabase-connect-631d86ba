import { describe, it, expect } from 'vitest';
import { buildPlanFinancierModel } from '../lib/planFinancierExcel';

// Plan minimal réaliste reproduisant la forme de PlanFinancierComputed,
// avec un prêt incomplet (montant > 0 mais taux/durée absents → "à compléter").
const samplePlan = {
  company: 'Savoki',
  country: 'RD Congo',
  currency: 'USD',
  exchange_rate_eur: 1.163,
  inflation_rate: 0.07,
  vat_rate: 0.16,
  tax_regime_1: 0, // RDC : pas de régime PME différencié → sentinelle « non applicable »
  tax_regime_2: 0.3, // IS standard RDC = 30 %
  current_year: 2026,
  years: { 'CURRENT YEAR': 2026, YEAR2: 2027 },
  kpis: { ca: 100000, resultat_net: 12000, tresorerie: 5000, effectif: 8 },
  projections: [
    { annee: 'CURRENT YEAR', annee_num: 2026, is_reel: false, ca: 100000, cogs: 60000, marge_brute: 40000, resultat_net: 12000, cashflow: 9000 },
    { annee: 'YEAR2', annee_num: 2027, is_reel: false, ca: 130000, cogs: 75000, marge_brute: 55000, resultat_net: 18000, cashflow: 14000 },
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
  indicateurs_decision: { van: 50000, tri: 25, payback_years: 3, dscr_moyen: 1.8, roi: 40 },
  wacc_metadata: { wacc_brut: 0.28, wacc_applique: 0.25 },
};

const sheet = (m: any, name: string) => m.sheets.find((s: any) => s.name === name);
const rowByLabel = (sh: any, label: string) => sh.rows.find((r: any) => r.cells[0]?.v === label);
const vals = (r: any) => r.cells.map((c: any) => c.v);

describe('buildPlanFinancierModel', () => {
  it('produit les onglets attendus (avec sommaire + synthèse)', () => {
    const names = buildPlanFinancierModel(samplePlan).sheets.map((s: any) => s.name);
    expect(names).toEqual([
      'Sommaire',
      'Synthèse',
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

  it('écrit le taux de change dans les deux sens (1 EUR = X / 1 X = Y EUR)', () => {
    const hyp = sheet(buildPlanFinancierModel(samplePlan), 'Hypothèses & Pays');
    const fx = rowByLabel(hyp, 'Taux de change');
    expect(String(fx.cells[1].v)).toContain('1 EUR = 1.163 USD');
    expect(String(fx.cells[1].v)).toContain('1 USD = 0.86 EUR');
  });

  it('affiche « non applicable » pour le régime PME quand tax_regime_1 = 0 (RDC)', () => {
    const hyp = sheet(buildPlanFinancierModel(samplePlan), 'Hypothèses & Pays');
    const r1 = hyp.rows.find((r: any) => String(r.cells[0]?.v).startsWith('Régime fiscal 1'));
    const r2 = hyp.rows.find((r: any) => String(r.cells[0]?.v).startsWith('Régime fiscal 2'));
    expect(r1.cells[1].v).toBe('non applicable');
    expect(r2.cells[1].v).toBe(0.3);
    expect(r2.cells[1].fmt).toBe('fracPct'); // 0,3 → affiché 30 %
  });

  it('formate le taux inverse pour les devises faibles (XOF ~0.00152)', () => {
    const hyp = sheet(buildPlanFinancierModel({ currency: 'XOF', exchange_rate_eur: 655.957 }), 'Hypothèses & Pays');
    const fx = rowByLabel(hyp, 'Taux de change');
    expect(String(fx.cells[1].v)).toContain('1 EUR = 655.957 XOF');
    expect(String(fx.cells[1].v)).toContain('0.00152');
  });

  it('inclut une ligne CA dans les projections avec les valeurs par année', () => {
    const proj = sheet(buildPlanFinancierModel(samplePlan), 'Projections');
    const caRow = rowByLabel(proj, "Chiffre d'affaires");
    expect(vals(caRow)).toContain(100000);
    expect(vals(caRow)).toContain(130000);
  });

  it('préserve "à compléter" pour les prêts vides (zéro fabrication)', () => {
    const fin = sheet(buildPlanFinancierModel(samplePlan), 'Financement & Prêts');
    const ovoRow = rowByLabel(fin, 'Prêt OVO');
    expect(vals(ovoRow)).toEqual(['Prêt OVO', 'à compléter', 'à compléter', 'à compléter']);
    expect(ovoRow.cells[1].gap).toBe(true);
    const bankRow = rowByLabel(fin, 'Prêt bancaire');
    expect(vals(bankRow)).toContain(27053);
  });

  it('axe décalé : années gap « à compléter », en-têtes années réelles, année courante', () => {
    const planDecale = {
      ...samplePlan,
      current_year: 2026,
      projections: [
        { annee: 'YEAR-2', annee_num: 2024, is_reel: true, ca: 667105, resultat_net: 37711, cashflow: 40000 },
        { annee: 'YEAR-1', annee_num: 2025, is_gap: true, is_reel: false, ca: 0, resultat_net: 0, cashflow: 0 },
        { annee: 'CURRENT YEAR', annee_num: 2026, is_reel: false, ca: 733815, resultat_net: 50000, cashflow: 55000 },
        { annee: 'YEAR2', annee_num: 2027, is_reel: false, ca: 807196, resultat_net: 60000, cashflow: 65000 },
      ],
    };
    const proj = sheet(buildPlanFinancierModel(planDecale), 'Projections');
    const header = proj.rows.find((r: any) => r.cells[0]?.v === 'Année');
    expect(vals(header)).toEqual(['Année', 2024, 2025, 2026, 2027]);
    const typeRow = rowByLabel(proj, 'Type');
    expect(vals(typeRow)).toEqual(['Type', 'réel', 'à compléter', 'année courante', 'projeté']);
    const caRow = rowByLabel(proj, "Chiffre d'affaires");
    expect(vals(caRow)).toEqual(["Chiffre d'affaires", 667105, 'à compléter', 733815, 807196]);
    // 2025 = cellule gap surlignée
    expect(caRow.cells[2].gap).toBe(true);
  });

  it('ne plante pas sur un plan vide et renvoie quand même les 10 onglets', () => {
    const sheets = buildPlanFinancierModel({}).sheets;
    expect(sheets).toHaveLength(10);
  });

  it('ne plante pas sur null/undefined', () => {
    expect(() => buildPlanFinancierModel(null)).not.toThrow();
    expect(() => buildPlanFinancierModel(undefined)).not.toThrow();
  });
});
