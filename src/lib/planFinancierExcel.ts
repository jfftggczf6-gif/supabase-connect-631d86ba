// Génère un Excel (.xlsx) PROPRE et SIMPLE à partir de l'objet plan financier
// calculé (PlanFinancierComputed). Objectif : fournir à OVO un classeur lisible
// — un onglet par section, valeurs brutes, AUCUNE formule, aucune liste
// déroulante, aucun mapping de cellule — pour qu'ils recopient eux-mêmes dans
// leur modèle officiel. C'est l'alternative robuste au remplissage automatique
// du gabarit .xlsm (qui concentre tous les bugs de mapping/dropdown/FX/prêts).
//
// PRINCIPE : on recopie FIDÈLEMENT les données du moteur déterministe. On ne
// transforme pas les valeurs (pas de ×100, pas d'arrondi destructif) pour ne
// jamais réintroduire de chiffre faux. Les données manquantes restent
// « à compléter » telles que le moteur les a marquées.

// `xlsx` est chargé dynamiquement (au clic d'export) pour ne pas alourdir le
// bundle initial — voir downloadPlanFinancierExcel.

export type Cell = string | number;
export type Row = Cell[];
export interface SheetDef {
  name: string;
  rows: Row[];
}

// Valeur numérique sûre : renvoie le nombre tel quel s'il est fini, sinon "".
function num(v: unknown): Cell {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

// Texte sûr avec repli.
function txt(v: unknown, fallback = '—'): Cell {
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
}

const TODO = 'à compléter';

/**
 * Construit la liste des onglets (sections) du classeur à partir du plan calculé.
 * Fonction PURE et testable — ne touche pas au DOM.
 */
export function buildPlanFinancierSheets(plan: any): SheetDef[] {
  const p = plan || {};
  const currency = txt(p.currency, '');
  const moneyNote = currency ? `(montants en ${currency})` : '';
  const sheets: SheetDef[] = [];

  // ── 1. Hypothèses & Pays ──────────────────────────────────────────────
  {
    const rows: Row[] = [
      ['PLAN FINANCIER — DONNÉES', txt(p.company, '')],
      [],
      ['PARAMÈTRES PAYS & HYPOTHÈSES'],
      ['Entreprise', txt(p.company, '')],
      ['Pays', txt(p.country, '')],
      ['Devise', txt(p.currency, '')],
      [
        'Taux de change',
        currency && Number.isFinite(Number(p.exchange_rate_eur))
          ? `1 EUR = ${p.exchange_rate_eur} ${currency}`
          : TODO,
      ],
      ['Inflation (taux)', num(p.inflation_rate)],
      ['TVA (taux)', num(p.vat_rate)],
      ['Régime fiscal 1 — IS (taux)', num(p.tax_regime_1)],
      ['Régime fiscal 2 (taux)', num(p.tax_regime_2)],
      ['Année de référence', num(p.current_year)],
    ];
    if (p.years && typeof p.years === 'object') {
      rows.push([], ['Années du plan']);
      for (const [label, val] of Object.entries(p.years)) {
        rows.push([label, num(val)]);
      }
    }
    sheets.push({ name: 'Hypothèses & Pays', rows });
  }

  // ── 2. Situation actuelle ─────────────────────────────────────────────
  {
    const rows: Row[] = [['SITUATION ACTUELLE', moneyNote]];
    const k = p.kpis || {};
    rows.push(
      [],
      ['Indicateurs clés'],
      ["Chiffre d'affaires", num(k.ca)],
      ['Résultat net', num(k.resultat_net)],
      ['Trésorerie', num(k.tresorerie)],
      ['Effectif', num(k.effectif)],
    );
    if (Array.isArray(p.compte_resultat_reel) && p.compte_resultat_reel.length) {
      rows.push([], ['Compte de résultat (réel)']);
      const maxCols = Math.max(...p.compte_resultat_reel.map((l: any) => (l.valeurs?.length || 0)));
      rows.push(['Poste', ...Array.from({ length: maxCols }, (_, i) => `Valeur ${i + 1}`)]);
      for (const l of p.compte_resultat_reel) {
        rows.push([txt(l.poste, ''), ...(l.valeurs || []).map((v: any) => num(v))]);
      }
    }
    const sc = p.structure_couts;
    if (sc) {
      rows.push([], ['Structure de coûts']);
      if (Array.isArray(sc.variables) && sc.variables.length) {
        rows.push(['Coûts variables']);
        for (const c of sc.variables) rows.push([txt(c.poste, ''), num(c.montant)]);
      }
      if (Array.isArray(sc.fixes) && sc.fixes.length) {
        rows.push(['Coûts fixes']);
        for (const c of sc.fixes) rows.push([txt(c.poste, ''), num(c.montant)]);
      }
      if (sc.pct_variables !== undefined) rows.push(['% coûts variables', num(sc.pct_variables)]);
    }
    sheets.push({ name: 'Situation actuelle', rows });
  }

  // ── 3. Projections ────────────────────────────────────────────────────
  {
    const projs: any[] = Array.isArray(p.projections) ? p.projections : [];
    const rows: Row[] = [[`PROJECTIONS ${moneyNote}`.trim()]];
    if (projs.length) {
      const years = projs.map((pr) => txt(pr.annee, ''));
      rows.push([], ['', ...years]);
      rows.push(['Type', ...projs.map((pr) => (pr.is_reel ? 'réel' : 'projeté'))]);
      const metrics: Array<[string, string]> = [
        ["Chiffre d'affaires", 'ca'],
        ['COGS', 'cogs'],
        ['Marge brute', 'marge_brute'],
        ['Marge brute (%)', 'marge_brute_pct'],
        ['OPEX total', 'opex_total'],
        ['EBITDA', 'ebitda'],
        ['EBITDA (%)', 'ebitda_pct'],
        ['Amortissements', 'amortissements'],
        ["Résultat d'exploitation", 'resultat_exploitation'],
        ['Charges financières', 'charges_financieres'],
        ['Impôts', 'impots'],
        ['Résultat net', 'resultat_net'],
        ['Cashflow', 'cashflow'],
      ];
      for (const [label, key] of metrics) {
        rows.push([label, ...projs.map((pr) => num(pr[key]))]);
      }
    } else {
      rows.push([], [TODO]);
    }
    sheets.push({ name: 'Projections', rows });
  }

  // ── 4. Produits & Services ────────────────────────────────────────────
  {
    const rows: Row[] = [['PRODUITS & SERVICES', moneyNote]];
    const dump = (title: string, list: any[]) => {
      if (!Array.isArray(list) || !list.length) return;
      rows.push([], [title]);
      rows.push(['Nom', 'Prix unitaire', 'Coût unitaire', 'Volume annuel', '% du CA']);
      for (const it of list) {
        rows.push([
          txt(it.nom, ''),
          num(it.prix_unitaire),
          num(it.cout_unitaire),
          num(it.volume_annuel),
          num(it.part_ca),
        ]);
      }
    };
    dump('Produits', p.produits);
    dump('Services', p.services);
    if (rows.length === 1) rows.push([], [TODO]);
    sheets.push({ name: 'Produits & Services', rows });
  }

  // ── 5. Ressources humaines ────────────────────────────────────────────
  {
    const staff: any[] = Array.isArray(p.staff) ? p.staff : [];
    const rows: Row[] = [['RESSOURCES HUMAINES']];
    if (staff.length) {
      rows.push([], ['Catégorie', 'Département', 'Charges sociales (taux)']);
      for (const s of staff) {
        rows.push([txt(s.categorie, ''), txt(s.departement, ''), num(s.taux_charges_sociales)]);
      }
    } else {
      rows.push([], [TODO]);
    }
    sheets.push({ name: 'Ressources humaines', rows });
  }

  // ── 6. OPEX & CAPEX ───────────────────────────────────────────────────
  {
    const rows: Row[] = [['OPEX & CAPEX', moneyNote]];
    if (Array.isArray(p.opex_detail) && p.opex_detail.length) {
      rows.push([], ['Charges opérationnelles (OPEX)']);
      rows.push(['Catégorie', 'Sous-poste', 'Année courante', 'Année 5']);
      for (const o of p.opex_detail) {
        rows.push([txt(o.categorie, ''), txt(o.sous_poste, ''), num(o.montant_cy), num(o.montant_y5)]);
      }
    } else if (Array.isArray(p.opex_categories) && p.opex_categories.length) {
      rows.push([], ['Charges opérationnelles (OPEX)']);
      rows.push(['Poste', 'Montant', '% ']);
      for (const o of p.opex_categories) rows.push([txt(o.poste, ''), num(o.montant), num(o.pct)]);
    }
    if (Array.isArray(p.capex) && p.capex.length) {
      rows.push([], ['Investissements (CAPEX)']);
      rows.push(['Libellé', 'Catégorie', "Année d'acquisition", "Valeur d'acquisition", 'Taux amortissement']);
      for (const c of p.capex) {
        rows.push([
          txt(c.label, ''),
          txt(c.categorie, ''),
          num(c.acquisition_year),
          num(c.acquisition_value),
          num(c.amortisation_rate),
        ]);
      }
    }
    if (rows.length === 1) rows.push([], [TODO]);
    sheets.push({ name: 'OPEX & CAPEX', rows });
  }

  // ── 7. Financement & Prêts ────────────────────────────────────────────
  {
    const rows: Row[] = [['FINANCEMENT & PRÊTS', moneyNote]];
    const loans = p.loans || {};
    const loanNames: Array<[string, string]> = [
      ['ovo', 'Prêt OVO'],
      ['family', 'Prêt famille'],
      ['bank', 'Prêt bancaire'],
    ];
    rows.push([], ['Prêts'], ['Source', 'Montant', 'Taux', 'Durée (ans)']);
    for (const [key, label] of loanNames) {
      const l = loans[key];
      if (l && Number(l.amount) > 0) {
        rows.push([
          label,
          num(l.amount),
          Number(l.rate) > 0 ? num(l.rate) : TODO,
          Number(l.term_years) > 0 ? num(l.term_years) : TODO,
        ]);
      } else {
        rows.push([label, TODO, TODO, TODO]);
      }
    }
    if (Array.isArray(p.echeancier) && p.echeancier.length) {
      const first = p.echeancier.find((e: any) => Array.isArray(e.annees) && e.annees.length);
      const years = first ? first.annees.map((a: any) => txt(a.annee, '')) : [];
      rows.push([], ["Échéancier de remboursement"], ['Poste', ...years]);
      for (const e of p.echeancier) {
        const byYear: Record<string, Cell> = {};
        for (const a of e.annees || []) byYear[String(a.annee)] = txt(a.valeur, '');
        rows.push([txt(e.label, ''), ...years.map((y: any) => byYear[String(y)] ?? '')]);
      }
    }
    sheets.push({ name: 'Financement & Prêts', rows });
  }

  // ── 8. Indicateurs de décision ────────────────────────────────────────
  {
    const rows: Row[] = [['INDICATEURS DE DÉCISION']];
    const ind = p.indicateurs_decision || {};
    rows.push(
      [],
      ['VAN', num(ind.van)],
      ['TRI', num(ind.tri)],
      ['Payback (années)', num(ind.payback_years)],
      ['DSCR moyen', num(ind.dscr_moyen)],
      ['ROI', num(ind.roi)],
      ['Couverture des intérêts', num(ind.couverture_interets)],
      ['Cycle de trésorerie', num(ind.cycle_tresorerie)],
      ['Runway (mois)', num(ind.runway_mois)],
    );
    const w = p.wacc_metadata;
    if (w) {
      rows.push([], ['WACC'], ['WACC brut', num(w.wacc_brut)], ['WACC appliqué', num(w.wacc_applique)]);
    }
    const bfr = p.bfr_detail;
    if (bfr) {
      rows.push(
        [],
        ['Besoin en fonds de roulement (BFR)'],
        ['Délai clients (jours)', num(bfr.delai_clients_jours)],
        ['Délai fournisseurs (jours)', num(bfr.delai_fournisseurs_jours)],
        ['Stock moyen (jours)', num(bfr.stock_moyen_jours)],
        ['Montant BFR', num(bfr.bfr_montant)],
      );
    }
    sheets.push({ name: 'Indicateurs', rows });
  }

  return sheets;
}

// Largeurs de colonnes par défaut (lisibilité). On élargit la 1re colonne.
function colWidths(rows: Row[]): { wch: number }[] {
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return Array.from({ length: maxCols }, (_, i) => ({ wch: i === 0 ? 36 : 16 }));
}

/**
 * Assemble le classeur et déclenche le téléchargement dans le navigateur.
 * `xlsx` est importé dynamiquement (code-splitting).
 */
export async function downloadPlanFinancierExcel(plan: any, fileName: string): Promise<void> {
  // Interop défensive : selon le bundler, l'import dynamique d'un module CJS
  // peut exposer l'API sur le namespace OU sur `.default`.
  const mod: any = await import('xlsx');
  const XLSX: any = mod?.utils ? mod : (mod?.default ?? mod);
  if (!XLSX?.utils || !XLSX?.writeFile) {
    throw new Error('Librairie xlsx indisponible (utils/writeFile manquants)');
  }
  const sheets = buildPlanFinancierSheets(plan);
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = colWidths(s.rows);
    // Nom d'onglet : max 31 caractères, pas de caractères interdits.
    const safeName = s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  XLSX.writeFile(wb, fileName);
}
