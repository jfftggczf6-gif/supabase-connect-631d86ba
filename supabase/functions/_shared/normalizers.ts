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
  return d;
}

// ===== DIAGNOSTIC NORMALIZER =====
export function normalizeDiagnostic(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  d.score = toNumber(pick(d, 'score', 'score_global'), 0);

  // Normalize SWOT items (might be objects or strings)
  if (d.swot) {
    for (const k of ['forces', 'faiblesses', 'opportunites', 'menaces']) {
      if (d.swot[k]) d.swot[k] = d.swot[k].map((s: any) => typeof s === 'string' ? s : s?.item || s?.description || JSON.stringify(s));
    }
  }

  d.synthese_executive = pick(d, 'synthese_executive', 'synthèse_exécutive', 'synthese', 'executive_summary') || '';
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
export function normalizeOdd(raw: any): any {
  if (!raw) return raw;
  const d = { ...raw };
  d.score = toNumber(pick(d, 'score', 'score_global'), 0);
  d.red_flags = toArray(pick(d, 'red_flags', 'drapeaux_rouges', 'alertes'));
  d.actions_prioritaires = d.actions_prioritaires || d.priority_actions || [];
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
  };

  const normalizer = normalizers[type];
  return normalizer ? normalizer(data) : data;
}
