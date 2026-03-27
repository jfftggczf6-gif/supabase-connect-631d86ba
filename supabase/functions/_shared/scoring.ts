/**
 * ESONO — Scoring pondéré objectif par livrable
 *
 * Chaque livrable a une grille de critères avec des poids.
 * Score = somme(poids × note_critère) / somme(poids)
 *
 * Les critères sont soit DÉTERMINISTES (calculés depuis les données)
 * soit IA (fournis par l'agent, mais bornés et validés).
 */

// ─── Types ───────────────────────────────────────────────────

interface Criterion {
  name: string;
  weight: number;
  score: number; // 0-100
  source: 'deterministic' | 'ai';
  detail?: string;
}

interface ScoringResult {
  score: number; // 0-100 pondéré
  criteria: Criterion[];
  confidence: number; // % de critères remplis
}

// ─── Helpers ─────────────────────────────────────────────────

function safe(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function ratioScore(value: number, min: number, max: number): number {
  // 100 si dans la norme, proportionnel sinon
  if (value >= min && value <= max) return 100;
  if (value < min) return Math.max(0, Math.round((value / min) * 100));
  return Math.max(0, Math.round(100 - ((value - max) / max) * 50));
}

function completenessScore(obj: any, requiredFields: string[]): number {
  if (!obj || typeof obj !== 'object') return 0;
  const filled = requiredFields.filter(f => {
    const val = f.split('.').reduce((o, k) => o?.[k], obj);
    return val != null && val !== '' && val !== 0;
  });
  return Math.round((filled.length / requiredFields.length) * 100);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ─── INPUTS DATA ─────────────────────────────────────────────

export function scoreInputs(data: any): ScoringResult {
  const cr = data?.compte_resultat || {};
  const bil = data?.bilan || {};
  const criteria: Criterion[] = [];

  // 1. Complétude compte de résultat (25%)
  const crFields = ['chiffre_affaires', 'achats_matieres', 'charges_personnel', 'resultat_net'];
  const crScore = completenessScore(cr, crFields);
  criteria.push({ name: 'Complétude CdR', weight: 25, score: crScore, source: 'deterministic', detail: `${crFields.filter(f => cr[f]).length}/${crFields.length} champs` });

  // 2. Complétude bilan (15%)
  const bilFields = ['total_actif', 'capitaux_propres', 'tresorerie', 'tresorerie_actif'];
  const bilScore = completenessScore(bil, bilFields);
  criteria.push({ name: 'Complétude bilan', weight: 15, score: bilScore, source: 'deterministic' });

  // 3. Équilibre bilan (15%)
  const actif = safe(bil.total_actif);
  const passif = safe(bil.total_passif || bil.capitaux_propres);
  const ecart = actif > 0 && passif > 0 ? Math.abs(actif - passif) / actif * 100 : 50;
  const eqScore = ecart < 5 ? 100 : ecart < 15 ? 70 : ecart < 30 ? 40 : 10;
  criteria.push({ name: 'Équilibre bilan', weight: 15, score: eqScore, source: 'deterministic', detail: `écart ${ecart.toFixed(1)}%` });

  // 4. CA > 0 (15%)
  const ca = safe(cr.chiffre_affaires || cr.ca);
  criteria.push({ name: 'CA documenté', weight: 15, score: ca > 0 ? 100 : 0, source: 'deterministic' });

  // 5. Historique disponible (10%)
  const histScore = data?.historique_3ans ? 100 : data?.compte_resultat_n_moins_1 ? 60 : 0;
  criteria.push({ name: 'Historique financier', weight: 10, score: histScore, source: 'deterministic' });

  // 6. Équipe/effectifs (10%)
  const equipeScore = (data?.equipe?.length > 0 || data?.effectifs) ? 100 : (data?.effectif_total > 0 ? 60 : 0);
  criteria.push({ name: 'Données équipe', weight: 10, score: equipeScore, source: 'deterministic' });

  // 7. Qualité sources (10%)
  const nbSources = (data?.source_documents || []).length;
  criteria.push({ name: 'Sources documentées', weight: 10, score: nbSources >= 3 ? 100 : nbSources >= 1 ? 60 : 20, source: 'deterministic' });

  return computeWeighted(criteria);
}

// ─── BMC ─────────────────────────────────────────────────────

export function scoreBmc(data: any): ScoringResult {
  const canvas = data?.canvas || {};
  const criteria: Criterion[] = [];

  // 1. Complétude canvas (30%)
  const blocKeys = ['proposition_valeur', 'activites_cles', 'ressources_cles', 'segments_clients', 'relations_clients', 'flux_revenus', 'partenaires_cles', 'canaux', 'structure_couts'];
  const filled = blocKeys.filter(k => {
    const v = canvas[k];
    return v && ((Array.isArray(v) && v.length > 0) || (typeof v === 'object' && Object.keys(v).length > 0) || typeof v === 'string');
  });
  criteria.push({ name: 'Complétude canvas', weight: 30, score: Math.round((filled.length / blocKeys.length) * 100), source: 'deterministic', detail: `${filled.length}/${blocKeys.length} blocs` });

  // 2. SWOT présent (15%)
  const swot = data?.swot || {};
  const swotScore = (swot.forces?.length > 0 && swot.faiblesses?.length > 0) ? 100 : (swot.forces?.length > 0 || swot.faiblesses?.length > 0) ? 50 : 0;
  criteria.push({ name: 'Analyse SWOT', weight: 15, score: swotScore, source: 'deterministic' });

  // 3. Recommandations (10%)
  const recoScore = data?.recommandations ? 100 : 0;
  criteria.push({ name: 'Recommandations', weight: 10, score: recoScore, source: 'deterministic' });

  // 4. Score IA diagnostic (25%)
  const aiDiag = safe(data?.diagnostic?.score_global || data?.score_global);
  criteria.push({ name: 'Qualité analyse IA', weight: 25, score: clamp(aiDiag), source: 'ai' });

  // 5. Maturité identifiée (10%)
  criteria.push({ name: 'Maturité évaluée', weight: 10, score: data?.maturite ? 100 : 0, source: 'deterministic' });

  // 6. Résumé présent (10%)
  criteria.push({ name: 'Résumé', weight: 10, score: data?.resume ? 100 : 0, source: 'deterministic' });

  return computeWeighted(criteria);
}

// ─── DIAGNOSTIC (Bilan de progression) ───────────────────────

export function scoreDiagnostic(data: any, inputsData?: any, benchmarks?: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Problèmes identifiés (20%)
  const nbProblemes = (data?.problemes || []).length;
  criteria.push({ name: 'Problèmes identifiés', weight: 20, score: nbProblemes >= 3 ? 100 : nbProblemes >= 1 ? 60 : 20, source: 'deterministic' });

  // 2. Points forts identifiés (15%)
  const nbForces = (data?.points_forts || data?.forces || []).length;
  criteria.push({ name: 'Points forts identifiés', weight: 15, score: nbForces >= 2 ? 100 : nbForces >= 1 ? 50 : 0, source: 'deterministic' });

  // 3. Benchmarks remplis (20%)
  const bm = data?.benchmarks || {};
  const bmKeys = Object.keys(bm).filter(k => bm[k]?.entreprise != null && bm[k]?.entreprise !== 0);
  const totalBm = Object.keys(bm).length || 1;
  criteria.push({ name: 'Benchmarks calculés', weight: 20, score: Math.round((bmKeys.length / totalBm) * 100), source: 'deterministic', detail: `${bmKeys.length}/${totalBm}` });

  // 4. Verdict présent (15%)
  const verdictScore = data?.verdict_readiness?.resume ? 100 : data?.verdict_final?.synthese ? 80 : 0;
  criteria.push({ name: 'Verdict formulé', weight: 15, score: verdictScore, source: 'deterministic' });

  // 5. Questions entrepreneur (10%)
  const nbQ = (data?.questions_entrepreneur || []).length;
  criteria.push({ name: 'Questions coach', weight: 10, score: nbQ >= 3 ? 100 : nbQ >= 1 ? 50 : 0, source: 'deterministic' });

  // 6. Scores dimensions (20%)
  const dims = data?.scores_dimensions;
  if (dims && typeof dims === 'object') {
    const values = Object.values(dims).map((v: any) => safe(typeof v === 'object' ? v.score : v)).filter(v => v > 0);
    const avgDim = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    criteria.push({ name: 'Scores par dimension', weight: 20, score: clamp(avgDim), source: 'ai' });
  } else {
    criteria.push({ name: 'Scores par dimension', weight: 20, score: 0, source: 'ai' });
  }

  return computeWeighted(criteria);
}

// ─── VALUATION ───────────────────────────────────────────────

export function scoreValuation(data: any): ScoringResult {
  const criteria: Criterion[] = [];
  const dcf = data?.dcf || {};
  const mult = data?.multiples || {};
  const synthese = data?.synthese_valorisation || {};

  // 1. DCF calculé (25%)
  const dcfScore = dcf.equity_value > 0 ? 100 : dcf.enterprise_value > 0 ? 70 : 0;
  criteria.push({ name: 'DCF calculé', weight: 25, score: dcfScore, source: 'deterministic' });

  // 2. Multiples calculés (20%)
  const multScore = (mult.valeur_par_ebitda > 0 || mult.valeur_par_ca > 0) ? 100 : 0;
  criteria.push({ name: 'Multiples calculés', weight: 20, score: multScore, source: 'deterministic' });

  // 3. Cohérence inter-méthodes (20%)
  const vBasse = safe(synthese.valeur_basse);
  const vHaute = safe(synthese.valeur_haute);
  const vMed = safe(synthese.valeur_mediane);
  let coherence = 0;
  if (vBasse > 0 && vHaute > 0 && vMed > 0) {
    const spread = (vHaute - vBasse) / vMed;
    coherence = spread < 0.5 ? 100 : spread < 1 ? 70 : spread < 2 ? 40 : 20;
  }
  criteria.push({ name: 'Cohérence méthodes', weight: 20, score: coherence, source: 'deterministic', detail: `spread ${vHaute > 0 ? ((vHaute - vBasse) / vMed * 100).toFixed(0) : '?'}%` });

  // 4. Note analyste (15%)
  const noteScore = synthese.note_analyste ? Math.min(100, synthese.note_analyste.length / 3) : 0;
  criteria.push({ name: 'Note analyste', weight: 15, score: clamp(noteScore), source: 'deterministic' });

  // 5. Qualité inputs (20%)
  const inputsQuality = data?._engine?.inputs_quality;
  const iqScore = inputsQuality === 'high' ? 100 : inputsQuality === 'medium' ? 60 : inputsQuality === 'low' ? 30 : 20;
  criteria.push({ name: 'Qualité données', weight: 20, score: iqScore, source: 'deterministic' });

  return computeWeighted(criteria);
}

// ─── INVESTMENT MEMO ─────────────────────────────────────────

export function scoreMemo(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Complétude sections (30%)
  const sections = ['resume_executif', 'presentation_entreprise', 'analyse_marche', 'modele_economique', 'analyse_financiere', 'valorisation', 'these_investissement', 'recommandation_finale'];
  const filled = sections.filter(s => data?.[s] && Object.keys(data[s]).length > 0);
  criteria.push({ name: 'Sections complètes', weight: 30, score: Math.round((filled.length / sections.length) * 100), source: 'deterministic', detail: `${filled.length}/${sections.length}` });

  // 2. Score IR (20%)
  const scoreIr = safe(data?.resume_executif?.score_ir || data?.score);
  criteria.push({ name: 'Score IR', weight: 20, score: clamp(scoreIr), source: 'ai' });

  // 3. Thèse équilibrée (15%)
  const thesePos = data?.these_investissement?.these_positive;
  const theseNeg = data?.these_investissement?.these_negative;
  const theseScore = (thesePos && theseNeg) ? 100 : (thesePos || theseNeg) ? 50 : 0;
  criteria.push({ name: 'Thèse équilibrée', weight: 15, score: theseScore, source: 'deterministic' });

  // 4. Risques identifiés (15%)
  const nbRisques = (data?.analyse_risques?.risques_identifies || []).length;
  criteria.push({ name: 'Risques identifiés', weight: 15, score: nbRisques >= 3 ? 100 : nbRisques >= 1 ? 50 : 0, source: 'deterministic' });

  // 5. Recommandation cohérente (20%)
  const verdict = data?.recommandation_finale?.verdict;
  const justif = data?.recommandation_finale?.justification;
  const recoScore = (verdict && justif) ? 100 : verdict ? 50 : 0;
  criteria.push({ name: 'Recommandation argumentée', weight: 20, score: recoScore, source: 'deterministic' });

  return computeWeighted(criteria);
}

// ─── SCREENING REPORT ────────────────────────────────────────

export function scoreScreening(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Verdict clair (25%)
  const verdict = data?.decision?.verdict;
  criteria.push({ name: 'Verdict formulé', weight: 25, score: verdict ? 100 : 0, source: 'deterministic' });

  // 2. Critères évalués (25%)
  const matching = data?.matching_criteres || {};
  const totalCrit = (matching.criteres_remplis?.length || 0) + (matching.criteres_non_remplis?.length || 0) + (matching.criteres_partiels?.length || 0);
  criteria.push({ name: 'Critères évalués', weight: 25, score: totalCrit >= 5 ? 100 : totalCrit >= 3 ? 60 : totalCrit >= 1 ? 30 : 0, source: 'deterministic' });

  // 3. Risques programme (20%)
  const nbRisques = (data?.risques_programme || []).length;
  criteria.push({ name: 'Risques identifiés', weight: 20, score: nbRisques >= 2 ? 100 : nbRisques >= 1 ? 50 : 0, source: 'deterministic' });

  // 4. Recommandation financement (15%)
  const financement = data?.recommandation_financement;
  criteria.push({ name: 'Recommandation financement', weight: 15, score: financement?.montant ? 100 : 0, source: 'deterministic' });

  // 5. Score IA (15%)
  criteria.push({ name: 'Score IA', weight: 15, score: clamp(safe(data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── Calcul pondéré ──────────────────────────────────────────

function computeWeighted(criteria: Criterion[]): ScoringResult {
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const weightedSum = criteria.reduce((s, c) => s + c.weight * c.score, 0);
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const filledCount = criteria.filter(c => c.score > 0).length;
  const confidence = Math.round((filledCount / criteria.length) * 100);

  return { score: clamp(score), criteria, confidence };
}

// ─── SIC (Social Impact Canvas) ──────────────────────────────

export function scoreSic(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Dimensions évaluées (25%)
  const dims = data?.dimensions || data?.canvas_blocs || {};
  const nbDims = typeof dims === 'object' ? Object.keys(dims).length : 0;
  criteria.push({ name: 'Dimensions évaluées', weight: 25, score: nbDims >= 5 ? 100 : nbDims >= 3 ? 60 : nbDims >= 1 ? 30 : 0, source: 'deterministic' });

  // 2. ODD identifiés (20%)
  const oddDetail = data?.odd_detail || [];
  const nbOdd = Array.isArray(oddDetail) ? oddDetail.length : 0;
  criteria.push({ name: 'ODD identifiés', weight: 20, score: nbOdd >= 5 ? 100 : nbOdd >= 3 ? 70 : nbOdd >= 1 ? 40 : 0, source: 'deterministic' });

  // 3. Théorie du changement (20%)
  const tdc = data?.theorie_du_changement || data?.theorie_changement;
  criteria.push({ name: 'Théorie du changement', weight: 20, score: tdc ? 100 : 0, source: 'deterministic' });

  // 4. Recommandations (15%)
  const reco = data?.recommandations;
  criteria.push({ name: 'Recommandations', weight: 15, score: reco ? 100 : 0, source: 'deterministic' });

  // 5. Score global IA (20%)
  criteria.push({ name: 'Score impact IA', weight: 20, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── ODD ─────────────────────────────────────────────────────

export function scoreOdd(data: any): ScoringResult {
  const criteria: Criterion[] = [];
  const cibles = data?.evaluation_cibles_odd?.cibles || [];

  // 1. Nombre de cibles évaluées (25%)
  criteria.push({ name: 'Cibles évaluées', weight: 25, score: cibles.length >= 20 ? 100 : cibles.length >= 10 ? 70 : cibles.length >= 5 ? 40 : 10, source: 'deterministic', detail: `${cibles.length} cibles` });

  // 2. Cibles positives (20%)
  const positives = cibles.filter((c: any) => c.evaluation === 'positif').length;
  const ratio = cibles.length > 0 ? positives / cibles.length : 0;
  criteria.push({ name: 'Alignement positif', weight: 20, score: clamp(ratio * 100), source: 'deterministic', detail: `${positives}/${cibles.length}` });

  // 3. Indicateurs d'impact (20%)
  const indicateurs = data?.indicateurs_impact?.indicateurs || [];
  criteria.push({ name: 'Indicateurs mesurables', weight: 20, score: indicateurs.length >= 5 ? 100 : indicateurs.length >= 3 ? 60 : indicateurs.length >= 1 ? 30 : 0, source: 'deterministic' });

  // 4. Synthèse présente (15%)
  criteria.push({ name: 'Synthèse impact', weight: 15, score: data?.synthese ? 100 : 0, source: 'deterministic' });

  // 5. Score global IA (20%)
  criteria.push({ name: 'Score ODD IA', weight: 20, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── PRE-SCREENING ───────────────────────────────────────────

export function scorePreScreening(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Activités identifiées (20%)
  const activites = data?.activites_identifiees || [];
  criteria.push({ name: 'Activités identifiées', weight: 20, score: activites.length >= 3 ? 100 : activites.length >= 1 ? 50 : 0, source: 'deterministic' });

  // 2. KPIs extraits (20%)
  const kpis = data?.kpis_extraits || data?.chiffres_cles || {};
  const nbKpis = typeof kpis === 'object' ? Object.keys(kpis).length : 0;
  criteria.push({ name: 'KPIs extraits', weight: 20, score: nbKpis >= 5 ? 100 : nbKpis >= 3 ? 60 : nbKpis >= 1 ? 30 : 0, source: 'deterministic' });

  // 3. Risques identifiés (15%)
  const risques = data?.risques || [];
  criteria.push({ name: 'Risques identifiés', weight: 15, score: risques.length >= 3 ? 100 : risques.length >= 1 ? 50 : 0, source: 'deterministic' });

  // 4. Forces identifiées (15%)
  const forces = data?.forces || [];
  criteria.push({ name: 'Forces identifiées', weight: 15, score: forces.length >= 3 ? 100 : forces.length >= 1 ? 50 : 0, source: 'deterministic' });

  // 5. Classification (10%)
  criteria.push({ name: 'Classification', weight: 10, score: data?.classification ? 100 : 0, source: 'deterministic' });

  // 6. Score IA (20%)
  criteria.push({ name: 'Score IA', weight: 20, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── PLAN FINANCIER ──────────────────────────────────────────

export function scorePlanFinancier(data: any): ScoringResult {
  const criteria: Criterion[] = [];
  const kpis = data?.kpis || {};
  const projections = data?.projections || [];

  // 1. KPIs calculés (20%)
  const kpiFields = ['ca', 'marge_brute', 'ebitda', 'resultat_net'];
  const kpiFilled = kpiFields.filter(f => safe(kpis[f]) > 0 || safe(kpis[f + '_pct']) > 0);
  criteria.push({ name: 'KPIs financiers', weight: 20, score: Math.round((kpiFilled.length / kpiFields.length) * 100), source: 'deterministic' });

  // 2. Projections (20%)
  criteria.push({ name: 'Projections 5 ans', weight: 20, score: projections.length >= 5 ? 100 : projections.length >= 3 ? 60 : projections.length >= 1 ? 30 : 0, source: 'deterministic' });

  // 3. Produits détaillés (15%)
  const nbProduits = (data?.produits || []).length + (data?.services || []).length;
  criteria.push({ name: 'Produits/services', weight: 15, score: nbProduits >= 3 ? 100 : nbProduits >= 1 ? 50 : 0, source: 'deterministic' });

  // 4. Staff (10%)
  const nbStaff = (data?.staff || []).length;
  criteria.push({ name: 'Effectifs détaillés', weight: 10, score: nbStaff >= 2 ? 100 : nbStaff >= 1 ? 50 : 0, source: 'deterministic' });

  // 5. Seuil de rentabilité (10%)
  criteria.push({ name: 'Seuil rentabilité', weight: 10, score: data?.seuil_rentabilite?.montant ? 100 : 0, source: 'deterministic' });

  // 6. Indicateurs décision (15%)
  const indic = data?.indicateurs_decision || {};
  const nbIndic = ['van', 'tri', 'payback_years', 'dscr_moyen'].filter(k => indic[k] != null).length;
  criteria.push({ name: 'Indicateurs décision', weight: 15, score: Math.round((nbIndic / 4) * 100), source: 'deterministic' });

  // 7. Analyse IA (10%)
  const analyse = data?.analyse || {};
  criteria.push({ name: 'Analyse IA', weight: 10, score: analyse.avis ? Math.min(100, analyse.avis.length / 2) : 0, source: 'ai' });

  return computeWeighted(criteria);
}

// ─── BUSINESS PLAN ───────────────────────────────────────────

export function scoreBusinessPlan(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Sections présentes (30%)
  const sections = ['resume_gestion', 'historique', 'vision', 'mission', 'description_generale', 'swot', 'modele_produit', 'marketing_5p', 'equipe_direction', 'investissement_plan', 'financier_tableau'];
  const filled = sections.filter(s => data?.[s] && (typeof data[s] === 'string' ? data[s].length > 10 : Object.keys(data[s]).length > 0));
  criteria.push({ name: 'Sections rédigées', weight: 30, score: Math.round((filled.length / sections.length) * 100), source: 'deterministic', detail: `${filled.length}/${sections.length}` });

  // 2. SWOT complet (15%)
  const swot = data?.swot || {};
  const swotParts = ['forces', 'faiblesses', 'opportunites', 'menaces'].filter(k => swot[k]?.length > 0);
  criteria.push({ name: 'SWOT complet', weight: 15, score: Math.round((swotParts.length / 4) * 100), source: 'deterministic' });

  // 3. Analyse marché (15%)
  const marche = data?.analyse_marche || {};
  const hasMarche = marche.taille_marche || marche.tam || data?.marche_potentiel;
  criteria.push({ name: 'Analyse marché', weight: 15, score: hasMarche ? 100 : 0, source: 'deterministic' });

  // 4. Tableau financier (15%)
  const fin = data?.financier_tableau || {};
  criteria.push({ name: 'Tableau financier', weight: 15, score: fin.annee1 ? 100 : 0, source: 'deterministic' });

  // 5. Impact (10%)
  const hasImpact = data?.impact_social || data?.impact_environnemental;
  criteria.push({ name: 'Impact documenté', weight: 10, score: hasImpact ? 100 : 0, source: 'deterministic' });

  // 6. Score IA (15%)
  criteria.push({ name: 'Score IA', weight: 15, score: clamp(safe(data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── ONE-PAGER ───────────────────────────────────────────────

export function scoreOnepager(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Sections clés (30%)
  const sections = ['presentation_entreprise', 'apercu_projet', 'proposition_valeur', 'marche', 'potentiel_marche', 'equipe', 'equipe_gouvernance', 'impact', 'besoin_financement'];
  const filled = sections.filter(s => data?.[s]);
  criteria.push({ name: 'Sections complètes', weight: 30, score: Math.round((filled.length / sections.length) * 100), source: 'deterministic' });

  // 2. Chiffres clés (20%)
  const kpis = data?.kpis_financiers || data?.traction_finances || data?.chiffres_cles;
  criteria.push({ name: 'Chiffres clés', weight: 20, score: kpis ? 100 : 0, source: 'deterministic' });

  // 3. Contact (10%)
  criteria.push({ name: 'Contact', weight: 10, score: data?.contact ? 100 : 0, source: 'deterministic' });

  // 4. Valorisation (15%)
  criteria.push({ name: 'Valorisation indicative', weight: 15, score: data?.valorisation_indicative ? 100 : 0, source: 'deterministic' });

  // 5. Impact (10%)
  criteria.push({ name: 'Impact ODD', weight: 10, score: data?.impact_odd || data?.impact ? 100 : 0, source: 'deterministic' });

  // 6. Score IA (15%)
  criteria.push({ name: 'Score IA', weight: 15, score: clamp(safe(data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}
