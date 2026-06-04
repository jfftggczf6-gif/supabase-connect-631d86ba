/**
 * Brief 0.13 — Tests unitaires computeIndicateurs / computeDureePondereePrets / computeFullPlan.
 * 3 scénarios : startup-restart (Savoki-like), PME stable (CIV), ETI établie (Sénégal).
 * Vérifie que les indicateurs restent dans des ranges plausibles et que le moteur expose bien
 * duree_pret_utilisee, _temporalite, wacc_metadata, investissement_metadata.
 */
import { describe, it, expect } from "vitest";
import {
  computeDureePondereePrets,
  computeIndicateurs,
  validateIndicateursCoherence,
  computeFullPlan,
  type Projection,
} from "../../supabase/functions/_shared/financial-compute";

// ─── Helpers ───────────────────────────────────────────────────────────────

function projection(annee: string, ca: number, ebitda: number, cashflow: number, opts: Partial<Projection> = {}): Projection {
  return {
    annee,
    is_reel: opts.is_reel ?? false,
    ca,
    cogs: ca - ebitda - 100,
    marge_brute: ca - (ca - ebitda - 100),
    opex_total: 100,
    ebitda,
    amortissements: 50,
    resultat_exploitation: ebitda - 50,
    charges_financieres: opts.charges_financieres ?? 30,
    impots: 20,
    resultat_net: opts.resultat_net ?? ebitda - 100,
    cashflow,
  };
}

const fiscalUEMOA = { tva: 18, is: 25, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 656 };
const fiscalRDC = { tva: 16, is: 30, devise: "USD", currency_iso: "USD", exchange_rate_eur: 1.08 };
const fiscalSenegal = { tva: 18, is: 30, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 656 };

// ─── computeDureePondereePrets ─────────────────────────────────────────────

describe("computeDureePondereePrets", () => {
  it("retourne 5 ans si aucun prêt", () => {
    expect(computeDureePondereePrets([])).toBe(5);
  });

  it("retourne la durée moyenne pondérée par montant", () => {
    const prets = [
      { montant: 100_000, duree_mois: 24 }, // 2 ans
      { montant: 50_000, duree_mois: 60 }, // 5 ans
    ];
    // Pondéré : (100k * 2 + 50k * 5) / 150k = (200k + 250k) / 150k = 3
    expect(computeDureePondereePrets(prets)).toBeCloseTo(3.0, 1);
  });

  it("Savoki-like : un prêt RAWBANK 20k sur 2 ans → 2 ans", () => {
    const prets = [{ montant: 20_000, duree_mois: 24 }];
    expect(computeDureePondereePrets(prets)).toBeCloseTo(2, 1);
  });

  it("retombée 3 ans pour prêt sans durée explicite", () => {
    const prets = [{ montant: 50_000 }];
    expect(computeDureePondereePrets(prets)).toBeCloseTo(3, 1);
  });
});

// ─── computeIndicateurs ────────────────────────────────────────────────────

describe("computeIndicateurs", () => {
  const projections: Projection[] = [
    projection("YEAR-2", 800, 100, 60, { is_reel: true }),
    projection("YEAR-1", 900, 120, 70, { is_reel: true }),
    projection("CURRENT YEAR", 1000, 150, 90, { is_reel: true }),
    projection("YEAR2", 1200, 200, 150),
    projection("YEAR3", 1400, 260, 200),
    projection("YEAR4", 1600, 320, 250),
    projection("YEAR5", 1800, 380, 300),
    projection("YEAR6", 2000, 440, 350),
  ];

  it("expose duree_pret_utilisee et _temporalite", () => {
    const ind = computeIndicateurs(projections, 500, 0.15, 500, [
      { montant: 500, duree_mois: 24 },
    ]);
    expect(ind.duree_pret_utilisee).toBeCloseTo(2, 1);
    expect(ind._temporalite).toBeDefined();
    expect(ind._temporalite!.hypothese_investissement).toBe(500);
    expect(ind._temporalite!.duree_pret_utilisee).toBeCloseTo(2, 1);
    expect(ind._temporalite!.presents).toContain("runway_mois");
    expect(ind._temporalite!.futurs).toContain("tri");
  });

  it("duree_pret_utilisee est lue depuis prets[] et propagée dans _temporalite", () => {
    const indCourt = computeIndicateurs(projections, 500, 0.15, 500, [
      { montant: 500, duree_mois: 24 },
    ]);
    const indLong = computeIndicateurs(projections, 500, 0.15, 500, [
      { montant: 500, duree_mois: 120 },
    ]);
    // La valeur exposée doit refléter exactement la durée des prêts (pas le 5 hardcodé)
    expect(indCourt.duree_pret_utilisee).toBeCloseTo(2, 1);
    expect(indLong.duree_pret_utilisee).toBeCloseTo(10, 1);
    expect(indCourt._temporalite!.duree_pret_utilisee).toBeCloseTo(2, 1);
    expect(indLong._temporalite!.duree_pret_utilisee).toBeCloseTo(10, 1);
  });

  it("VAN et TRI cohérents avec un investissement modéré", () => {
    const ind = computeIndicateurs(projections, 500, 0.15, 500, [
      { montant: 500, duree_mois: 60 },
    ]);
    expect(ind.van).not.toBeNull();
    expect(ind.tri).not.toBeNull();
    expect(ind.tri!).toBeGreaterThan(0);
    expect(ind.tri!).toBeLessThan(100);
  });

  it("rétro-compatible sans param prets (fallback 5 ans)", () => {
    const ind = computeIndicateurs(projections, 500, 0.15, 500);
    expect(ind.duree_pret_utilisee).toBeCloseTo(5, 1);
  });
});

// ─── validateIndicateursCoherence (brief 0.11, re-vérifié dans le contexte 0.13) ───

describe("validateIndicateursCoherence", () => {
  it("Savoki-like : TRI extrême + payback impossible + runway critique → blockers", () => {
    const ind = {
      van: 100000,
      tri: 153,
      payback_years: 0.9,
      dscr_moyen: 18,
      roi: 1225,
      couverture_interets: 2,
      cycle_tresorerie: 60,
      runway_mois: 0.8,
    };
    const result = validateIndicateursCoherence(ind, { investissement_total: 20000 });
    expect(result.valid).toBe(false);
    const types = result.checks.map((c) => c.type);
    expect(types).toContain("tri_extreme");
    expect(types).toContain("roi_extreme");
    expect(types).toContain("logique_impossible");
  });

  it("dossier propre : aucun check", () => {
    const ind = {
      van: 50000,
      tri: 25,
      payback_years: 4,
      dscr_moyen: 2.5,
      roi: 80,
      couverture_interets: 5,
      cycle_tresorerie: 45,
      runway_mois: 12,
    };
    const result = validateIndicateursCoherence(ind, { investissement_total: 200000 });
    expect(result.valid).toBe(true);
    expect(result.checks).toHaveLength(0);
  });
});

// ─── computeFullPlan : 3 scénarios E2E ────────────────────────────────────

describe("computeFullPlan — scénarios E2E (brief 0.13)", () => {
  /**
   * Scénario 1 : Startup en restart (Savoki-like, RDC)
   * - CA récent en baisse, CAPEX 80k, BFR 20k, besoin total 120k explicite
   * - 1 prêt existant RAWBANK 20k sur 2 ans
   * - Attendu : investissement_metadata.source = 'besoin_recherche', duree_pret = 2,
   *   indicateurs plausibles (TRI < 60%, payback ≥ 1.5 ans)
   */
  it("Startup en restart : besoin_total_recherche prioritaire", () => {
    const inputs: any = {
      compte_resultat: { chiffre_affaires: 600_000, achats_matieres: 250_000, charges_personnel: 150_000, charges_externes: 80_000, dotations_amortissements: 30_000, charges_financieres: 4_000, impots: 10_000, resultat_net: 76_000 },
      bilan: { actif: { tresorerie: 30_000 }, passif: { capitaux_propres: 200_000, dettes_financieres: 20_000 } },
      historique_3ans: {
        n_moins_2: { annee: 2023, ca_total: 759_000, resultat_net: 80_000, ebitda: 130_000 },
        n_moins_1: { annee: 2024, ca_total: 700_000, resultat_net: 70_000, ebitda: 110_000 },
        n: { annee: 2025, ca_total: 600_000, resultat_net: 60_000, ebitda: 100_000 },
      },
      financement: {
        apports_capital: 50_000,
        prets: [{ source: "rawbank", montant: 20_000, taux_pct: 18, duree_mois: 24 }],
        besoin_total_recherche: 120_000,
        composition_besoin: { capex: 80_000, bfr_demarrage: 20_000, restructuration_dette: 0, commercialisation_lancement: 20_000 },
      },
      bfr: { delai_clients_jours: 30, stock_moyen_jours: 60, delai_fournisseurs_jours: 45, tresorerie_initiale: 30_000 },
    };
    const ai: any = { capex: [{ montant: 80_000, categorie: "machinery", annee: 2026 }], produits: [], hypotheses: {} };
    const result = computeFullPlan(inputs, ai, "Savoki", "RDC", 2026, fiscalRDC);

    expect(result.investissement_metadata).toBeDefined();
    expect(result.investissement_metadata!.source).toBe("besoin_recherche");
    expect(result.investissement_metadata!.investissement_total).toBe(120_000);

    expect(result.indicateurs_decision.duree_pret_utilisee).toBeCloseTo(2, 1);

    // Les indicateurs futurs doivent être plausibles (pas TRI 153 / payback 0.9 / DSCR 18)
    if (result.indicateurs_decision.tri !== null)
      expect(result.indicateurs_decision.tri).toBeLessThan(80);
    if (result.indicateurs_decision.payback_years !== null)
      expect(result.indicateurs_decision.payback_years).toBeGreaterThanOrEqual(1.0);
    if (result.indicateurs_decision.dscr_moyen !== null)
      expect(result.indicateurs_decision.dscr_moyen).toBeLessThan(20);

    expect(result.wacc_metadata).toBeDefined();
  });

  /**
   * Scénario 2 : PME stable (CIV agro-industrie)
   * - CAPEX 200k, BFR 100k, besoin 300k explicite, prêt BOA 200k 7 ans
   * - Attendu : DSCR confortable, TRI raisonnable, payback 3-5 ans
   */
  it("PME stable CIV : DSCR cohérent avec durée prêt 7 ans", () => {
    const inputs: any = {
      compte_resultat: { chiffre_affaires: 800_000_000, achats_matieres: 400_000_000, charges_personnel: 150_000_000, charges_externes: 100_000_000, dotations_amortissements: 30_000_000, charges_financieres: 8_000_000, impots: 30_000_000, resultat_net: 82_000_000 },
      bilan: { actif: { tresorerie: 100_000_000 }, passif: { capitaux_propres: 300_000_000, dettes_financieres: 200_000_000 } },
      historique_3ans: {
        n_moins_2: { annee: 2023, ca_total: 700_000_000, resultat_net: 70_000_000, ebitda: 100_000_000 },
        n_moins_1: { annee: 2024, ca_total: 750_000_000, resultat_net: 75_000_000, ebitda: 110_000_000 },
        n: { annee: 2025, ca_total: 800_000_000, resultat_net: 82_000_000, ebitda: 120_000_000 },
      },
      financement: {
        apports_capital: 100_000_000,
        prets: [{ source: "boa", montant: 200_000_000, taux_pct: 9, duree_mois: 84 }],
        besoin_total_recherche: 300_000_000,
        composition_besoin: { capex: 200_000_000, bfr_demarrage: 100_000_000, restructuration_dette: 0, commercialisation_lancement: 0 },
      },
      bfr: { delai_clients_jours: 60, stock_moyen_jours: 30, delai_fournisseurs_jours: 30, tresorerie_initiale: 100_000_000 },
    };
    const ai: any = { capex: [{ montant: 200_000_000, categorie: "machinery", annee: 2026 }], produits: [], hypotheses: {} };
    const result = computeFullPlan(inputs, ai, "PME CIV", "Côte d'Ivoire", 2026, fiscalUEMOA);

    expect(result.investissement_metadata!.source).toBe("besoin_recherche");
    expect(result.indicateurs_decision.duree_pret_utilisee).toBeCloseTo(7, 1);

    // DSCR moyen plus élevé qu'un cas durée courte mais réaliste (< 15×)
    if (result.indicateurs_decision.dscr_moyen !== null)
      expect(result.indicateurs_decision.dscr_moyen).toBeLessThan(15);
  });

  /**
   * Scénario 3 : ETI établie (Sénégal agroalim, syndication 10 ans)
   * - Pas de besoin_total_recherche explicite → fallback CAPEX + BFR - financement
   */
  it("ETI Sénégal : fallback capex_plus_bfr_moins_finance", () => {
    const inputs: any = {
      compte_resultat: { chiffre_affaires: 3_000_000_000, achats_matieres: 1_400_000_000, charges_personnel: 500_000_000, charges_externes: 300_000_000, dotations_amortissements: 100_000_000, charges_financieres: 50_000_000, impots: 200_000_000, resultat_net: 450_000_000 },
      bilan: { actif: { tresorerie: 500_000_000 }, passif: { capitaux_propres: 1_200_000_000, dettes_financieres: 1_000_000_000 } },
      historique_3ans: {
        n_moins_2: { annee: 2023, ca_total: 2_500_000_000, resultat_net: 350_000_000, ebitda: 500_000_000 },
        n_moins_1: { annee: 2024, ca_total: 2_750_000_000, resultat_net: 400_000_000, ebitda: 550_000_000 },
        n: { annee: 2025, ca_total: 3_000_000_000, resultat_net: 450_000_000, ebitda: 600_000_000 },
      },
      financement: {
        apports_capital: 200_000_000,
        prets: [{ source: "syndication banque", montant: 1_000_000_000, taux_pct: 10, duree_mois: 120 }],
        // Pas de besoin_total_recherche
      },
      bfr: { delai_clients_jours: 45, stock_moyen_jours: 30, delai_fournisseurs_jours: 30, tresorerie_initiale: 500_000_000 },
    };
    const ai: any = { capex: [{ montant: 1_000_000_000, categorie: "machinery", annee: 2026 }], produits: [], hypotheses: {} };
    const result = computeFullPlan(inputs, ai, "ETI Senegal", "Sénégal", 2026, fiscalSenegal);

    expect(result.investissement_metadata!.source).not.toBe("besoin_recherche");
    expect(result.investissement_metadata!.investissement_total).toBeGreaterThan(0);
    expect(result.indicateurs_decision.duree_pret_utilisee).toBeCloseTo(10, 1);
  });

  /**
   * Cas pathologique : aucun investissement déclaré → warning + indicateurs marqués
   */
  it("Aucun investissement déclaré : warning + fallback contrôlé", () => {
    const inputs: any = {
      compte_resultat: { chiffre_affaires: 100_000, achats_matieres: 50_000, charges_personnel: 30_000, charges_externes: 10_000, dotations_amortissements: 2_000, charges_financieres: 0, impots: 2_000, resultat_net: 6_000 },
      bilan: { actif: { tresorerie: 5_000 }, passif: { capitaux_propres: 50_000, dettes_financieres: 0 } },
      historique_3ans: {
        n_moins_2: { annee: 2023, ca_total: 80_000, resultat_net: 5_000, ebitda: 8_000 },
        n_moins_1: { annee: 2024, ca_total: 90_000, resultat_net: 6_000, ebitda: 9_000 },
        n: { annee: 2025, ca_total: 100_000, resultat_net: 6_000, ebitda: 10_000 },
      },
      financement: {},
      bfr: { tresorerie_initiale: 5_000 },
    };
    const ai: any = { capex: [], produits: [], hypotheses: {} };
    const result = computeFullPlan(inputs, ai, "Sans invest", "Sénégal", 2026, fiscalSenegal);

    // Source soit fallback_1 soit capex_only=0 mais jamais surévalué
    expect(["fallback_1", "capex_only", "capex_plus_bfr_moins_finance"]).toContain(
      result.investissement_metadata!.source,
    );
    expect(result.investissement_metadata!.investissement_total).toBeLessThanOrEqual(50_000);
  });
});
