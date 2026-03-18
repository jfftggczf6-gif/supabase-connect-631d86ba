/**
 * Normalizers for AI JSON responses
 * Handles key variations from different AI model outputs
 */
import { getFiscalParams } from "./helpers.ts";

// ===== GENERIC HELPERS =====
function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj?.[k] !== undefined) return obj[k];
  }
  return undefined;
}

function toArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : v?.item || v?.description || v?.name || JSON.stringify(v));
  if (typeof val === 'string') return [val];
  return [];
}

function toNumber(val: any, fallback = 0): number {
  if (val == null) return fallback;
  const n = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.-]/g, '')) : Number(val);
  return isNaN(n) ? fallback : n;
}

// ===== BMC NORMALIZER =====
export function normalizeBmc(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };

  // Normalize score
  d.score_global = toNumber(pick(d, 'score_global', 'score', 'scoreGlobal', 'score_bmc'), 0);
  d.score = d.score_global;

  // Normalize maturity
  d.maturite = pick(d, 'maturite', 'maturité', 'maturity', 'niveau_maturite') || 'Non évalué';

  // Normalize canvas keys (handle flat arrays vs structured objects)
  if (d.canvas) {
    const c = d.canvas;
    // partenaires_cles might be array or object
    if (Array.isArray(c.partenaires_cles)) c.partenaires_cles = { items: c.partenaires_cles };
    if (Array.isArray(c.activites_cles)) c.activites_cles = { items: c.activites_cles };
    if (Array.isArray(c.ressources_cles)) c.ressources_cles = { items: c.ressources_cles };
    if (Array.isArray(c.canaux)) c.canaux = { items: c.canaux };
    if (Array.isArray(c.relations_clients)) c.relations_clients = { items: c.relations_clients };

    // proposition_valeur might be string
    if (typeof c.proposition_valeur === 'string') c.proposition_valeur = { enonce: c.proposition_valeur, avantages: [] };

    // segments_clients might be array
    if (Array.isArray(c.segments_clients)) c.segments_clients = { principal: c.segments_clients[0] || '' };

    // structure_couts might be array of strings
    if (Array.isArray(c.structure_couts)) c.structure_couts = { postes: c.structure_couts.map((s: any) => typeof s === 'string' ? { libelle: s } : s) };
    // H4: Ensure structure_couts.postes[].montant is numeric, not string
    if (c.structure_couts?.postes && Array.isArray(c.structure_couts.postes)) {
      c.structure_couts.postes = c.structure_couts.postes.map((p: any) => ({
        ...p,
        montant: p.montant != null ? toNumber(p.montant, 0) : undefined,
      }));
    }

    // flux_revenus might be array
    if (Array.isArray(c.flux_revenus)) c.flux_revenus = { produit_principal: c.flux_revenus[0] || '' };
  }

  // Normalize SWOT key variants
  if (d.swot) {
    d.swot.forces = toArray(pick(d.swot, 'forces', 'strengths', 'points_forts'));
    d.swot.faiblesses = toArray(pick(d.swot, 'faiblesses', 'weaknesses', 'points_faibles'));
    d.swot.opportunites = toArray(pick(d.swot, 'opportunites', 'opportunités', 'opportunities'));
    d.swot.menaces = toArray(pick(d.swot, 'menaces', 'threats'));
  }

  // Normalize recommandations (might be array instead of object)
  if (Array.isArray(d.recommandations)) {
    d.recommandations = { court_terme: d.recommandations[0] || '', moyen_terme: d.recommandations[1] || '', long_terme: d.recommandations[2] || '' };
  }

  return d;
}

// ===== SIC NORMALIZER =====
export function normalizeSic(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  d.score = toNumber(pick(d, 'score', 'score_global', 'score_sic'), 0);
  d.score_global = d.score;

  // Normalize ODD alignment
  if (d.odd_alignment) {
    d.odd_alignment = toArray(d.odd_alignment).length ? d.odd_alignment : 
      (Array.isArray(d.odd_alignment) ? d.odd_alignment.map((o: any) => ({
        odd_number: toNumber(pick(o, 'odd_number', 'numero', 'number', 'odd')),
        odd_name: pick(o, 'odd_name', 'nom', 'name') || '',
        contribution: pick(o, 'contribution', 'description') || '',
        level: pick(o, 'level', 'niveau', 'force') || 'Moyen',
      })) : []);
  }

  // Normalize théorie du changement keys
  if (d.theorie_changement || d.theory_of_change) {
    const tc = d.theorie_changement || d.theory_of_change;
    d.theorie_changement = {
      inputs: toArray(pick(tc, 'inputs', 'intrants', 'ressources')),
      activites: toArray(pick(tc, 'activites', 'activités', 'activities')),
      outputs: toArray(pick(tc, 'outputs', 'extrants', 'produits')),
      outcomes: toArray(pick(tc, 'outcomes', 'résultats', 'resultats')),
      impact: toArray(pick(tc, 'impact', 'impacts')),
    };
  }

  return d;
}

// ===== INPUTS NORMALIZER =====
export function normalizeInputs(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  d.score = toNumber(pick(d, 'score', 'score_global'), 0);

  // Normalize compte_resultat key variants
  const cr = d.compte_resultat || d.income_statement || d.compte_de_resultat || {};
  d.compte_resultat = {
    chiffre_affaires: toNumber(pick(cr, 'chiffre_affaires', 'ca', 'revenue', 'chiffre_daffaires')),
    achats_matieres: toNumber(pick(cr, 'achats_matieres', 'achats', 'cost_of_goods', 'achats_matières')),
    charges_personnel: toNumber(pick(cr, 'charges_personnel', 'salaires', 'personnel', 'masse_salariale')),
    charges_externes: toNumber(pick(cr, 'charges_externes', 'autres_charges', 'external_costs')),
    dotations_amortissements: toNumber(pick(cr, 'dotations_amortissements', 'amortissements', 'depreciation')),
    resultat_exploitation: toNumber(pick(cr, 'resultat_exploitation', 'ebit', 'resultat_dexploitation')),
    charges_financieres: toNumber(pick(cr, 'charges_financieres', 'charges_financières', 'interest')),
    resultat_net: toNumber(pick(cr, 'resultat_net', 'net_income', 'bénéfice_net')),
  };

  // Normalize bilan key variants
  const rawBilan = d.bilan || d.balance_sheet || d.bilan_comptable || {};
  const rawActif = rawBilan.actif || rawBilan.assets || rawBilan.asset || {};
  const rawPassif = rawBilan.passif || rawBilan.liabilities || rawBilan.passifs || {};
  const actif = {
    immobilisations: toNumber(pick(rawActif, 'immobilisations', 'fixed_assets', 'immo')),
    stocks: toNumber(pick(rawActif, 'stocks', 'inventories', 'inventory')),
    creances_clients: toNumber(pick(rawActif, 'creances_clients', 'créances_clients', 'receivables', 'creances')),
    tresorerie: toNumber(pick(rawActif, 'tresorerie', 'trésorerie', 'cash', 'disponibilites')),
    total_actif: toNumber(pick(rawActif, 'total_actif', 'total_assets', 'total')),
  };
  const passif = {
    capitaux_propres: toNumber(pick(rawPassif, 'capitaux_propres', 'equity', 'fonds_propres')),
    dettes_lt: toNumber(pick(rawPassif, 'dettes_lt', 'long_term_debt', 'dettes_long_terme')),
    dettes_ct: toNumber(pick(rawPassif, 'dettes_ct', 'short_term_debt', 'dettes_court_terme')),
    fournisseurs: toNumber(pick(rawPassif, 'fournisseurs', 'payables', 'accounts_payable')),
    total_passif: toNumber(pick(rawPassif, 'total_passif', 'total_liabilities', 'total')),
  };

  // Validation: Total Actif == Total Passif
  if (actif.total_actif > 0 && passif.total_passif > 0 && actif.total_actif !== passif.total_passif) {
    const ecartPct = Math.abs(actif.total_actif - passif.total_passif) / Math.max(actif.total_actif, passif.total_passif);
    console.warn(`[normalizeInputs] Bilan déséquilibré: Actif=${actif.total_actif}, Passif=${passif.total_passif} (écart ${(ecartPct*100).toFixed(1)}%). Ajustement proportionnel.`);
    const maxTotal = Math.max(actif.total_actif, passif.total_passif);
    // Adjust sub-items proportionally rather than just forcing totals
    if (actif.total_actif < maxTotal) {
      const ratioActif = maxTotal / actif.total_actif;
      actif.immobilisations = Math.round(actif.immobilisations * ratioActif);
      actif.stocks = Math.round(actif.stocks * ratioActif);
      actif.creances_clients = Math.round(actif.creances_clients * ratioActif);
      actif.tresorerie = Math.round(actif.tresorerie * ratioActif);
    } else {
      const ratioPassif = maxTotal / passif.total_passif;
      passif.capitaux_propres = Math.round(passif.capitaux_propres * ratioPassif);
      passif.dettes_lt = Math.round(passif.dettes_lt * ratioPassif);
      passif.dettes_ct = Math.round(passif.dettes_ct * ratioPassif);
      passif.fournisseurs = Math.round(passif.fournisseurs * ratioPassif);
    }
    actif.total_actif = maxTotal;
    passif.total_passif = maxTotal;
  }

  d.bilan = { actif, passif };

  // Normalize effectifs
  const rawEff = d.effectifs || d.employees || d.staff || {};
  d.effectifs = {
    total: toNumber(pick(rawEff, 'total', 'count', 'nombre')),
    cadres: toNumber(pick(rawEff, 'cadres', 'managers', 'management')),
    employes: toNumber(pick(rawEff, 'employes', 'employés', 'workers', 'ouvriers')),
  };

  // ── Normalize informations_generales (passthrough, preserve if present) ──
  if (d.informations_generales && typeof d.informations_generales === 'object') {
    // Just preserve as-is, no transformation needed
  }

  // ── Normalize historique_3ans ──
  if (d.historique_3ans && typeof d.historique_3ans === 'object') {
    for (const key of ['n_moins_2', 'n_moins_1', 'n']) {
      const yr = d.historique_3ans[key];
      if (yr && typeof yr === 'object') {
        yr.ca_total = toNumber(pick(yr, 'ca_total', 'chiffre_affaires', 'ca'), 0);
        yr.couts_variables = toNumber(pick(yr, 'couts_variables', 'charges_variables'), 0);
        yr.charges_fixes = toNumber(pick(yr, 'charges_fixes', 'couts_fixes'), 0);
        yr.resultat_exploitation = toNumber(pick(yr, 'resultat_exploitation', 'ebit'), 0);
        yr.resultat_net = toNumber(pick(yr, 'resultat_net', 'net_income'), 0);
        yr.nombre_clients = toNumber(pick(yr, 'nombre_clients', 'clients'), 0);
        yr.nombre_employes = toNumber(pick(yr, 'nombre_employes', 'employes', 'effectif'), 0);
        yr.tresorerie = toNumber(pick(yr, 'tresorerie', 'trésorerie', 'cash'), 0);
        // Preserve ca_par_produit array as-is if present
      }
    }
  }

  // ── Normalize equipe ──
  if (d.equipe && Array.isArray(d.equipe)) {
    d.equipe = d.equipe.map((e: any) => ({
      poste: e.poste || e.titre || e.role || 'Non spécifié',
      nombre: toNumber(pick(e, 'nombre', 'effectif', 'count'), 0),
      salaire_mensuel: toNumber(pick(e, 'salaire_mensuel', 'salaire', 'salary'), 0),
      charges_sociales_pct: toNumber(pick(e, 'charges_sociales_pct', 'charges_sociales', 'social_rate'), 0),
    }));
  }

  // ── Normalize couts_variables ──
  if (d.couts_variables && Array.isArray(d.couts_variables)) {
    d.couts_variables = d.couts_variables.map((c: any) => ({
      poste: c.poste || c.libelle || c.label || 'Non spécifié',
      montant_mensuel: toNumber(pick(c, 'montant_mensuel', 'mensuel'), 0),
      montant_annuel: toNumber(pick(c, 'montant_annuel', 'montant_annuel_an1', 'annuel'), 0),
    }));
  }

  // ── Normalize couts_fixes ──
  if (d.couts_fixes && Array.isArray(d.couts_fixes)) {
    d.couts_fixes = d.couts_fixes.map((c: any) => ({
      poste: c.poste || c.libelle || c.label || 'Non spécifié',
      montant_mensuel: toNumber(pick(c, 'montant_mensuel', 'mensuel'), 0),
      montant_annuel: toNumber(pick(c, 'montant_annuel', 'montant_annuel_an1', 'annuel'), 0),
    }));
  }

  // ── Normalize bfr ──
  if (d.bfr && typeof d.bfr === 'object') {
    d.bfr = {
      delai_clients_jours: toNumber(pick(d.bfr, 'delai_clients_jours', 'dso', 'delai_clients'), 0),
      delai_fournisseurs_jours: toNumber(pick(d.bfr, 'delai_fournisseurs_jours', 'dpo', 'delai_fournisseurs'), 0),
      stock_moyen_jours: toNumber(pick(d.bfr, 'stock_moyen_jours', 'dio', 'stock_jours', 'rotation_stock'), 0),
      tresorerie_depart: toNumber(pick(d.bfr, 'tresorerie_depart', 'tresorerie_initiale', 'cash_depart'), 0),
    };
  }

  // ── Normalize investissements ──
  if (d.investissements && Array.isArray(d.investissements)) {
    d.investissements = d.investissements.map((inv: any) => ({
      nature: inv.nature || inv.type || inv.libelle || 'Non spécifié',
      montant: toNumber(pick(inv, 'montant', 'amount', 'valeur'), 0),
      annee_achat: toNumber(pick(inv, 'annee_achat', 'annee', 'year'), 0),
      duree_amortissement_ans: toNumber(pick(inv, 'duree_amortissement_ans', 'duree_amortissement', 'amortissement'), 0),
    }));
  }

  // ── Normalize financement ──
  if (d.financement && typeof d.financement === 'object') {
    d.financement.apports_capital = toNumber(pick(d.financement, 'apports_capital', 'capital', 'apports'), 0);
    d.financement.subventions = toNumber(pick(d.financement, 'subventions', 'grants', 'subvention'), 0);
    if (d.financement.prets && Array.isArray(d.financement.prets)) {
      d.financement.prets = d.financement.prets.map((p: any) => ({
        source: p.source || p.banque || p.preteur || 'Non spécifié',
        montant: toNumber(pick(p, 'montant', 'amount'), 0),
        taux_pct: toNumber(pick(p, 'taux_pct', 'taux', 'rate'), 0),
        duree_mois: toNumber(pick(p, 'duree_mois', 'duree', 'term'), 0),
        differe_mois: toNumber(pick(p, 'differe_mois', 'differe', 'grace_period'), 0),
      }));
    }
  }

  // ── Normalize hypotheses_croissance ──
  if (d.hypotheses_croissance && typeof d.hypotheses_croissance === 'object') {
    const hc = d.hypotheses_croissance;
    hc.taux_marge_brute_cible = toNumber(pick(hc, 'taux_marge_brute_cible', 'marge_brute_cible'), 0);
    hc.taux_marge_operationnelle_cible = toNumber(pick(hc, 'taux_marge_operationnelle_cible', 'marge_op_cible'), 0);
    hc.inflation_annuelle = toNumber(pick(hc, 'inflation_annuelle', 'inflation'), 0);
    hc.augmentation_prix_annuelle = toNumber(pick(hc, 'augmentation_prix_annuelle', 'hausse_prix'), 0);
    hc.croissance_volumes_annuelle = toNumber(pick(hc, 'croissance_volumes_annuelle', 'croissance_volumes'), 0);
    hc.taux_is = toNumber(pick(hc, 'taux_is', 'impot_societes'), 0);
    // Preserve objectifs_ca array as-is
  }

  return d;
}

// ===== FRAMEWORK NORMALIZER =====
export function normalizeFramework(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  d.score = toNumber(pick(d, 'score', 'score_global'), 0);
  d.points_forts = toArray(pick(d, 'points_forts', 'forces', 'strengths'));
  d.points_faibles = toArray(pick(d, 'points_faibles', 'faiblesses', 'weaknesses'));
  d.recommandations = toArray(pick(d, 'recommandations', 'recommendations'));

  // Ensure ratios_historiques is always an array
  if (d.ratios_historiques && !Array.isArray(d.ratios_historiques)) {
    d.ratios_historiques = [];
  }

  // Normalize projection_5ans.lignes — ensure all 8 lines exist
  if (d.projection_5ans?.lignes && Array.isArray(d.projection_5ans.lignes)) {
    d.projection_5ans.lignes = d.projection_5ans.lignes.map((l: any) => {
      const result = { ...l };
      // Ensure numeric values for an1-an5
      for (const yr of ['an1', 'an2', 'an3', 'an4', 'an5']) {
        if (result[yr] != null && typeof result[yr] === 'string') {
          const cleaned = result[yr].replace(/[%\s,]/g, '');
          const num = parseFloat(cleaned);
          if (!isNaN(num) && !result[yr].includes('%')) result[yr] = num;
        }
      }
      return result;
    });
  }

  // ── M6: Ensure projection_5ans.lignes has exactly 8 required lines ──
  const REQUIRED_LIGNES = [
    "CA Total",
    "Marge Brute",
    "Marge Brute %",
    "EBITDA",
    "Marge EBITDA %",
    "Résultat Net",
    "Cash-Flow Net",
    "Trésorerie Cumulée",
  ];
  if (d.projection_5ans) {
    if (!Array.isArray(d.projection_5ans.lignes)) d.projection_5ans.lignes = [];
    const existingLabels = d.projection_5ans.lignes.map((l: any) =>
      (l.poste || l.libelle || '').toLowerCase()
    );
    for (const req of REQUIRED_LIGNES) {
      const reqLow = req.toLowerCase();
      const exists = existingLabels.some((lb: string) => lb.includes(reqLow.split(' ')[0]) && (reqLow.length < 5 || lb.includes(reqLow.substring(0, 5))));
      if (!exists) {
        d.projection_5ans.lignes.push({ poste: req, an1: 0, an2: 0, an3: 0, an4: 0, an5: 0 });
        console.warn(`[normalizeFramework] Missing required ligne "${req}" — added with zeros`);
      }
    }
  }

  // ── H7: Replace <montant> placeholders in scenarios.sensibilite ──
  if (d.scenarios?.sensibilite && Array.isArray(d.scenarios.sensibilite)) {
    const hasPlaceholder = d.scenarios.sensibilite.some((s: any) => typeof s === 'string' && s.includes('<montant>'));
    if (hasPlaceholder && d.projection_5ans?.lignes) {
      const lignes = d.projection_5ans.lignes;
      const findVal = (...keywords: string[]): number => {
        const l = lignes.find((ln: any) => {
          const lb = (ln.poste || ln.libelle || '').toLowerCase();
          return keywords.every(k => lb.includes(k.toLowerCase()));
        });
        return l ? (toNumber(l.an1, 0)) : 0;
      };
      const caAn1 = findVal('CA') || findVal('chiffre');
      const margeAn1 = findVal('marge brute');
      const ebitdaAn1 = findVal('ebitda');
      const margePct = caAn1 > 0 ? margeAn1 / caAn1 : 0.3;
      const fixedCosts = Math.max(margeAn1 - ebitdaAn1, 0);
      const fmt = (n: number) => {
        const abs = Math.abs(Math.round(n));
        const sign = n >= 0 ? '+' : '-';
        if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M FCFA`;
        if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K FCFA`;
        return `${sign}${abs} FCFA`;
      };
      d.scenarios.sensibilite = d.scenarios.sensibilite.map((s: any) => {
        if (typeof s !== 'string' || !s.includes('<montant>')) return s;
        let replaced = s;
        if (s.startsWith('CA +10%')) {
          const delta = caAn1 * 0.10 * margePct;
          replaced = `CA +10% : EBITDA: ${fmt(delta)}`;
        } else if (s.startsWith('Marge brute -10%')) {
          const delta = -(margeAn1 * 0.10);
          replaced = `Marge brute -10% : EBITDA: ${fmt(delta)}`;
        } else if (s.startsWith('Charges fixes +10%')) {
          const delta = fixedCosts > 0 ? -(fixedCosts * 0.10) : -(ebitdaAn1 * 0.05);
          replaced = `Charges fixes +10% : EBITDA: ${fmt(delta)}`;
        } else {
          // Fallback: remove placeholder with N/A
          replaced = s.replace(/<montant>/g, 'N/C');
        }
        return replaced;
      });
    }
  }

  // Normalize scenarios.tableau items
  if (d.scenarios?.tableau && Array.isArray(d.scenarios.tableau)) {
    d.scenarios.tableau = d.scenarios.tableau.map((t: any) => ({ ...t }));
  }

  // Normalize analyse_marge.activites
  if (d.analyse_marge?.activites && Array.isArray(d.analyse_marge.activites)) {
    d.analyse_marge.activites = d.analyse_marge.activites.map((a: any) => ({
      ...a,
      ca: a.ca != null ? toNumber(a.ca) : 0,
      marge_brute: a.marge_brute != null ? toNumber(a.marge_brute) : 0,
    }));
  }

  // Normalize tresorerie_bfr
  if (d.tresorerie_bfr) {
    const bfr = d.tresorerie_bfr;
    bfr.tresorerie_nette = bfr.tresorerie_nette != null ? toNumber(bfr.tresorerie_nette) : undefined;
    bfr.cashflow_operationnel = bfr.cashflow_operationnel != null ? toNumber(bfr.cashflow_operationnel) : undefined;
    bfr.caf = bfr.caf != null ? toNumber(bfr.caf) : undefined;
  }

  // Normalize kpis
  if (d.kpis) {
    d.kpis.ca_annee_n = d.kpis.ca_annee_n != null ? toNumber(d.kpis.ca_annee_n) : undefined;
    d.kpis.ebitda = d.kpis.ebitda != null ? toNumber(d.kpis.ebitda) : undefined;
  }

  return d;
}

// ===== DIAGNOSTIC NORMALIZER =====
export function normalizeDiagnostic(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    return {
      metadata: { version: 1, donnees_completes: false },
      score_global: 0, score: 0,
      palier: "en_construction", label: "En construction", couleur: "🟠",
      resume_executif: "",
      scores_dimensions: {},
      forces: [], opportunites_amelioration: [], points_vigilance: [],
      incoherences: [], recommandations: [], benchmarks: {},
      avis_par_livrable: {},
      synthese_globale: { avis_ensemble: "", points_cles_a_retenir: [], demarche_recommandee: [], prochaines_etapes: [] },
      points_attention_prioritaires: [],
    };
  }

  const d = { ...raw };

  // Score
  d.score_global = toNumber(pick(d, 'score_global', 'score', 'score_investment_readiness'), 0);
  d.score = d.score_global;

  // Palier: only auto-calculate if AI didn't provide one
  const s = d.score_global;
  const palierMap: Record<string, { label: string; couleur: string }> = {
    "en_construction": { label: "En construction", couleur: "🟠" },
    "a_renforcer":     { label: "À renforcer",     couleur: "🟡" },
    "potentiel":       { label: "Potentiel",       couleur: "🟢" },
    "bien_avance":     { label: "Bien avancé",     couleur: "💚" },
    "excellent":       { label: "Excellent",       couleur: "✅" },
  };
  if (!d.palier || d.palier === '') {
    // Derive palier from score
    if (s <= 30)      d.palier = "en_construction";
    else if (s <= 50) d.palier = "a_renforcer";
    else if (s <= 70) d.palier = "potentiel";
    else if (s <= 85) d.palier = "bien_avance";
    else              d.palier = "excellent";
  }
  // Always ensure label & couleur match the palier (whether AI-provided or derived)
  const palierInfo = palierMap[d.palier];
  if (palierInfo) {
    d.label = d.label || palierInfo.label;
    d.couleur = d.couleur || palierInfo.couleur;
  }

  // Resume exécutif (plusieurs clés possibles)
  d.resume_executif = pick(d, 'resume_executif', 'synthese_executive', 'synthèse_exécutive', 'synthese', 'executive_summary') || '';

  // Dimensions — préserver les objets complexes
  d.scores_dimensions = d.scores_dimensions || {};
  const dimDefaults: Record<string, { label: string; poids: number }> = {
    coherence:             { label: "Cohérence entre livrables", poids: 25 },
    viabilite:             { label: "Viabilité économique",       poids: 25 },
    realisme:              { label: "Réalisme des projections",   poids: 20 },
    completude_couts:      { label: "Complétude des coûts",       poids: 15 },
    capacite_remboursement:{ label: "Capacité de remboursement",  poids: 15 },
  };
  for (const [dim, defaults] of Object.entries(dimDefaults)) {
    if (!d.scores_dimensions[dim]) {
      d.scores_dimensions[dim] = { score: 0, ...defaults, commentaire: "", analyse_detaillee: "" };
    } else {
      d.scores_dimensions[dim] = { ...defaults, ...d.scores_dimensions[dim] };
    }
  }

  // Listes — garder les objets (pas toArray qui stringify)
  const toObjArray = (v: any): any[] => Array.isArray(v) ? v : (v ? [v] : []);
  d.forces = toObjArray(d.forces || d.swot?.forces || []);
  d.opportunites_amelioration = toObjArray(d.opportunites_amelioration || d.swot?.faiblesses || []);
  d.points_vigilance = toObjArray(d.points_vigilance || d.risques_critiques || []);
  d.incoherences = toObjArray(d.incoherences || []);
  d.recommandations = toObjArray(d.recommandations || d.plan_action_prioritaire || []);
  d.points_attention_prioritaires = toObjArray(d.points_attention_prioritaires || []);

  // Benchmarks
  d.benchmarks = d.benchmarks || {};

  // Avis par livrable
  d.avis_par_livrable = d.avis_par_livrable || {};

  // Synthèse globale
  d.synthese_globale = d.synthese_globale || {
    avis_ensemble: "", points_cles_a_retenir: [], demarche_recommandee: [], prochaines_etapes: []
  };

  // Métadonnées
  d.metadata = d.metadata || { version: 1, donnees_completes: false };

  // Compatibilité avec l'ancien format (swot, diagnostic_par_dimension)
  if (d.swot) {
    for (const k of ['forces', 'faiblesses', 'opportunites', 'menaces']) {
      if (d.swot[k]) {
        d.swot[k] = d.swot[k].map((s_item: any) =>
          typeof s_item === 'string' ? s_item : s_item?.item || s_item?.titre || s_item?.description || JSON.stringify(s_item)
        );
      }
    }
  }

  return d;
}

// ===== BUSINESS PLAN NORMALIZER =====
export function normalizeBusinessPlan(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  d.score = toNumber(pick(d, 'score', 'score_global'), 0);

  // Normalize resume_executif variants
  d.resume_executif = d.resume_executif || d.résumé_exécutif || d.executive_summary || {};

  return d;
}

// ===== ODD NORMALIZER =====
export function normalizeOdd(raw: unknown): Record<string, unknown> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const evalCibles = r.evaluation_cibles_odd as Record<string, unknown> | undefined;
  const cibles = Array.isArray(evalCibles?.cibles) ? evalCibles!.cibles : [];
  const resumeParOdd = (evalCibles?.resume_par_odd && typeof evalCibles.resume_par_odd === "object")
    ? evalCibles.resume_par_odd
    : {};

  const indImpact = r.indicateurs_impact as Record<string, unknown> | undefined;
  const indicateurs = Array.isArray(indImpact?.indicateurs) ? indImpact!.indicateurs : [];

  const circularite = r.circularite as Record<string, unknown> | undefined;
  const synthese = r.synthese as Record<string, unknown> | undefined;
  const metadata = r.metadata as Record<string, unknown> | undefined;

  return {
    metadata: {
      nom_entreprise: metadata?.nom_entreprise ?? "",
      pays: metadata?.pays ?? "",
      secteur: metadata?.secteur ?? "",
      date_generation: metadata?.date_generation ?? new Date().toISOString().split("T")[0],
      version: metadata?.version ?? 1,
      livrables_utilises: Array.isArray(metadata?.livrables_utilises)
        ? metadata!.livrables_utilises
        : ["bmc", "sic"],
      total_cibles_evaluees: cibles.length,
    },
    informations_projet: r.informations_projet ?? {},
    evaluation_cibles_odd: {
      cibles,
      resume_par_odd: resumeParOdd,
    },
    indicateurs_impact: { indicateurs },
    circularite: {
      evaluation: circularite?.evaluation ?? "",
      pratiques: Array.isArray(circularite?.pratiques) ? circularite!.pratiques : [],
      cibles_odd_liees: Array.isArray(circularite?.cibles_odd_liees) ? circularite!.cibles_odd_liees : [],
    },
    synthese: {
      odd_prioritaires: Array.isArray(synthese?.odd_prioritaires) ? synthese!.odd_prioritaires : [],
      contribution_globale: synthese?.contribution_globale ?? "",
      recommandations: Array.isArray(synthese?.recommandations) ? synthese!.recommandations : [],
    },
    score: (() => {
      const oddEntries = Object.values(resumeParOdd as Record<string, any>);
      if (!oddEntries.length) return 0;
      const scores = oddEntries.map((o: any) => typeof o?.score === 'number' ? o.score : 0);
      return Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    })(),
    score_global: (() => {
      const oddEntries = Object.values(resumeParOdd as Record<string, any>);
      if (!oddEntries.length) return 0;
      const scores = oddEntries.map((o: any) => typeof o?.score === 'number' ? o.score : 0);
      return Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    })(),
  };
}

// ===== PLAN OVO NORMALIZER =====
export function normalizePlanOvo(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  const YEAR_KEYS = ['year_minus_2', 'year_minus_1', 'current_year', 'year2', 'year3', 'year4', 'year5', 'year6'];

  d.score = toNumber(pick(d, 'score', 'score_global'), 0);

  // C6: Use base_year from data (frozen at enterprise creation) — never override with current date
  // base_year is set by the AI using the enterprise's creation year, not the regeneration date
  const cy: number = d.base_year || d.years?.current_year || new Date().getFullYear();
  if (!d.years) {
    d.base_year = cy;
    d.years = {
      year_minus_2: cy - 2,
      year_minus_1: cy - 1,
      current_year: cy,
      year2: cy + 1,
      year3: cy + 2,
      year4: cy + 3,
      year5: cy + 4,
      year6: cy + 5,
    };
  }

  // Ensure all year-series objects have all 8 keys
  const seriesFields = ['revenue', 'cogs', 'gross_profit', 'gross_margin_pct', 'ebitda', 'ebitda_margin_pct', 'net_profit', 'cashflow'];
  for (const field of seriesFields) {
    if (!d[field]) d[field] = {};
    for (const yk of YEAR_KEYS) {
      d[field][yk] = toNumber(d[field][yk], 0);
    }
  }

  // Ensure opex sub-categories have all 8 keys
  if (d.opex) {
    const opexFields = ['staff_salaries', 'marketing', 'office_costs', 'travel', 'insurance', 'maintenance', 'third_parties', 'other'];
    for (const field of opexFields) {
      if (!d.opex[field]) d.opex[field] = {};
      for (const yk of YEAR_KEYS) {
        d.opex[field][yk] = toNumber(d.opex[field][yk], 0);
      }
    }
  }

  // Recalculate gross_profit = revenue - cogs for consistency
  for (const yk of YEAR_KEYS) {
    const rev = d.revenue[yk];
    const cogs = d.cogs[yk];
    d.gross_profit[yk] = rev - cogs;
    d.gross_margin_pct[yk] = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;
  }

  // Recalculate ebitda_margin_pct
  for (const yk of YEAR_KEYS) {
    const rev = d.revenue[yk];
    d.ebitda_margin_pct[yk] = rev > 0 ? (d.ebitda[yk] / rev) * 100 : 0;
  }

  // Normalize recommandations
  d.recommandations = toArray(pick(d, 'recommandations', 'recommendations'));
  d.key_assumptions = toArray(pick(d, 'key_assumptions', 'hypotheses_cles'));

  // Guard: DSCR and Multiple EBITDA are meaningless when first projection year EBITDA is negative
  if (d.investment_metrics && (d.ebitda?.year2 || 0) <= 0) {
    d.investment_metrics.dscr = null;
    d.investment_metrics.multiple_ebitda = null;
  }

  return d;
}

// ===== ENFORCE FRAMEWORK CONSTRAINTS ON PLAN OVO =====
/**
 * Overwrites Plan OVO projection years (year2-year6) with exact Framework values
 * and recalculates all derived fields deterministically.
 */
export function enforceFrameworkConstraints(data: any, frameworkData: any, inputsData?: any, country?: string): any {
  if (!data || !frameworkData?.projection_5ans?.lignes) return data;

  // ── Anchor current_year on real Inputs data (not AI-hallucinated) ──
  if (inputsData?.compte_resultat) {
    const cr = inputsData.compte_resultat;
    if (cr.chiffre_affaires && cr.chiffre_affaires > 0) {
      data.revenue.current_year = toNumber(cr.chiffre_affaires);
    }
    if (cr.resultat_net && cr.resultat_net !== 0) {
      data.net_profit.current_year = toNumber(cr.resultat_net);
    }
    // Derive EBITDA from inputs if available
    const ebitdaFromInputs = toNumber(cr.resultat_exploitation) + toNumber(cr.dotations_amortissements);
    if (ebitdaFromInputs > 0) {
      data.ebitda.current_year = ebitdaFromInputs;
    }
    // Recalculate gross_profit & cogs for current_year
    if (cr.chiffre_affaires > 0 && cr.achats_matieres !== undefined) {
      data.cogs.current_year = toNumber(cr.achats_matieres);
      data.gross_profit.current_year = toNumber(cr.chiffre_affaires) - toNumber(cr.achats_matieres);
      data.gross_margin_pct.current_year = data.revenue.current_year > 0
        ? (data.gross_profit.current_year / data.revenue.current_year) * 100 : 0;
    }
    if (data.revenue.current_year > 0) {
      data.ebitda_margin_pct.current_year = (data.ebitda.current_year / data.revenue.current_year) * 100;
    }
  }

  // ── Back-derive year_minus_1 / year_minus_2 from implied Framework growth rate ──
  // If AI-generated historical values look wrong, recalculate from current_year
  if (data.revenue?.current_year > 0 && data.revenue?.year2 > 0) {
    // Implied annual growth rate from Framework (current_year → year2)
    const impliedGrowth = (data.revenue.year2 / data.revenue.current_year) - 1;
    // Cap growth rate to reasonable bounds (5%–60%)
    const g = Math.min(Math.max(impliedGrowth, 0.05), 0.60);

    const series: Array<[string, string]> = [
      ['revenue', 'revenue'], ['gross_profit', 'gross_profit'],
      ['ebitda', 'ebitda'], ['net_profit', 'net_profit'], ['cogs', 'cogs'], ['cashflow', 'cashflow'],
    ];

    for (const [seriesKey] of series) {
      const s = data[seriesKey];
      if (!s || typeof s !== 'object') continue;
      const cy = toNumber(s.current_year);
      if (cy <= 0) continue;

      const ym1Derived = Math.round(cy / (1 + g));
      const ym2Derived = Math.round(ym1Derived / (1 + g));

      // Only overwrite if AI value is zero OR deviates more than 25% from derived value
      const overwriteYm1 = !s.year_minus_1 || s.year_minus_1 <= 0 ||
        Math.abs(toNumber(s.year_minus_1) - ym1Derived) / ym1Derived > 0.25;
      const overwriteYm2 = !s.year_minus_2 || s.year_minus_2 <= 0 ||
        Math.abs(toNumber(s.year_minus_2) - ym2Derived) / ym2Derived > 0.25;

      if (overwriteYm1) s.year_minus_1 = ym1Derived;
      if (overwriteYm2) s.year_minus_2 = ym2Derived;
    }
  }

  const lignes = frameworkData.projection_5ans.lignes;
  if (!Array.isArray(lignes) || lignes.length === 0) return data;

  const PROJ_KEYS = ['year2', 'year3', 'year4', 'year5', 'year6'];
  const AN_KEYS = ['an1', 'an2', 'an3', 'an4', 'an5'];

  // Helper: find a ligne by label patterns
  // Helper: find a ligne by label patterns, optionally excluding patterns containing certain strings
  const findLigne = (excludePatterns: string[] = [], ...patterns: string[]) => {
    return lignes.find((l: any) => {
      const lb = (l.poste || l.libelle || '').toLowerCase();
      if (excludePatterns.some(ex => lb.includes(ex))) return false;
      return patterns.some(p => lb.includes(p));
    });
  };

  const caLine = findLigne([], 'ca total', 'chiffre', 'revenue', 'ca ', 'total revenus', 'ventes totales', 'recettes', 'turnover', 'ventes');
  // Exclude lines containing '%' to avoid confusing amounts with percentages
  const mbLine = findLigne(['%', '(%)'], 'marge brute', 'gross');
  const ebitdaLine = findLigne(['%', '(%)'], 'ebitda');
  const rnLine = findLigne([], 'résultat net', 'resultat net', 'net profit');
  const cfLine = findLigne([], 'cash', 'trésorerie', 'tresorerie');

  // Overwrite each projection year with framework values
  const overwrite = (series: any, ligne: any) => {
    if (!ligne || !series) return;
    for (let i = 0; i < 5; i++) {
      const val = toNumber(ligne[AN_KEYS[i]], NaN);
      if (!isNaN(val)) {
        series[PROJ_KEYS[i]] = val;
      }
    }
  };

  overwrite(data.revenue, caLine);
  overwrite(data.gross_profit, mbLine);
  overwrite(data.ebitda, ebitdaLine);
  overwrite(data.net_profit, rnLine);
  overwrite(data.cashflow, cfLine);

  // Guard: if framework revenue > 3× real inputs CA, rescale all projection years proportionally
  if (inputsData?.compte_resultat?.chiffre_affaires > 0 && data.revenue.current_year > 0) {
    const inputsCA = data.revenue.current_year;
    const fwYear2Rev = data.revenue[PROJ_KEYS[0]] || 0;
    if (inputsCA > 0 && fwYear2Rev > inputsCA * 3) {
      const rescaleRatio = (inputsCA * 1.15) / fwYear2Rev;
      console.warn(`[enforceFramework] Revenue rescale: fw_year2=${fwYear2Rev} vs inputs_ca=${inputsCA} (ratio=${(fwYear2Rev / inputsCA).toFixed(1)}×) — rescaling by ${rescaleRatio.toFixed(3)}`);
      const projSeries = ['revenue', 'gross_profit', 'ebitda', 'net_profit', 'cogs', 'cashflow'];
      for (const s of projSeries) {
        if (data[s]) {
          for (const yk of PROJ_KEYS) {
            if (data[s][yk]) data[s][yk] = Math.round(data[s][yk] * rescaleRatio);
          }
        }
      }
    }
  }

  // Guard: Résultat Net cannot exceed EBITDA (RN = EBITDA - Amort - Interest - Tax)
  for (const yk of PROJ_KEYS) {
    if (data.ebitda[yk] !== undefined && data.net_profit[yk] !== undefined) {
      if (data.net_profit[yk] > data.ebitda[yk]) {
        console.warn(`[enforceFramework] net_profit[${yk}]=${data.net_profit[yk]} > ebitda[${yk}]=${data.ebitda[yk]} — capping to EBITDA`);
        data.net_profit[yk] = data.ebitda[yk];
      }
    }
  }

  // If no cashflow line from Framework, derive cashflow = EBITDA × (1 - taux_IS/100)
  if (!cfLine && data.net_profit && data.cashflow) {
    const { is: tauxIS } = getFiscalParams(country || "Côte d'Ivoire");
    for (const yk of PROJ_KEYS) {
      const ebitda = data.ebitda[yk] || 0;
      // cashflow ≈ EBITDA × (1 - IS%) — approximation simplifiée sans amortissements
      data.cashflow[yk] = Math.round(ebitda * (1 - tauxIS / 100));
    }
  }

  // Recalculate COGS = revenue - gross_profit
  for (const yk of PROJ_KEYS) {
    const prevCogs = data.cogs[yk] || 0;
    data.cogs[yk] = data.revenue[yk] - data.gross_profit[yk];
    // Guard: COGS cannot be 0 or negative — apply 10% floor (minimum realistic for any sector)
    if (data.revenue[yk] > 0 && data.cogs[yk] <= 0) {
      console.warn(`[enforceFramework] COGS=${data.cogs[yk]} for ${yk} — forcing to 10% of revenue`);
      data.cogs[yk] = Math.round(data.revenue[yk] * 0.10);
      data.gross_profit[yk] = data.revenue[yk] - data.cogs[yk];
    }
    data.gross_margin_pct[yk] = data.revenue[yk] > 0
      ? (data.gross_profit[yk] / data.revenue[yk]) * 100 : 0;
    data.ebitda_margin_pct[yk] = data.revenue[yk] > 0
      ? (data.ebitda[yk] / data.revenue[yk]) * 100 : 0;

    // H2: Also scale any COGS sub-breakdown proportionally (achats_matieres, charges_directes, etc.)
    const cogsBreakdownKeys = ['achats_matieres', 'charges_directes', 'sous_traitance', 'matieres_consommees'];
    if (prevCogs > 0 && data.cogs[yk] !== prevCogs) {
      const cogsRatio = data.cogs[yk] / prevCogs;
      for (const bk of cogsBreakdownKeys) {
        if (data[bk] && typeof data[bk][yk] === 'number' && data[bk][yk] > 0) {
          data[bk][yk] = Math.round(data[bk][yk] * cogsRatio);
        }
      }
    }
  }

  // Adjust OPEX proportionally so that total_opex = gross_profit - ebitda
  // Ratio bounded to [0.4–2.5×]: if out of range, derive EBITDA from actual OPEX instead
  if (data.opex) {
    const opexFields = ['staff_salaries', 'marketing', 'office_costs', 'travel', 'insurance', 'maintenance', 'third_parties', 'other'];
    const { is: tauxIS } = getFiscalParams(country || "Côte d'Ivoire");
    for (const yk of PROJ_KEYS) {
      const targetOpex = data.gross_profit[yk] - data.ebitda[yk];
      const currentOpex = opexFields.reduce((sum, f) => sum + (data.opex[f]?.[yk] || 0), 0);
      if (currentOpex > 0 && targetOpex > 0) {
        const ratio = targetOpex / currentOpex;
        if (ratio >= 0.4 && ratio <= 2.5) {
          // Normal adjustment: scale OPEX to match EBITDA
          for (const f of opexFields) {
            if (data.opex[f]) {
              data.opex[f][yk] = Math.round(data.opex[f][yk] * ratio);
            }
          }
        } else {
          // Ratio too extreme — derive EBITDA from actual OPEX (correct cascade direction)
          console.warn(`[enforceFramework] OPEX ratio=${ratio.toFixed(2)} for ${yk} out of bounds [0.4–2.5] — deriving EBITDA from actual OPEX`);
          data.ebitda[yk] = Math.round(data.gross_profit[yk] - currentOpex);
          data.ebitda_margin_pct[yk] = data.revenue[yk] > 0
            ? (data.ebitda[yk] / data.revenue[yk]) * 100 : 0;
          if (data.net_profit[yk] > data.ebitda[yk]) {
            data.net_profit[yk] = data.ebitda[yk];
          }
          data.cashflow[yk] = Math.round(data.ebitda[yk] * (1 - tauxIS / 100));
        }
      }
    }
  }

  // Recalculate investment metrics deterministically
  if (data.investment_metrics && data.cashflow) {
    const discountRate = data.investment_metrics.discount_rate || 0.12;
    const initialInv = data.funding_need || 0;

    // NPV calculation
    const cfValues = PROJ_KEYS.map((yk, i) => data.cashflow[yk] / Math.pow(1 + discountRate, i + 1));
    data.investment_metrics.van = Math.round(cfValues.reduce((a: number, b: number) => a + b, 0) - initialInv);

    // IRR approximation (Newton-Raphson) with safety bounds
    let irr = 0.1;
    for (let iter = 0; iter < 50; iter++) {
      let npv = -initialInv;
      let dnpv = 0;
      for (let i = 0; i < 5; i++) {
        const cf = data.cashflow[PROJ_KEYS[i]];
        npv += cf / Math.pow(1 + irr, i + 1);
        dnpv -= (i + 1) * cf / Math.pow(1 + irr, i + 2);
      }
      if (Math.abs(dnpv) < 1e-10) break;
      irr = irr - npv / dnpv;
      if (isNaN(irr) || irr < -0.99 || irr > 10) { irr = 0; break; }
      if (Math.abs(npv) < 1000) break;
    }
    data.investment_metrics.tri = isNaN(irr) ? 0 : Math.round(irr * 10000) / 10000;

    // CAGR Revenue — current_year to year6 = 5 years span
    // Structure: current_year, year2, year3, year4, year5, year6 → 5 projection years
    const revCY = data.revenue.current_year;
    const revY6 = data.revenue.year6;
    if (revCY > 0 && revY6 > 0 && revY6 !== revCY) {
      data.investment_metrics.cagr_revenue = Math.round((Math.pow(revY6 / revCY, 1 / 5) - 1) * 10000) / 10000;
    }

    // CAGR EBITDA — current_year to year6 = 5 years span
    const ebCY = data.ebitda.current_year;
    const ebY6 = data.ebitda.year6;
    if (ebCY > 0 && ebY6 > 0 && ebY6 !== ebCY) {
      data.investment_metrics.cagr_ebitda = Math.round((Math.pow(ebY6 / ebCY, 1 / 5) - 1) * 10000) / 10000;
    }

    // ROI
    if (initialInv > 0) {
      const totalNet = PROJ_KEYS.reduce((sum, yk) => sum + (data.net_profit[yk] || 0), 0);
      data.investment_metrics.roi = Math.round((totalNet / initialInv) * 100) / 100;
    }

    // Payback
    if (initialInv > 0) {
      let cumCf = 0;
      data.investment_metrics.payback_years = 5; // default
      for (let i = 0; i < 5; i++) {
        cumCf += data.cashflow[PROJ_KEYS[i]];
        if (cumCf >= initialInv) {
          // Fractional payback: year + remaining / cf_that_year
          const prevCum = cumCf - data.cashflow[PROJ_KEYS[i]];
          const remaining = initialInv - prevCum;
          const cfYear = data.cashflow[PROJ_KEYS[i]];
          data.investment_metrics.payback_years = cfYear > 0
            ? Math.round((i + remaining / cfYear) * 10) / 10
            : i + 1;
          break;
        }
      }
    }

    // ── Post-calculation validation guards ──
    // Guard: CAGR too low but revenue grew significantly
    if (data.investment_metrics.cagr_revenue < 0.01 && revY6 > revCY * 1.5) {
      data.investment_metrics.cagr_revenue = Math.round((Math.pow(revY6 / revCY, 1 / 5) - 1) * 10000) / 10000;
    }
    // Guard: CAGR EBITDA — if base (current_year) is negative, recalculate from year2→year6 or set null
    if (ebCY <= 0) {
      const ebY2 = data.ebitda[PROJ_KEYS[0]] || 0; // year2
      if (ebY2 > 0 && ebY6 > 0 && ebY6 !== ebY2) {
        // CAGR over 4 years (year2 → year6)
        data.investment_metrics.cagr_ebitda = Math.round((Math.pow(ebY6 / ebY2, 1 / 4) - 1) * 10000) / 10000;
      } else {
        data.investment_metrics.cagr_ebitda = null;
      }
    } else if (data.investment_metrics.cagr_ebitda < 0.01 && ebY6 > ebCY * 1.5) {
      data.investment_metrics.cagr_ebitda = Math.round((Math.pow(ebY6 / ebCY, 1 / 5) - 1) * 10000) / 10000;
    }
    // Guard: DSCR and Multiple EBITDA are meaningless when year2 EBITDA is negative
    const ebYear2 = data.ebitda[PROJ_KEYS[0]] || 0;
    if (ebYear2 <= 0) {
      data.investment_metrics.dscr = null;
      data.investment_metrics.multiple_ebitda = null;
    }
    // Guard: TRI negative but VAN positive → retry Newton-Raphson with different seed
    if (data.investment_metrics.tri <= 0 && data.investment_metrics.van > 0) {
      let irrRetry = 0.25;
      for (let iter = 0; iter < 100; iter++) {
        let npvR = -initialInv;
        let dnpvR = 0;
        for (let i = 0; i < 5; i++) {
          const cf = data.cashflow[PROJ_KEYS[i]];
          npvR += cf / Math.pow(1 + irrRetry, i + 1);
          dnpvR -= (i + 1) * cf / Math.pow(1 + irrRetry, i + 2);
        }
        if (Math.abs(dnpvR) < 1e-10) break;
        irrRetry = irrRetry - npvR / dnpvR;
        if (isNaN(irrRetry) || irrRetry < -0.99 || irrRetry > 10) { irrRetry = 0; break; }
        if (Math.abs(npvR) < 1000) break;
      }
      if (irrRetry > 0 && !isNaN(irrRetry)) data.investment_metrics.tri = Math.round(irrRetry * 10000) / 10000;
    }
    // Guard: payback 0 but funding needed
    if (data.investment_metrics.payback_years === 0 && initialInv > 0) {
      data.investment_metrics.payback_years = 5;
    }
  }

  // Update scenarios VAN/TRI with proper NPV/IRR recalculation
  if (data.scenarios && frameworkData.scenarios?.tableau) {
    const parseFcfa = (val: any): number => {
      if (typeof val === 'number') return val;
      if (typeof val !== 'string') return 0;
      const cleaned = val.replace(/[^\d.,MmKk-]/g, '');
      let num = parseFloat(cleaned.replace(/,/g, '.'));
      if (isNaN(num)) return 0;
      if (/[Mm]/i.test(val)) num *= 1_000_000;
      if (/[Kk]/i.test(val)) num *= 1_000;
      return Math.round(num);
    };

    const fwScenarios: Record<string, Record<string, number>> = {
      prudent: {}, central: {}, ambitieux: {}
    };
    for (const row of frameworkData.scenarios.tableau) {
      const label = (row.indicateur || row.poste || row.libelle || '').toLowerCase();
      for (const sc of ['prudent', 'central', 'ambitieux']) {
        if (row[sc] !== undefined) {
          if (label.includes('ca') || label.includes('chiffre') || label.includes('revenue')) {
            fwScenarios[sc].revenue = parseFcfa(row[sc]);
          } else if (label.includes('ebitda')) {
            fwScenarios[sc].ebitda = parseFcfa(row[sc]);
          } else if (label.includes('résultat') || label.includes('resultat') || label.includes('net profit')) {
            fwScenarios[sc].net_profit = parseFcfa(row[sc]);
          }
        }
      }
    }

    const mapping: Record<string, string> = {
      pessimiste: 'prudent', realiste: 'central', optimiste: 'ambitieux'
    };

    const discountRate = data.investment_metrics?.discount_rate || 0.12;
    const initialInv = data.funding_need || 0;

    for (const [ovoSc, fwSc] of Object.entries(mapping)) {
      if (data.scenarios[ovoSc] && fwScenarios[fwSc]) {
        const fw = fwScenarios[fwSc];
        if (fw.revenue) data.scenarios[ovoSc].revenue_year5 = fw.revenue;
        if (fw.ebitda) data.scenarios[ovoSc].ebitda_year5 = fw.ebitda;
        if (fw.net_profit) data.scenarios[ovoSc].net_profit_year5 = fw.net_profit;

        // Estimate scenario cashflows proportionally to central scenario
        const centralRev = fwScenarios.central?.revenue || data.revenue.year6 || 1;
        const scenarioRatio = (fw.revenue || centralRev) / centralRev;

        // Build proportional cashflows for NPV/IRR calculation
        const scenarioCFs = PROJ_KEYS.map(yk => Math.round((data.cashflow[yk] || 0) * scenarioRatio));

        // Calculate scenario NPV
        const scenarioNPV = scenarioCFs.reduce((sum, cf, i) => sum + cf / Math.pow(1 + discountRate, i + 1), 0) - initialInv;
        data.scenarios[ovoSc].van = Math.round(scenarioNPV);

        // Calculate scenario IRR (Newton-Raphson)
        if (initialInv > 0) {
          let irrSc = 0.1;
          for (let iter = 0; iter < 50; iter++) {
            let npvSc = -initialInv;
            let dnpvSc = 0;
            for (let i = 0; i < scenarioCFs.length; i++) {
              npvSc += scenarioCFs[i] / Math.pow(1 + irrSc, i + 1);
              dnpvSc -= (i + 1) * scenarioCFs[i] / Math.pow(1 + irrSc, i + 2);
            }
            if (Math.abs(dnpvSc) < 1e-10) break;
            irrSc = irrSc - npvSc / dnpvSc;
            if (isNaN(irrSc) || irrSc < -0.99 || irrSc > 10) { irrSc = 0; break; }
            if (Math.abs(npvSc) < 1000) break;
          }
          data.scenarios[ovoSc].tri = isNaN(irrSc) ? 0 : Math.round(irrSc * 10000) / 10000;
        }
      }
    }
  }

  return data;
}

// ===== SYNC BUSINESS PLAN FINANCIAL TABLE WITH PLAN OVO =====
export function syncBusinessPlanWithPlanOvo(bpData: any, planOvoData: any): any {
  if (!bpData || !planOvoData?.revenue) return bpData;

  const ft = bpData.financier_tableau;
  if (!ft) return bpData;

  const fmt = (v: number) => {
    if (!v && v !== 0) return "0 FCFA";
    return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + " FCFA";
  };

  const yearMap = [
    { target: 'annee1', source: 'year2' },
    { target: 'annee2', source: 'year3' },
    { target: 'annee3', source: 'year4' },
  ];

  for (const { target, source } of yearMap) {
    if (!ft[target]) ft[target] = {};
    ft[target].revenu = fmt(planOvoData.revenue[source]);
    ft[target].marge_brute = fmt(planOvoData.gross_profit[source]);
    ft[target].benefice_net = fmt(planOvoData.net_profit[source]);
    ft[target].tresorerie_finale = fmt(planOvoData.cashflow[source]);

    // Depenses = COGS + total OPEX
    const totalOpex = planOvoData.opex
      ? Object.values(planOvoData.opex).reduce((sum: number, cat: any) => sum + (cat?.[source] || 0), 0)
      : 0;
    ft[target].depenses = fmt((planOvoData.cogs?.[source] || 0) + (totalOpex as number));
  }

  bpData.financier_tableau = ft;
  return bpData;
}

// ===== SCREENING REPORT NORMALIZER =====
export function normalizeScreeningReport(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };

  d.screening_score = toNumber(pick(d, 'screening_score', 'score_global', 'score', 'score_screening'), 0);
  d.score = d.screening_score;

  d.verdict = pick(d, 'verdict', 'decision', 'eligibility') || 'INSUFFISANT';
  d.verdict = d.verdict.toUpperCase().replace(/É/g, 'E');
  if (!['ELIGIBLE', 'CONDITIONNEL', 'NON_ELIGIBLE', 'INSUFFISANT'].includes(d.verdict)) {
    d.verdict = d.screening_score >= 70 ? 'ELIGIBLE' : d.screening_score >= 40 ? 'CONDITIONNEL' : 'NON_ELIGIBLE';
  }

  d.verdict_summary = pick(d, 'verdict_summary', 'summary', 'resume', 'résumé') || '';

  d.anomalies = toArray(pick(d, 'anomalies', 'anomalies_detectees', 'issues', 'red_flags')).map((a: any) => {
    if (typeof a === 'string') return { severity: 'attention', category: 'general', title: a, detail: a, source_documents: [], recommendation: '' };
    return {
      severity: pick(a, 'severity', 'severite', 'level') || 'attention',
      category: pick(a, 'category', 'categorie', 'type') || 'general',
      title: pick(a, 'title', 'titre', 'label', 'name') || '',
      detail: pick(a, 'detail', 'details', 'description', 'explication') || '',
      source_documents: toArray(pick(a, 'source_documents', 'documents', 'sources')),
      recommendation: pick(a, 'recommendation', 'recommandation', 'action', 'fix') || '',
    };
  });

  const cv = pick(d, 'cross_validation', 'crossValidation', 'validation_croisee') || {};
  d.cross_validation = {
    ca_coherent: cv.ca_coherent ?? cv.ca_ok ?? null,
    ca_declared: toNumber(cv.ca_declared || cv.ca_declare, null),
    ca_from_documents: toNumber(cv.ca_from_documents || cv.ca_documents, null),
    ca_ecart_pct: toNumber(cv.ca_ecart_pct || cv.ecart_ca_pct, null),
    bilan_equilibre: cv.bilan_equilibre ?? cv.bilan_ok ?? null,
    bilan_ecart: toNumber(cv.bilan_ecart, null),
    charges_personnel_coherent: cv.charges_personnel_coherent ?? cv.personnel_ok ?? null,
    tresorerie_coherent: cv.tresorerie_coherent ?? cv.tresorerie_ok ?? null,
    notes: toArray(cv.notes || cv.observations),
  };

  const dq = pick(d, 'document_quality', 'qualite_documentaire', 'doc_quality') || {};
  d.document_quality = {
    total_documents: toNumber(dq.total_documents || dq.total, 0),
    documents_exploitables: toNumber(dq.documents_exploitables || dq.exploitables, 0),
    documents_illisibles: toNumber(dq.documents_illisibles || dq.illisibles, 0),
    couverture: dq.couverture || {},
    documents_manquants_critiques: toArray(dq.documents_manquants_critiques || dq.manquants),
    anciennete_documents: dq.anciennete_documents || dq.anciennete || '',
  };

  const fh = pick(d, 'financial_health', 'sante_financiere', 'health') || {};
  d.financial_health = {
    marge_brute_pct: toNumber(fh.marge_brute_pct || fh.marge_brute, null),
    marge_nette_pct: toNumber(fh.marge_nette_pct || fh.marge_nette, null),
    ratio_endettement_pct: toNumber(fh.ratio_endettement_pct || fh.endettement, null),
    ratio_liquidite: toNumber(fh.ratio_liquidite || fh.liquidite, null),
    bfr_jours: toNumber(fh.bfr_jours || fh.bfr, null),
    benchmark_sector: fh.benchmark_sector || fh.benchmark || '',
    health_label: fh.health_label || fh.label || 'Non évaluable',
  };

  const pm = pick(d, 'programme_match', 'match_programme');
  d.programme_match = pm ? {
    programme_name: pm.programme_name || pm.name || '',
    match_score: toNumber(pm.match_score || pm.score, 0),
    criteres_ok: toArray(pm.criteres_ok || pm.ok),
    criteres_ko: toArray(pm.criteres_ko || pm.ko),
    criteres_partiels: toArray(pm.criteres_partiels || pm.partiels),
    recommandation: pm.recommandation || pm.recommendation || '',
  } : null;

  return d;
}

// ===== RECONSTRUCTION NORMALIZER =====
export function normalizeReconstruction(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };

  d.score_confiance = toNumber(pick(d, 'score_confiance', 'score', 'confidence_score', 'confidence'), 0);
  d.score = d.score_confiance;

  const cr = pick(d, 'compte_resultat', 'income_statement', 'cdr') || {};
  d.compte_resultat = {
    chiffre_affaires: toNumber(pick(cr, 'chiffre_affaires', 'ca', 'revenue', 'chiffre_d_affaires'), 0),
    achats_matieres: toNumber(pick(cr, 'achats_matieres', 'achats', 'cogs', 'cout_ventes'), 0),
    charges_personnel: toNumber(pick(cr, 'charges_personnel', 'personnel', 'salaires', 'masse_salariale'), 0),
    charges_externes: toNumber(pick(cr, 'charges_externes', 'externes', 'opex'), 0),
    dotations_amortissements: toNumber(pick(cr, 'dotations_amortissements', 'amortissements', 'depreciation'), 0),
    impots_taxes: toNumber(pick(cr, 'impots_taxes', 'impots', 'taxes'), 0),
    resultat_exploitation: toNumber(pick(cr, 'resultat_exploitation', 'ebit', 'operating_income'), 0),
    charges_financieres: toNumber(pick(cr, 'charges_financieres', 'frais_financiers', 'interest'), 0),
    resultat_net: toNumber(pick(cr, 'resultat_net', 'net_income', 'benefice_net'), 0),
    source: 'reconstruction',
  };

  const b = pick(d, 'bilan', 'balance_sheet') || {};
  const ba = b.actif || b;
  const bp = b.passif || b;
  d.bilan = {
    immobilisations: toNumber(pick(ba, 'immobilisations', 'fixed_assets'), 0),
    stocks: toNumber(pick(ba, 'stocks', 'inventories', 'inventory'), 0),
    creances_clients: toNumber(pick(ba, 'creances_clients', 'creances', 'receivables'), 0),
    tresorerie_actif: toNumber(pick(ba, 'tresorerie_actif', 'tresorerie', 'cash'), 0),
    total_actif: toNumber(pick(ba, 'total_actif', 'total_assets', 'actif_total'), 0),
    capitaux_propres: toNumber(pick(bp, 'capitaux_propres', 'equity', 'fonds_propres'), 0),
    dettes_financieres: toNumber(pick(bp, 'dettes_financieres', 'dettes_lt', 'long_term_debt'), 0),
    dettes_fournisseurs: toNumber(pick(bp, 'dettes_fournisseurs', 'fournisseurs', 'payables'), 0),
    total_passif: toNumber(pick(bp, 'total_passif', 'total_liabilities', 'passif_total'), 0),
  };

  const ef = pick(d, 'effectifs', 'employees', 'staff') || {};
  d.effectifs = {
    total: toNumber(pick(ef, 'total', 'headcount'), 0),
    cadres: toNumber(pick(ef, 'cadres', 'managers', 'management'), 0),
    employes: toNumber(pick(ef, 'employes', 'employees', 'ouvriers'), 0),
    temporaires: toNumber(pick(ef, 'temporaires', 'temp', 'contractuels'), 0),
  };

  const k = pick(d, 'kpis', 'ratios', 'indicators') || {};
  d.kpis = {
    marge_brute_pct: toNumber(pick(k, 'marge_brute_pct', 'marge_brute', 'gross_margin'), 0),
    marge_nette_pct: toNumber(pick(k, 'marge_nette_pct', 'marge_nette', 'net_margin'), 0),
    ratio_endettement_pct: toNumber(pick(k, 'ratio_endettement_pct', 'endettement', 'debt_ratio'), 0),
    bfr_jours: toNumber(pick(k, 'bfr_jours', 'bfr', 'working_capital_days'), 0),
    ca_par_employe: toNumber(pick(k, 'ca_par_employe', 'revenue_per_employee'), 0),
  };

  const rr = pick(d, 'reconstruction_report', 'report') || {};
  d.reconstruction_report = {
    source_documents: toArray(rr.source_documents || rr.documents || rr.sources),
    hypotheses: toArray(rr.hypotheses || rr.assumptions),
    donnees_manquantes: toArray(rr.donnees_manquantes || rr.missing_data || rr.manquantes),
    note_analyste: rr.note_analyste || rr.analyst_note || rr.note || '',
  };

  return d;
}

// ===== PRE-SCREENING NORMALIZER =====
export function normalizePreScreening(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };

  d.pre_screening_score = toNumber(pick(d, 'pre_screening_score', 'score', 'screening_score', 'score_global'), 0);
  d.score = d.pre_screening_score;

  // Classification
  d.classification = pick(d, 'classification', 'decision', 'verdict') || 'COMPLETER_DABORD';
  const classMap: Record<string, string> = {
    'AVANCER': 'AVANCER_DIRECTEMENT', 'GO': 'AVANCER_DIRECTEMENT', 'ELIGIBLE': 'AVANCER_DIRECTEMENT',
    'ACCOMPAGNER': 'ACCOMPAGNER', 'CONDITIONNEL': 'ACCOMPAGNER',
    'COMPLETER': 'COMPLETER_DABORD', 'INSUFFISANT': 'COMPLETER_DABORD',
    'REJETER': 'REJETER', 'NON_ELIGIBLE': 'REJETER',
  };
  for (const [key, val] of Object.entries(classMap)) {
    if (d.classification.toUpperCase().includes(key)) { d.classification = val; break; }
  }

  d.classification_label = pick(d, 'classification_label', 'label') || '';
  d.classification_detail = pick(d, 'classification_detail', 'detail', 'rationale') || '';

  // Resume executif
  const re = pick(d, 'resume_executif', 'executive_summary', 'resume') || {};
  d.resume_executif = {
    synthese: re.synthese || re.summary || '',
    points_forts: toArray(re.points_forts || re.forces || re.strengths),
    points_faibles: toArray(re.points_faibles || re.faiblesses || re.weaknesses),
    potentiel_estime: re.potentiel_estime || re.potentiel || '',
  };

  // Qualite dossier
  const qd = pick(d, 'qualite_dossier', 'document_quality', 'quality') || {};
  d.qualite_dossier = {
    score_qualite: toNumber(qd.score_qualite || qd.score, 0),
    total_documents: toNumber(qd.total_documents || qd.total, 0),
    documents_exploitables: toNumber(qd.documents_exploitables || qd.exploitables, 0),
    documents_illisibles: toNumber(qd.documents_illisibles || qd.illisibles, 0),
    niveau_preuve: qd.niveau_preuve || qd.level || 'N0 Declaratif',
    couverture: qd.couverture || {},
    note_qualite: qd.note_qualite || qd.note || '',
  };

  // Anomalies
  d.anomalies = toArray(pick(d, 'anomalies', 'issues', 'red_flags')).map((a: any) => {
    if (typeof a === 'string') return { severity: 'attention', category: 'general', title: a, detail: a, impact_investisseur: '', recommendation: '', effort: 'moyen', responsable: 'entrepreneur' };
    return {
      severity: pick(a, 'severity', 'severite') || 'attention',
      category: pick(a, 'category', 'categorie') || 'general',
      title: pick(a, 'title', 'titre') || '',
      detail: pick(a, 'detail', 'description') || '',
      impact_investisseur: pick(a, 'impact_investisseur', 'impact') || '',
      recommendation: pick(a, 'recommendation', 'recommandation') || '',
      effort: pick(a, 'effort', 'difficulty') || 'moyen',
      responsable: pick(a, 'responsable', 'responsible') || 'entrepreneur',
    };
  });

  // Cross-validation
  const cv = pick(d, 'cross_validation', 'validation_croisee') || {};
  d.cross_validation = {
    ca_coherent: cv.ca_coherent ?? null,
    ca_declared: toNumber(cv.ca_declared, null),
    ca_from_documents: toNumber(cv.ca_from_documents, null),
    ca_ecart_pct: toNumber(cv.ca_ecart_pct, null),
    ca_detail: cv.ca_detail || '',
    bilan_equilibre: cv.bilan_equilibre ?? null,
    bilan_detail: cv.bilan_detail || '',
    charges_vs_effectifs: cv.charges_vs_effectifs ?? null,
    charges_vs_effectifs_detail: cv.charges_vs_effectifs_detail || '',
    tresorerie_coherent: cv.tresorerie_coherent ?? null,
    tresorerie_detail: cv.tresorerie_detail || '',
    dates_coherentes: cv.dates_coherentes ?? null,
    dates_detail: cv.dates_detail || '',
  };

  // Sante financiere
  const sf = pick(d, 'sante_financiere', 'financial_health') || {};
  d.sante_financiere = {
    ca_estime: toNumber(sf.ca_estime, null),
    marge_brute_pct: toNumber(sf.marge_brute_pct, null),
    marge_nette_pct: toNumber(sf.marge_nette_pct, null),
    ratio_endettement_pct: toNumber(sf.ratio_endettement_pct, null),
    tresorerie_nette: toNumber(sf.tresorerie_nette, null),
    benchmark_comparison: Array.isArray(sf.benchmark_comparison) ? sf.benchmark_comparison : [],
    health_label: sf.health_label || 'Non evaluable',
    health_detail: sf.health_detail || '',
  };

  // Potentiel et reconstructibilite
  const pr = pick(d, 'potentiel_et_reconstructibilite', 'potential', 'reconstructibilite') || {};
  d.potentiel_et_reconstructibilite = {
    donnees_fiables: toArray(pr.donnees_fiables || pr.reliable),
    donnees_estimables_ia: toArray(pr.donnees_estimables_ia || pr.estimable),
    donnees_non_reconstituables: toArray(pr.donnees_non_reconstituables || pr.non_reconstituable),
    fiabilite_pipeline_estimee: toNumber(pr.fiabilite_pipeline_estimee || pr.fiabilite, 0),
    fiabilite_detail: pr.fiabilite_detail || pr.detail || '',
    signaux_positifs: toArray(pr.signaux_positifs || pr.positifs),
    signaux_negatifs: toArray(pr.signaux_negatifs || pr.negatifs),
  };

  // Profil risque
  const risk = pick(d, 'profil_risque', 'risk_profile') || {};
  d.profil_risque = {
    score_risque: toNumber(risk.score_risque || risk.score, 50),
    risques: Array.isArray(risk.risques || risk.risks) ? (risk.risques || risk.risks) : [],
  };

  // Plan action
  const rawPlan = pick(d, 'plan_action', 'action_plan', 'actions');
  d.plan_action = Array.isArray(rawPlan)
    ? rawPlan.map((a: any) => ({
        priorite: toNumber(a.priorite || a.priority, 5),
        action: a.action || a.description || '',
        responsable: a.responsable || 'entrepreneur',
        delai: a.delai || a.timeline || '',
        effort: a.effort || 'moyen',
        impact_score: a.impact_score || a.impact || '',
        bloquant_pipeline: a.bloquant_pipeline ?? a.blocking ?? false,
      }))
    : [];

  // Pathway financement
  const pf = pick(d, 'pathway_financement', 'financing') || {};
  d.pathway_financement = {
    type_recommande: pf.type_recommande || pf.type || '',
    bailleurs_potentiels: toArray(pf.bailleurs_potentiels || pf.donors),
    montant_eligible_estime: pf.montant_eligible_estime || pf.amount || '',
    conditions_prealables: toArray(pf.conditions_prealables || pf.conditions),
    timeline_estimee: pf.timeline_estimee || pf.timeline || '',
  };

  // Recommandation pipeline
  const rp = pick(d, 'recommandation_pipeline', 'pipeline_recommendation') || {};
  d.recommandation_pipeline = {
    lancer_pipeline: rp.lancer_pipeline ?? rp.go ?? false,
    raison: rp.raison || rp.reason || '',
    modules_pertinents: toArray(rp.modules_pertinents || rp.relevant),
    modules_inutiles: toArray(rp.modules_inutiles || rp.useless),
    avertissement: rp.avertissement || rp.warning || null,
  };

  // Programme match
  d.programme_match = pick(d, 'programme_match') || null;

  return d;
}

// ===== AUTO NORMALIZE BY TYPE =====
export function normalizeByType(type: string, data: any): any {
  const normalizers: Record<string, (d: any) => any> = {
    bmc: normalizeBmc, bmc_analysis: normalizeBmc,
    sic: normalizeSic, sic_analysis: normalizeSic,
    inputs: normalizeInputs, inputs_data: normalizeInputs,
    framework: normalizeFramework, framework_data: normalizeFramework,
    diagnostic: normalizeDiagnostic, diagnostic_data: normalizeDiagnostic,
    business_plan: normalizeBusinessPlan,
    odd: normalizeOdd, odd_analysis: normalizeOdd,
    plan_ovo: normalizePlanOvo,
    screening_report: normalizeScreeningReport,
    screening: normalizeScreeningReport,
    reconstruction: normalizeReconstruction,
    pre_screening: normalizePreScreening,
  };

  const normalizer = normalizers[type];
  return normalizer ? normalizer(data) : data;
}
