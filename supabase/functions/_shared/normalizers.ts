/**
 * Normalizers for AI JSON responses
 * Handles key variations from different AI model outputs
 */

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

  // Palier (si l'IA ne l'a pas calculé correctement)
  const s = d.score_global;
  if (!d.palier || d.palier === '') {
    if (s <= 30)      { d.palier = "en_construction"; d.label = "En construction"; d.couleur = "🟠"; }
    else if (s <= 50) { d.palier = "a_renforcer";     d.label = "À renforcer";     d.couleur = "🟡"; }
    else if (s <= 70) { d.palier = "potentiel";       d.label = "Potentiel";       d.couleur = "🟢"; }
    else if (s <= 85) { d.palier = "bien_avance";     d.label = "Bien avancé";     d.couleur = "💚"; }
    else              { d.palier = "excellent";        d.label = "Excellent";       d.couleur = "✅"; }
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
  };
}

// ===== PLAN OVO NORMALIZER =====
export function normalizePlanOvo(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  const YEAR_KEYS = ['year_minus_2', 'year_minus_1', 'current_year', 'year2', 'year3', 'year4', 'year5', 'year6'];

  d.score = toNumber(pick(d, 'score', 'score_global'), 0);

  // Fix years to be dynamic based on current year
  const cy = new Date().getFullYear();
  if (!d.years || d.years.current_year !== cy) {
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
  };

  const normalizer = normalizers[type];
  return normalizer ? normalizer(data) : data;
}
