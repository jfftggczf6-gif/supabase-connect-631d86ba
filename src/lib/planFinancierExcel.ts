// Génère un Excel (.xlsx) PROPRE, LISIBLE et MIS EN FORME à partir de l'objet plan
// financier calculé (PlanFinancierComputed). Objectif : fournir à OVO un classeur
// clair — sommaire, synthèse, un onglet par section, nombres formatés (séparateurs
// de milliers, devise, taux en %), couleurs cohérentes, colonnes figées — pour qu'ils
// recopient facilement dans leur modèle officiel. Alternative robuste au remplissage
// automatique du gabarit .xlsm (qui concentre les bugs de mapping).
//
// PRINCIPE : recopie FIDÈLE des données du moteur déterministe (aucune valeur inventée).
// Les données manquantes restent « à compléter » (surlignées). Le rendu (exceljs) est
// chargé dynamiquement (code-splitting) — voir downloadPlanFinancierExcel.

// ─── Modèle (pur, testable) ───────────────────────────────────────────

export type Fmt = 'text' | 'int' | 'money' | 'fracPct' | 'pct' | 'year' | 'dec';
// money/int : nombre brut → séparateurs de milliers
// year     : année → SANS séparateur (2026, pas 2 026)
// dec      : ratio/décimal (DSCR, couverture, payback, runway) → 2 décimales
// fracPct : fraction stockée (0,30) → affichée 30 %
// pct      : déjà en pourcentage (30) → affichée 30 %
export interface Cell { v: string | number | null; fmt: Fmt; gap?: boolean; }
export type RowKind = 'title' | 'subtitle' | 'section' | 'colheader' | 'data' | 'total' | 'spacer' | 'note';
export interface Row { kind: RowKind; cells: Cell[]; }
export interface SheetModel { name: string; rows: Row[]; widths: number[]; freezeRows?: number; freezeCols?: number; }

const TODO = 'à compléter';

// ─── Helpers de cellule ───────────────────────────────────────────────
const safe = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const T = (v: unknown, fb = ''): Cell => ({ v: v === null || v === undefined || v === '' ? fb : String(v), fmt: 'text' });
const M = (v: unknown): Cell => { const n = safe(v); return Number.isFinite(n) ? { v: n, fmt: 'money' } : { v: TODO, fmt: 'text', gap: true }; };
const I = (v: unknown): Cell => { const n = safe(v); return Number.isFinite(n) ? { v: n, fmt: 'int' } : { v: '—', fmt: 'text' }; };
const Y = (v: unknown): Cell => { const n = safe(v); return Number.isFinite(n) ? { v: n, fmt: 'year' } : { v: '—', fmt: 'text' }; };
const D = (v: unknown): Cell => { const n = safe(v); return Number.isFinite(n) ? { v: n, fmt: 'dec' } : { v: '—', fmt: 'text' }; };
const FP = (v: unknown): Cell => { const n = safe(v); return Number.isFinite(n) ? { v: n, fmt: 'fracPct' } : { v: '—', fmt: 'text' }; };
const PC = (v: unknown): Cell => { const n = safe(v); return Number.isFinite(n) ? { v: n, fmt: 'pct' } : { v: '—', fmt: 'text' }; };
const GAP: () => Cell = () => ({ v: TODO, fmt: 'text', gap: true });
const E: Cell = { v: null, fmt: 'text' }; // vide

const row = (kind: RowKind, ...cells: Cell[]): Row => ({ kind, cells });
const spacer = (): Row => ({ kind: 'spacer', cells: [] });

// Formate le taux inverse (1 devise locale = X EUR) avec précision adaptée.
function fmtInverse(inv: number): string {
  if (!Number.isFinite(inv) || inv <= 0) return '?';
  if (inv >= 1) return inv.toFixed(3);
  if (inv >= 0.01) return inv.toFixed(2);
  return inv.toPrecision(3);
}

/**
 * Construit le modèle complet du classeur (PUR — testable, sans rendu/DOM).
 */
export function buildPlanFinancierModel(plan: any): { sheets: SheetModel[] } {
  const p = plan || {};
  const currency = (p.currency && String(p.currency)) || '';
  const moneyNote = currency ? `Montants en ${currency}` : 'Montants';
  const company = (p.company && String(p.company)) || '';
  const sheets: SheetModel[] = [];

  // ── 0. Sommaire / mode d'emploi ───────────────────────────────────────
  {
    const rows: Row[] = [
      row('title', T('Plan Financier — Données')),
      row('subtitle', T(company)),
      spacer(),
      row('data', T('Pays'), T(p.country, '—')),
      row('data', T('Devise'), T(currency, '—')),
      row('data', T('Année courante'), Y(p.current_year)),
      spacer(),
      row('section', T('Mode d\'emploi')),
      row('note', T('Recopiez ces valeurs dans le modèle OVO. Les cellules « à compléter » (en jaune) sont à renseigner.')),
      row('note', T('Les taux sont en pourcentage. Les montants sont dans la devise indiquée ci-dessus.')),
      spacer(),
      row('section', T('Onglets')),
      row('data', T('Synthèse'), T('Chiffres clés par année')),
      row('data', T('Hypothèses & Pays'), T('Paramètres pays, fiscalité, change')),
      row('data', T('Situation actuelle'), T('KPIs, compte de résultat, coûts')),
      row('data', T('Projections'), T('CA, marge, EBITDA, résultat par année')),
      row('data', T('Produits & Services'), T('Détail par activité')),
      row('data', T('Ressources humaines'), T('Effectifs et charges')),
      row('data', T('OPEX & CAPEX'), T('Charges et investissements')),
      row('data', T('Financement & Prêts'), T('Prêts et échéancier')),
      row('data', T('Indicateurs'), T('VAN, TRI, DSCR, WACC, BFR')),
    ];
    sheets.push({ name: 'Sommaire', rows, widths: [34, 44] });
  }

  const projs: any[] = Array.isArray(p.projections) ? p.projections : [];
  const yearCells = (): Cell[] => projs.map((pr) => (pr.annee_num ? Y(pr.annee_num) : T(pr.annee, '')));
  const typeCell = (pr: any): Cell =>
    pr.is_gap ? GAP() : pr.is_reel ? T('réel') : pr.annee === 'CURRENT YEAR' ? T('année courante') : T('projeté');
  const metricRow = (label: string, key: string, fmt: Fmt): Row =>
    row('data', T(label), ...projs.map((pr) => (pr.is_gap ? GAP() : fmt === 'money' ? M(pr[key]) : fmt === 'pct' ? PC(pr[key]) : M(pr[key]))));

  // ── 1. Synthèse (1 page) ──────────────────────────────────────────────
  {
    const rows: Row[] = [
      row('title', T('Synthèse')),
      row('subtitle', T(`${company}${currency ? ' · ' + moneyNote : ''}`)),
      spacer(),
      row('section', T('Compte de résultat par année')),
    ];
    if (projs.length) {
      rows.push(row('colheader', T('Année'), ...yearCells()));
      rows.push(row('data', T('Type'), ...projs.map(typeCell)));
      rows.push(metricRow("Chiffre d'affaires", 'ca', 'money'));
      rows.push(metricRow('Marge brute', 'marge_brute', 'money'));
      rows.push(metricRow('EBITDA', 'ebitda', 'money'));
      rows.push(row('total', T('Résultat net'), ...projs.map((pr) => (pr.is_gap ? GAP() : M(pr.resultat_net)))));
    } else {
      rows.push(row('data', GAP()));
    }
    const ind = p.indicateurs_decision || {};
    rows.push(spacer(), row('section', T('Indicateurs de décision')));
    rows.push(row('data', T('VAN'), M(ind.van)));
    rows.push(row('data', T('TRI'), PC(ind.tri)));
    rows.push(row('data', T('Délai de retour (années)'), D(ind.payback_years)));
    rows.push(row('data', T('DSCR moyen'), D(ind.dscr_moyen)));
    if (p.wacc_metadata) rows.push(row('data', T('WACC appliqué'), PC(p.wacc_metadata.wacc_applique)));
    sheets.push({ name: 'Synthèse', rows, widths: [30, 16, 16, 16, 16, 16, 16, 16, 16, 16], freezeRows: 5, freezeCols: 1 });
  }

  // ── 2. Hypothèses & Pays ──────────────────────────────────────────────
  {
    const rate = safe(p.exchange_rate_eur);
    const fxCell: Cell = currency && Number.isFinite(rate) && rate > 0
      ? T(`1 EUR = ${p.exchange_rate_eur} ${currency} (soit 1 ${currency} = ${fmtInverse(1 / rate)} EUR)`)
      : GAP();
    const rows: Row[] = [
      row('title', T('Hypothèses & Pays')),
      row('note', T('Modèle OVO → onglet InputsData (Company / Years).')),
      spacer(),
      row('section', T('Paramètres')),
      row('data', T('Entreprise'), T(company, '—')),
      row('data', T('Pays'), T(p.country, '—')),
      row('data', T('Devise'), T(currency, '—')),
      row('data', T('Taux de change'), fxCell),
      row('data', T('Inflation'), FP(p.inflation_rate)),
      row('data', T('TVA'), FP(p.vat_rate)),
      row('data', T('Régime fiscal 1 — IS PME (réduit)'), safe(p.tax_regime_1) > 0 ? FP(p.tax_regime_1) : T('non applicable')),
      row('data', T('Régime fiscal 2 — IS standard'), FP(p.tax_regime_2)),
      row('data', T('Année courante'), Y(p.current_year)),
    ];
    if (p.years && typeof p.years === 'object') {
      rows.push(spacer(), row('section', T('Années du plan')));
      for (const [label, val] of Object.entries(p.years)) rows.push(row('data', T(label), Y(val)));
    }
    sheets.push({ name: 'Hypothèses & Pays', rows, widths: [36, 46] });
  }

  // ── 3. Situation actuelle ─────────────────────────────────────────────
  {
    const k = p.kpis || {};
    const rows: Row[] = [
      row('title', T('Situation actuelle')),
      row('subtitle', T(moneyNote)),
      spacer(),
      row('section', T('Indicateurs clés')),
      row('data', T("Chiffre d'affaires"), M(k.ca)),
      row('data', T('Résultat net'), M(k.resultat_net)),
      row('data', T('Trésorerie'), M(k.tresorerie)),
      row('data', T('Effectif'), I(k.effectif)),
    ];
    if (Array.isArray(p.compte_resultat_reel) && p.compte_resultat_reel.length) {
      const maxCols = Math.max(...p.compte_resultat_reel.map((l: any) => (l.valeurs?.length || 0)));
      rows.push(spacer(), row('section', T('Compte de résultat (réel)')));
      rows.push(row('colheader', T('Poste'), ...Array.from({ length: maxCols }, (_, i) => T(`Année ${i + 1}`))));
      for (const l of p.compte_resultat_reel) {
        rows.push(row(l.is_total ? 'total' : 'data', T(l.poste, ''), ...(l.valeurs || []).map((v: any) => M(v))));
      }
    }
    const sc = p.structure_couts;
    if (sc) {
      rows.push(spacer(), row('section', T('Structure de coûts')));
      if (Array.isArray(sc.variables) && sc.variables.length) {
        rows.push(row('colheader', T('Coûts variables'), T('Montant')));
        for (const c of sc.variables) rows.push(row('data', T(c.poste, ''), M(c.montant)));
      }
      if (Array.isArray(sc.fixes) && sc.fixes.length) {
        rows.push(row('colheader', T('Coûts fixes'), T('Montant')));
        for (const c of sc.fixes) rows.push(row('data', T(c.poste, ''), M(c.montant)));
      }
      if (sc.pct_variables !== undefined) rows.push(row('data', T('% coûts variables'), PC(sc.pct_variables)));
    }
    sheets.push({ name: 'Situation actuelle', rows, widths: [34, 16, 16, 16], freezeRows: 4, freezeCols: 1 });
  }

  // ── 4. Projections ────────────────────────────────────────────────────
  {
    const rows: Row[] = [
      row('title', T('Projections')),
      row('subtitle', T(moneyNote)),
      row('note', T('Modèle OVO → onglet Compte de résultat.')),
    ];
    if (projs.length) {
      rows.push(spacer(), row('colheader', T('Année'), ...yearCells()));
      rows.push(row('data', T('Type'), ...projs.map(typeCell)));
      const metrics: Array<[string, string, Fmt]> = [
        ["Chiffre d'affaires", 'ca', 'money'],
        ['COGS', 'cogs', 'money'],
        ['Marge brute', 'marge_brute', 'money'],
        ['Marge brute (%)', 'marge_brute_pct', 'pct'],
        ['OPEX total', 'opex_total', 'money'],
        ['EBITDA', 'ebitda', 'money'],
        ['EBITDA (%)', 'ebitda_pct', 'pct'],
        ['Amortissements', 'amortissements', 'money'],
        ["Résultat d'exploitation", 'resultat_exploitation', 'money'],
        ['Charges financières', 'charges_financieres', 'money'],
        ['Impôts', 'impots', 'money'],
        ['Cashflow', 'cashflow', 'money'],
      ];
      for (const [label, key, fmt] of metrics) rows.push(metricRow(label, key, fmt));
      rows.push(row('total', T('Résultat net'), ...projs.map((pr) => (pr.is_gap ? GAP() : M(pr.resultat_net)))));
    } else {
      rows.push(spacer(), row('data', GAP()));
    }
    sheets.push({ name: 'Projections', rows, widths: [28, ...projs.map(() => 15)], freezeRows: 5, freezeCols: 1 });
  }

  // ── 5. Produits & Services ────────────────────────────────────────────
  {
    const rows: Row[] = [row('title', T('Produits & Services')), row('subtitle', T(moneyNote))];
    const dump = (title: string, list: any[]) => {
      if (!Array.isArray(list) || !list.length) return;
      rows.push(spacer(), row('section', T(title)));
      rows.push(row('colheader', T('Nom'), T('Prix unitaire'), T('Coût unitaire'), T('Volume annuel'), T('% du CA')));
      for (const it of list) rows.push(row('data', T(it.nom, ''), M(it.prix_unitaire), M(it.cout_unitaire), I(it.volume_annuel), FP(it.part_ca)));
    };
    dump('Produits', p.produits);
    dump('Services', p.services);
    if (rows.length === 2) rows.push(spacer(), row('data', GAP()));
    sheets.push({ name: 'Produits & Services', rows, widths: [42, 15, 15, 15, 12], freezeRows: 2, freezeCols: 1 });
  }

  // ── 5b. Volumes par produit / par année (pour le modèle OVO) ──────────
  // Le modèle OVO (RevenueData) recalcule le CA = prix × volume, produit par produit
  // et par année. On fournit donc le VOLUME par produit/an, calculé pour reconstituer
  // exactement le CA total du compte de résultat : volume = (CA_année × part normalisée)
  // ÷ prix. Mix produit constant, prix/coûts constants (montée en CA = montée en volume).
  {
    const items: any[] = [
      ...(Array.isArray(p.produits) ? p.produits : []),
      ...(Array.isArray(p.services) ? p.services : []),
    ];
    const rows: Row[] = [
      row('title', T('Volumes (modèle OVO)')),
      row('note', T('Modèle OVO → RevenueData : CA = prix × volume, par produit et par année. Volumes calculés pour reconstituer le CA total (mix produit constant). Saisis prix, coût et volumes par an.')),
    ];
    const sumPart = items.reduce((s, it) => s + (Number.isFinite(safe(it.part_ca)) ? safe(it.part_ca) : 0), 0) || 1;
    if (items.length && projs.length) {
      rows.push(spacer(), row('colheader', T('Produit / Service'), T('Prix'), T('Coût'), ...yearCells()));
      for (const it of items) {
        const prix = safe(it.prix_unitaire);
        const norm = (Number.isFinite(safe(it.part_ca)) ? safe(it.part_ca) : 0) / sumPart;
        const cells = projs.map((pr) => {
          if (pr.is_gap) return GAP();
          if (!(prix > 0) || norm <= 0) return I(0);
          return I(Math.round((safe(pr.ca) || 0) * norm / prix));
        });
        rows.push(row('data', T(it.nom, ''), M(it.prix_unitaire), M(it.cout_unitaire), ...cells));
      }
      // Ligne de contrôle : CA reconstitué (somme prix × volume) ≈ CA du compte de résultat
      const ctrl = projs.map((pr) => {
        if (pr.is_gap) return GAP();
        const total = items.reduce((s, it) => {
          const prix = safe(it.prix_unitaire);
          const norm = (Number.isFinite(safe(it.part_ca)) ? safe(it.part_ca) : 0) / sumPart;
          return prix > 0 && norm > 0 ? s + Math.round((safe(pr.ca) || 0) * norm / prix) * prix : s;
        }, 0);
        return M(total);
      });
      rows.push(row('total', T('CA total reconstitué'), E, E, ...ctrl));
    } else {
      rows.push(spacer(), row('data', GAP()));
    }
    sheets.push({ name: 'Volumes (modèle OVO)', rows, widths: [42, 13, 13, ...projs.map(() => 13)], freezeRows: 2, freezeCols: 1 });
  }

  // ── 6. Ressources humaines ────────────────────────────────────────────
  {
    const staff: any[] = Array.isArray(p.staff) ? p.staff : [];
    const rows: Row[] = [row('title', T('Ressources humaines'))];
    if (staff.length) {
      rows.push(spacer(), row('colheader', T('Catégorie'), T('Département'), T('Charges sociales')));
      for (const s of staff) rows.push(row('data', T(s.categorie, ''), T(s.departement, ''), FP(s.taux_charges_sociales)));
    } else {
      rows.push(spacer(), row('data', GAP()));
    }
    sheets.push({ name: 'Ressources humaines', rows, widths: [30, 24, 16], freezeRows: 2, freezeCols: 1 });
  }

  // ── 7. OPEX & CAPEX ───────────────────────────────────────────────────
  {
    const rows: Row[] = [row('title', T('OPEX & CAPEX')), row('subtitle', T(moneyNote))];
    if (Array.isArray(p.opex_detail) && p.opex_detail.length) {
      rows.push(spacer(), row('section', T('Charges opérationnelles (OPEX)')));
      rows.push(row('colheader', T('Catégorie'), T('Sous-poste'), T('Année courante'), T('Année 5')));
      for (const o of p.opex_detail) rows.push(row('data', T(o.categorie, ''), T(o.sous_poste, ''), M(o.montant_cy), M(o.montant_y5)));
    } else if (Array.isArray(p.opex_categories) && p.opex_categories.length) {
      rows.push(spacer(), row('section', T('Charges opérationnelles (OPEX)')));
      rows.push(row('colheader', T('Poste'), T('Montant'), T('% ')));
      for (const o of p.opex_categories) rows.push(row('data', T(o.poste, ''), M(o.montant), PC(o.pct)));
    }
    if (Array.isArray(p.capex) && p.capex.length) {
      rows.push(spacer(), row('section', T('Investissements (CAPEX)')));
      rows.push(row('colheader', T('Libellé'), T('Catégorie'), T("Année d'acquisition"), T("Valeur d'acquisition"), T('Taux amortissement')));
      for (const c of p.capex) rows.push(row('data', T(c.label, ''), T(c.categorie, ''), Y(c.acquisition_year), M(c.acquisition_value), FP(c.amortisation_rate)));
    }
    if (rows.length === 2) rows.push(spacer(), row('data', GAP()));
    sheets.push({ name: 'OPEX & CAPEX', rows, widths: [28, 28, 18, 18, 16], freezeRows: 2, freezeCols: 1 });
  }

  // ── 8. Financement & Prêts ────────────────────────────────────────────
  {
    const rows: Row[] = [row('title', T('Financement & Prêts')), row('subtitle', T(moneyNote))];
    const loans = p.loans || {};
    const loanNames: Array<[string, string]> = [['ovo', 'Prêt OVO'], ['family', 'Prêt famille'], ['bank', 'Prêt bancaire']];
    rows.push(spacer(), row('section', T('Prêts')), row('colheader', T('Source'), T('Montant'), T('Taux'), T('Durée (ans)')));
    for (const [key, label] of loanNames) {
      const l = loans[key];
      if (l && safe(l.amount) > 0) {
        rows.push(row('data', T(label), M(l.amount), safe(l.rate) > 0 ? FP(l.rate) : GAP(), safe(l.term_years) > 0 ? I(l.term_years) : GAP()));
      } else {
        rows.push(row('data', T(label), GAP(), GAP(), GAP()));
      }
    }
    if (Array.isArray(p.echeancier) && p.echeancier.length) {
      const first = p.echeancier.find((e: any) => Array.isArray(e.annees) && e.annees.length);
      const years = first ? first.annees.map((a: any) => a.annee) : [];
      rows.push(spacer(), row('section', T('Échéancier de remboursement')), row('colheader', T('Poste'), ...years.map((y: any) => Y(y))));
      for (const e of p.echeancier) {
        const byYear: Record<string, any> = {};
        for (const a of e.annees || []) byYear[String(a.annee)] = a.valeur;
        const cells = years.map((y: any) => {
          const val = byYear[String(y)];
          if (val === TODO || val === undefined || val === null) return GAP();
          const n = safe(val);
          return Number.isFinite(n) ? M(n) : T(String(val));
        });
        rows.push(row(e.is_total ? 'total' : 'data', T(e.label, ''), ...cells));
      }
    }
    const ny = (Array.isArray(p.echeancier) && p.echeancier[0]?.annees?.length) || 4;
    sheets.push({ name: 'Financement & Prêts', rows, widths: [30, ...Array.from({ length: Math.max(ny, 3) }, () => 15)], freezeRows: 2, freezeCols: 1 });
  }

  // ── 9. Indicateurs de décision ────────────────────────────────────────
  {
    const ind = p.indicateurs_decision || {};
    const rows: Row[] = [
      row('title', T('Indicateurs de décision')),
      spacer(),
      row('data', T('VAN'), M(ind.van)),
      row('data', T('TRI'), PC(ind.tri)),
      row('data', T('Délai de retour (années)'), D(ind.payback_years)),
      row('data', T('DSCR moyen'), D(ind.dscr_moyen)),
      row('data', T('ROI'), PC(ind.roi)),
      row('data', T('Couverture des intérêts'), D(ind.couverture_interets)),
      row('data', T('Cycle de trésorerie (jours)'), I(ind.cycle_tresorerie)),
      row('data', T('Runway (mois)'), D(ind.runway_mois)),
    ];
    if (p.wacc_metadata) {
      rows.push(spacer(), row('section', T('WACC')), row('data', T('WACC brut'), PC(p.wacc_metadata.wacc_brut)), row('data', T('WACC appliqué'), PC(p.wacc_metadata.wacc_applique)));
    }
    const bfr = p.bfr_detail;
    if (bfr) {
      rows.push(spacer(), row('section', T('Besoin en fonds de roulement (BFR)')),
        row('data', T('Délai clients (jours)'), I(bfr.delai_clients_jours)),
        row('data', T('Délai fournisseurs (jours)'), I(bfr.delai_fournisseurs_jours)),
        row('data', T('Stock moyen (jours)'), I(bfr.stock_moyen_jours)),
        row('data', T('Montant BFR'), M(bfr.bfr_montant)));
    }
    sheets.push({ name: 'Indicateurs', rows, widths: [34, 18] });
  }

  return sheets.length ? { sheets } : { sheets };
}

// ─── Rendu exceljs (chargé dynamiquement) ─────────────────────────────

// Palette
const C = {
  brand: 'FF1E3A5F',      // navy — titres / bandeaux de section
  brandText: 'FFFFFFFF',
  colHeader: 'FFE7EDF3',  // gris-bleu clair — en-têtes de colonnes
  gap: 'FFFEF3C7',        // jaune ambre — « à compléter »
  gapText: 'FF92400E',
  reel: 'FFEEF2F6',       // gris clair — colonnes réelles (type)
  courante: 'FFD7E6FB',   // bleu clair — année courante
  band: 'FFF8FAFC',       // bandes alternées
  border: 'FFD0D7DE',
};

function numFmtFor(fmt: Fmt): string | undefined {
  switch (fmt) {
    case 'money': return '#,##0';
    case 'int': return '#,##0';
    case 'year': return '0';
    case 'dec': return '0.00';
    case 'fracPct': return '0.0%';
    case 'pct': return '0.0"%"';
    default: return undefined;
  }
}

/**
 * Assemble le classeur stylé et déclenche le téléchargement (exceljs, importé dynamiquement).
 */
export async function downloadPlanFinancierExcel(plan: any, fileName: string): Promise<void> {
  const mod: any = await import('exceljs');
  const ExcelJS = mod?.Workbook ? mod : (mod?.default ?? mod);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ESONO';

  const { sheets } = buildPlanFinancierModel(plan);

  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), {
      views: s.freezeRows ? [{ state: 'frozen', xSplit: s.freezeCols || 0, ySplit: s.freezeRows }] : undefined,
    });
    ws.columns = s.widths.map((w) => ({ width: w }));

    let dataIdx = 0;
    s.rows.forEach((r) => {
      const xlRow = ws.addRow(r.cells.map((c) => (c.v === null ? null : c.v)));
      xlRow.height = r.kind === 'title' ? 22 : undefined;

      r.cells.forEach((c, ci) => {
        const cell = xlRow.getCell(ci + 1);
        const nf = numFmtFor(c.fmt);
        if (nf && typeof c.v === 'number') cell.numFmt = nf;
        cell.alignment = { vertical: 'middle', horizontal: ci === 0 ? 'left' : (typeof c.v === 'number' ? 'right' : 'center'), wrapText: false };

        // Styles par type de ligne
        if (r.kind === 'title') {
          cell.font = { bold: true, size: 15, color: { argb: C.brand } };
        } else if (r.kind === 'subtitle' || r.kind === 'note') {
          cell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
        } else if (r.kind === 'section') {
          cell.font = { bold: true, color: { argb: C.brandText } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.brand } };
        } else if (r.kind === 'colheader') {
          cell.font = { bold: true, color: { argb: C.brand } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.colHeader } };
          cell.border = { bottom: { style: 'thin', color: { argb: C.border } } };
        } else if (r.kind === 'total') {
          cell.font = { bold: true };
          cell.border = { top: { style: 'thin', color: { argb: C.border } } };
        } else if (r.kind === 'data') {
          if (dataIdx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.band } };
          if (ci === 0) cell.font = { bold: false, color: { argb: 'FF334155' } };
        }

        // Surlignage sémantique (prioritaire sur les bandes)
        if (c.gap) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.gap } };
          cell.font = { color: { argb: C.gapText }, italic: true };
        } else if (c.v === 'réel') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.reel } };
        } else if (c.v === 'année courante') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.courante } };
          cell.font = { bold: true, color: { argb: C.brand } };
        }
      });

      if (r.kind === 'data') dataIdx++;
      else if (r.kind === 'section' || r.kind === 'title') dataIdx = 0;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
