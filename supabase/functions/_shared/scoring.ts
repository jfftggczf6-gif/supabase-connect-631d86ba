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
