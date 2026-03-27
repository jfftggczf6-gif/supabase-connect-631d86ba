/**
 * ESONO — Scoring pondéré par livrable
 *
 * 3 axes : Fiabilité données, Qualité projet, Investment readiness
 * Mix déterministe (chiffres, ratios, cohérence) + IA (qualitatif)
 */

interface Criterion {
  name: string;
  weight: number;
  score: number;
  source: 'deterministic' | 'ai';
  detail?: string;
}

interface ScoringResult {
  score: number;
  criteria: Criterion[];
  confidence: number;
}

function safe(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function computeWeighted(criteria: Criterion[]): ScoringResult {
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const weightedSum = criteria.reduce((s, c) => s + c.weight * c.score, 0);
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const filledCount = criteria.filter(c => c.score > 0).length;
  const confidence = Math.round((filledCount / criteria.length) * 100);
  return { score: clamp(score), criteria, confidence };
}

// ─── INPUTS DATA ─────────────────────────────────────────────

export function scoreInputs(data: any): ScoringResult {
  const cr = data?.compte_resultat || {};
  const bil = data?.bilan || {};
  const criteria: Criterion[] = [];

  // 1. CA documenté et crédible (20%)
  const ca = safe(cr.chiffre_affaires || cr.ca);
  const caScore = ca > 0 ? (ca > 1000 ? 100 : 50) : 0;
  criteria.push({ name: 'CA documenté', weight: 20, score: caScore, source: 'deterministic', detail: ca > 0 ? `${(ca/1e6).toFixed(1)}M` : 'absent' });

  // 2. Rentabilité réelle (20%)
  const rn = safe(cr.resultat_net);
  const margeNette = ca > 0 ? (rn / ca) * 100 : 0;
  const rentaScore = rn > 0 ? 80 : (rn > -ca * 0.1 ? 50 : 20);
  criteria.push({ name: 'Rentabilité', weight: 20, score: rentaScore, source: 'deterministic', detail: `marge nette ${margeNette.toFixed(1)}%` });

  // 3. Équilibre bilan (15%)
  const actif = safe(bil.total_actif);
  const cp = safe(bil.capitaux_propres);
  const bilanScore = cp > 0 ? 90 : (actif > 0 ? 50 : 10);
  criteria.push({ name: 'Santé bilancielle', weight: 15, score: bilanScore, source: 'deterministic', detail: cp > 0 ? 'CP positifs' : cp < 0 ? 'CP négatifs' : 'bilan incomplet' });

  // 4. Historique multi-années (15%)
  const hasHist = data?.historique_3ans || data?.compte_resultat_n_moins_1;
  const histScore = data?.historique_3ans?.n_moins_2 ? 100 : (hasHist ? 60 : 10);
  criteria.push({ name: 'Profondeur historique', weight: 15, score: histScore, source: 'deterministic' });

  // 5. Fiabilité sources (15%)
  const nbSources = (data?.source_documents || []).length;
  const hasValidation = data?._validation?.valid;
  const fiabScore = hasValidation ? 90 : (nbSources >= 2 ? 70 : nbSources >= 1 ? 40 : 15);
  criteria.push({ name: 'Fiabilité sources', weight: 15, score: fiabScore, source: 'deterministic' });

  // 6. Données opérationnelles (15%)
  const hasEquipe = (data?.equipe?.length > 0 || data?.effectif_total > 0);
  const hasProduits = (data?.produits_services?.length > 0);
  const opScore = (hasEquipe && hasProduits) ? 100 : (hasEquipe || hasProduits) ? 50 : 10;
  criteria.push({ name: 'Données opérationnelles', weight: 15, score: opScore, source: 'deterministic' });

  return computeWeighted(criteria);
}

// ─── BMC ─────────────────────────────────────────────────────

export function scoreBmc(data: any): ScoringResult {
  const canvas = data?.canvas || {};
  const criteria: Criterion[] = [];

  // 1. Proposition de valeur claire (20%)
  const pv = canvas.proposition_valeur;
  const pvItems = Array.isArray(pv) ? pv : pv?.items || [];
  const pvScore = pvItems.length >= 3 ? 100 : pvItems.length >= 1 ? 60 : (typeof pv === 'string' && pv.length > 20 ? 50 : 10);
  criteria.push({ name: 'Proposition de valeur', weight: 20, score: pvScore, source: 'deterministic' });

  // 2. Modèle de revenus viable (20%)
  const fr = canvas.flux_revenus;
  const frItems = Array.isArray(fr) ? fr : fr?.items || [];
  const hasChiffres = frItems.some((f: any) => typeof f === 'object' && (f.montant || f.prix));
  const frScore = hasChiffres ? 100 : frItems.length >= 2 ? 70 : frItems.length >= 1 ? 40 : 10;
  criteria.push({ name: 'Modèle de revenus', weight: 20, score: frScore, source: 'deterministic' });

  // 3. Marché identifié (15%)
  const sc = canvas.segments_clients;
  const scItems = Array.isArray(sc) ? sc : sc?.items || [];
  criteria.push({ name: 'Segments clients', weight: 15, score: scItems.length >= 2 ? 100 : scItems.length >= 1 ? 50 : 10, source: 'deterministic' });

  // 4. SWOT — risques identifiés (15%)
  const swot = data?.swot || {};
  const nbFaiblesses = (swot.faiblesses || []).length;
  const nbMenaces = (swot.menaces || []).length;
  const riskAware = nbFaiblesses >= 2 && nbMenaces >= 2 ? 100 : (nbFaiblesses + nbMenaces >= 2 ? 60 : 20);
  criteria.push({ name: 'Conscience des risques', weight: 15, score: riskAware, source: 'deterministic' });

  // 5. Score qualité IA (30%)
  const aiScore = safe(data?.score_global || data?.diagnostic?.score_global || data?.score);
  criteria.push({ name: 'Qualité business model (IA)', weight: 30, score: clamp(aiScore), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── SIC ─────────────────────────────────────────────────────

export function scoreSic(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Impact mesurable (25%)
  const indicateurs = data?.indicateurs_impact?.indicateurs || data?.chiffres_cles || [];
  const nbIndic = Array.isArray(indicateurs) ? indicateurs.length : 0;
  criteria.push({ name: 'Indicateurs mesurables', weight: 25, score: nbIndic >= 5 ? 100 : nbIndic >= 3 ? 70 : nbIndic >= 1 ? 40 : 10, source: 'deterministic' });

  // 2. Théorie du changement (20%)
  const tdc = data?.theorie_du_changement || data?.theorie_changement;
  const tdcScore = tdc && typeof tdc === 'object' && Object.keys(tdc).length >= 3 ? 100 : tdc ? 60 : 10;
  criteria.push({ name: 'Théorie du changement', weight: 20, score: tdcScore, source: 'deterministic' });

  // 3. Alignement ODD (20%)
  const odds = data?.odd_detail || [];
  const nbOdd = Array.isArray(odds) ? odds.length : 0;
  criteria.push({ name: 'Alignement ODD', weight: 20, score: nbOdd >= 5 ? 100 : nbOdd >= 3 ? 70 : nbOdd >= 1 ? 40 : 10, source: 'deterministic' });

  // 4. Score impact IA (35%)
  criteria.push({ name: 'Qualité impact (IA)', weight: 35, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── PRE-SCREENING ───────────────────────────────────────────

export function scorePreScreening(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Chiffres clés extraits (25%)
  const kpis = data?.kpis_extraits || data?.chiffres_cles || {};
  const nbKpis = typeof kpis === 'object' ? Object.keys(kpis).filter(k => kpis[k] != null).length : 0;
  criteria.push({ name: 'Données clés identifiées', weight: 25, score: nbKpis >= 5 ? 100 : nbKpis >= 3 ? 60 : nbKpis >= 1 ? 30 : 5, source: 'deterministic' });

  // 2. Risques vs Forces (25%)
  const risques = (data?.risques || []).length;
  const forces = (data?.forces || []).length;
  const balanceScore = (forces > 0 && risques > 0) ? Math.min(100, (forces / (forces + risques)) * 150) : (forces > 0 ? 60 : 20);
  criteria.push({ name: 'Ratio forces/risques', weight: 25, score: clamp(balanceScore), source: 'deterministic' });

  // 3. Score IA global (50%)
  criteria.push({ name: 'Évaluation préliminaire (IA)', weight: 50, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── DIAGNOSTIC (Bilan de progression) ───────────────────────

export function scoreDiagnostic(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Benchmarks vs secteur (25%)
  const bm = data?.benchmarks || {};
  const bmEntries = Object.values(bm).filter((v: any) => v?.entreprise != null && v?.entreprise !== 0 && v?.verdict);
  const nbOk = bmEntries.filter((v: any) => v.verdict === 'au_dessus' || v.verdict === 'dans_norme').length;
  const bmScore = bmEntries.length > 0 ? Math.round((nbOk / bmEntries.length) * 100) : 0;
  criteria.push({ name: 'Performance vs secteur', weight: 25, score: bmScore, source: 'deterministic', detail: `${nbOk}/${bmEntries.length} dans la norme` });

  // 2. Bloquants résolus (20%)
  const bloquants = (data?.problemes || []).filter((p: any) => p.urgence === 'bloquant');
  const nbBloquants = bloquants.length;
  const bloquantScore = nbBloquants === 0 ? 100 : nbBloquants <= 1 ? 50 : nbBloquants <= 3 ? 25 : 5;
  criteria.push({ name: 'Bloquants', weight: 20, score: bloquantScore, source: 'deterministic', detail: `${nbBloquants} bloquant(s)` });

  // 3. Prêt pour bailleur (20%)
  const pret = data?.verdict_readiness?.pret_pour_bailleur;
  criteria.push({ name: 'Prêt pour bailleur', weight: 20, score: pret === true ? 100 : pret === false ? 20 : 0, source: 'deterministic' });

  // 4. Score IA verdict (35%)
  const verdictScore = safe(data?.verdict_readiness?.score || data?.score_global || data?.score);
  criteria.push({ name: 'Score readiness (IA)', weight: 35, score: clamp(verdictScore), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── PLAN FINANCIER ──────────────────────────────────────────

export function scorePlanFinancier(data: any): ScoringResult {
  const criteria: Criterion[] = [];
  const kpis = data?.kpis || {};
  const indic = data?.indicateurs_decision || {};
  const projections = data?.projections || [];

  // 1. Rentabilité (25%)
  const margeBrute = safe(kpis.marge_brute_pct);
  const ebitdaPct = safe(kpis.ebitda_pct);
  const rentaScore = margeBrute > 40 ? 100 : margeBrute > 25 ? 70 : margeBrute > 10 ? 40 : 10;
  criteria.push({ name: 'Rentabilité', weight: 25, score: rentaScore, source: 'deterministic', detail: `marge brute ${margeBrute}%, EBITDA ${ebitdaPct}%` });

  // 2. Retour sur investissement (20%)
  const tri = safe(indic.tri);
  const van = safe(indic.van);
  const roiScore = tri > 20 ? 100 : tri > 15 ? 80 : tri > 10 ? 60 : tri > 0 ? 40 : (van > 0 ? 30 : 10);
  criteria.push({ name: 'ROI investisseur', weight: 20, score: roiScore, source: 'deterministic', detail: `TRI ${tri}%, VAN ${(van/1e6).toFixed(1)}M` });

  // 3. Viabilité (croissance réaliste) (20%)
  const hyp = data?.hypotheses_ia || {};
  const croissance = hyp.taux_croissance_ca;
  let croissScore = 50;
  if (Array.isArray(croissance) && croissance.length > 0) {
    const maxCroiss = Math.max(...croissance.map(Number));
    croissScore = maxCroiss <= 0.30 ? 90 : maxCroiss <= 0.50 ? 60 : 30;
  }
  criteria.push({ name: 'Hypothèses réalistes', weight: 20, score: croissScore, source: 'deterministic' });

  // 4. Solvabilité (15%)
  const dscr = safe(indic.dscr_moyen);
  const payback = safe(indic.payback_years);
  const solvScore = dscr > 1.5 ? 100 : dscr > 1.2 ? 70 : dscr > 1 ? 40 : (payback > 0 && payback < 5 ? 50 : 15);
  criteria.push({ name: 'Capacité de remboursement', weight: 15, score: solvScore, source: 'deterministic' });

  // 5. Score analyse IA (20%)
  const avis = data?.analyse?.score_investissabilite || safe(data?.score);
  criteria.push({ name: 'Investissabilité (IA)', weight: 20, score: clamp(avis), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── ODD ─────────────────────────────────────────────────────

export function scoreOdd(data: any): ScoringResult {
  const criteria: Criterion[] = [];
  const cibles = data?.evaluation_cibles_odd?.cibles || [];

  // 1. Couverture ODD (25%)
  const oddsUniques = new Set(cibles.map((c: any) => String(c.target_id || c.cible || '').split('.')[0]));
  criteria.push({ name: 'ODD couverts', weight: 25, score: oddsUniques.size >= 8 ? 100 : oddsUniques.size >= 5 ? 70 : oddsUniques.size >= 3 ? 40 : 10, source: 'deterministic', detail: `${oddsUniques.size} ODD` });

  // 2. Taux d'impact positif (30%)
  const positives = cibles.filter((c: any) => c.evaluation === 'positif').length;
  const ratio = cibles.length > 0 ? (positives / cibles.length) * 100 : 0;
  criteria.push({ name: 'Impact positif', weight: 30, score: clamp(ratio), source: 'deterministic', detail: `${positives}/${cibles.length} positifs` });

  // 3. Indicateurs mesurables (25%)
  const indicateurs = data?.indicateurs_impact?.indicateurs || [];
  const withTarget = indicateurs.filter((i: any) => i.cible || i.objectif || i.target);
  criteria.push({ name: 'Indicateurs avec cibles', weight: 25, score: withTarget.length >= 5 ? 100 : withTarget.length >= 3 ? 60 : withTarget.length >= 1 ? 30 : 0, source: 'deterministic' });

  // 4. Score IA (20%)
  criteria.push({ name: 'Évaluation impact (IA)', weight: 20, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── BUSINESS PLAN ───────────────────────────────────────────

export function scoreBusinessPlan(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Marché documenté (20%)
  const marche = data?.analyse_marche || {};
  const hasTam = marche.taille_marche?.tam || marche.taille_marche;
  const hasConcurrents = (marche.concurrents || []).length >= 2;
  const marcheScore = (hasTam && hasConcurrents) ? 100 : hasTam ? 60 : hasConcurrents ? 40 : 10;
  criteria.push({ name: 'Analyse marché', weight: 20, score: marcheScore, source: 'deterministic' });

  // 2. Modèle économique clair (20%)
  const hasModele = data?.modele_produit && data?.modele_revenus_depenses;
  const has5p = data?.marketing_5p && Object.keys(data.marketing_5p).length >= 3;
  criteria.push({ name: 'Modèle économique', weight: 20, score: (hasModele && has5p) ? 100 : hasModele ? 60 : 20, source: 'deterministic' });

  // 3. Projections financières (20%)
  const fin = data?.financier_tableau || {};
  const hasMultiYear = fin.annee1 && fin.annee2;
  criteria.push({ name: 'Projections financières', weight: 20, score: hasMultiYear ? 100 : fin.annee1 ? 50 : 10, source: 'deterministic' });

  // 4. SWOT réaliste (10%)
  const swot = data?.swot || {};
  const balanced = (swot.forces?.length >= 2 && swot.faiblesses?.length >= 2);
  criteria.push({ name: 'SWOT équilibré', weight: 10, score: balanced ? 100 : 30, source: 'deterministic' });

  // 5. Score qualité IA (30%)
  criteria.push({ name: 'Qualité globale (IA)', weight: 30, score: clamp(safe(data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── VALUATION ───────────────────────────────────────────────

export function scoreValuation(data: any): ScoringResult {
  const criteria: Criterion[] = [];
  const dcf = data?.dcf || {};
  const mult = data?.multiples || {};
  const synthese = data?.synthese_valorisation || {};

  // 1. Cohérence inter-méthodes (30%)
  const vBasse = safe(synthese.valeur_basse);
  const vHaute = safe(synthese.valeur_haute);
  const vMed = safe(synthese.valeur_mediane);
  let coherence = 0;
  if (vBasse > 0 && vHaute > 0 && vMed > 0) {
    const spread = (vHaute - vBasse) / vMed;
    coherence = spread < 0.5 ? 100 : spread < 1 ? 70 : spread < 2 ? 40 : 20;
  }
  criteria.push({ name: 'Cohérence valorisation', weight: 30, score: coherence, source: 'deterministic' });

  // 2. WACC justifié (20%)
  const wacc = safe(dcf.wacc_pct || (dcf.wacc && dcf.wacc * 100));
  const waccScore = (wacc > 10 && wacc < 35) ? 90 : (wacc > 0 ? 50 : 0);
  criteria.push({ name: 'WACC crédible', weight: 20, score: waccScore, source: 'deterministic', detail: `${wacc.toFixed(1)}%` });

  // 3. Multiple réaliste (20%)
  const multEbitda = safe(mult.multiple_ebitda_retenu);
  const multScore = (multEbitda >= 3 && multEbitda <= 8) ? 100 : (multEbitda > 0 ? 50 : 0);
  criteria.push({ name: 'Multiple réaliste', weight: 20, score: multScore, source: 'deterministic', detail: `${multEbitda}x EBITDA` });

  // 4. Qualité inputs (30%)
  const iq = data?._engine?.inputs_quality;
  const iqScore = iq === 'high' ? 100 : iq === 'medium' ? 60 : iq === 'low' ? 30 : 15;
  criteria.push({ name: 'Fiabilité données source', weight: 30, score: iqScore, source: 'deterministic' });

  return computeWeighted(criteria);
}

// ─── ONE-PAGER ───────────────────────────────────────────────

export function scoreOnepager(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Chiffres clés présents (30%)
  const kpis = data?.kpis_financiers || data?.traction_finances || {};
  const hasCA = typeof kpis === 'object' && Object.keys(kpis).length > 0;
  const hasValo = data?.valorisation_indicative;
  criteria.push({ name: 'Chiffres investisseur', weight: 30, score: (hasCA && hasValo) ? 100 : hasCA ? 60 : 20, source: 'deterministic' });

  // 2. Pitch clair (25%)
  const hasPresentation = data?.presentation_entreprise || data?.apercu_projet;
  const hasPV = data?.proposition_valeur || data?.probleme_solution;
  criteria.push({ name: 'Pitch clair', weight: 25, score: (hasPresentation && hasPV) ? 100 : hasPresentation ? 50 : 10, source: 'deterministic' });

  // 3. Impact documenté (20%)
  const hasImpact = data?.impact || data?.impact_odd;
  criteria.push({ name: 'Impact documenté', weight: 20, score: hasImpact ? 100 : 10, source: 'deterministic' });

  // 4. Score IA (25%)
  criteria.push({ name: 'Qualité one-pager (IA)', weight: 25, score: clamp(safe(data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── INVESTMENT MEMO ─────────────────────────────────────────

export function scoreMemo(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Thèse équilibrée (25%)
  const thesePos = data?.these_investissement?.these_positive;
  const theseNeg = data?.these_investissement?.these_negative;
  const posLen = typeof thesePos === 'string' ? thesePos.length : (thesePos?.synthese?.length || 0);
  const negLen = typeof theseNeg === 'string' ? theseNeg.length : (theseNeg?.synthese?.length || 0);
  const theseScore = (posLen > 100 && negLen > 100) ? 100 : (posLen > 50 && negLen > 50) ? 70 : (posLen > 0 || negLen > 0) ? 30 : 0;
  criteria.push({ name: 'Thèse équilibrée', weight: 25, score: theseScore, source: 'deterministic' });

  // 2. Risques quantifiés (20%)
  const risques = data?.analyse_risques?.risques_identifies || [];
  const withMitigation = risques.filter((r: any) => r.mitigation && r.mitigation.length > 10);
  criteria.push({ name: 'Risques avec mitigation', weight: 20, score: withMitigation.length >= 3 ? 100 : withMitigation.length >= 1 ? 50 : 0, source: 'deterministic' });

  // 3. Recommandation argumentée (20%)
  const reco = data?.recommandation_finale || {};
  const justifLen = typeof reco.justification === 'string' ? reco.justification.length : 0;
  criteria.push({ name: 'Recommandation argumentée', weight: 20, score: justifLen > 200 ? 100 : justifLen > 50 ? 50 : (reco.verdict ? 20 : 0), source: 'deterministic' });

  // 4. Score IR (35%)
  criteria.push({ name: 'Score Investment Readiness', weight: 35, score: clamp(safe(data?.resume_executif?.score_ir || data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}

// ─── SCREENING REPORT ────────────────────────────────────────

export function scoreScreening(data: any): ScoringResult {
  const criteria: Criterion[] = [];

  // 1. Verdict tranché (25%)
  const verdict = data?.decision?.verdict;
  const verdictScore = verdict === 'ÉLIGIBLE' || verdict === 'ELIGIBLE' ? 100 : verdict?.includes('CONDITIONNEL') ? 60 : verdict ? 30 : 0;
  criteria.push({ name: 'Verdict clair', weight: 25, score: verdictScore, source: 'deterministic' });

  // 2. Critères évalués (25%)
  const matching = data?.matching_criteres || {};
  const met = (matching.criteres_remplis || []).length;
  const notMet = (matching.criteres_non_remplis || []).length;
  const total = met + notMet + (matching.criteres_partiels || []).length;
  const eligScore = total > 0 ? Math.round((met / total) * 100) : 0;
  criteria.push({ name: 'Critères remplis', weight: 25, score: eligScore, source: 'deterministic', detail: `${met}/${total}` });

  // 3. Recommandation financement (20%)
  const financement = data?.recommandation_financement;
  criteria.push({ name: 'Financement recommandé', weight: 20, score: financement?.montant ? 100 : financement ? 40 : 0, source: 'deterministic' });

  // 4. Score IA (30%)
  criteria.push({ name: 'Évaluation programme (IA)', weight: 30, score: clamp(safe(data?.score)), source: 'ai' });

  return computeWeighted(criteria);
}
