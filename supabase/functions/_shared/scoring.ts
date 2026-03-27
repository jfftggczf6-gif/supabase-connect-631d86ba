/**
 * ESONO — Scoring pondéré par livrable v3
 *
 * 60% IA (qualité projet, viabilité, potentiel)
 * 40% Déterministe (fiabilité données, cohérence, ratios)
 */

interface Criterion { name: string; weight: number; score: number; source: 'deterministic' | 'ai'; detail?: string; }
interface ScoringResult { score: number; criteria: Criterion[]; confidence: number; }

function safe(v: any): number { const n = Number(v); return isNaN(n) ? 0 : n; }
function clamp(v: number): number { return Math.max(0, Math.min(100, Math.round(v))); }

function computeWeighted(criteria: Criterion[]): ScoringResult {
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const weightedSum = criteria.reduce((s, c) => s + c.weight * c.score, 0);
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const filledCount = criteria.filter(c => c.score > 0).length;
  return { score: clamp(score), criteria, confidence: Math.round((filledCount / criteria.length) * 100) };
}

// ─── INPUTS DATA ─────────────────────────────────────────────

export function scoreInputs(data: any): ScoringResult {
  const cr = data?.compte_resultat || {};
  const bil = data?.bilan || {};
  const ca = safe(cr.chiffre_affaires || cr.ca);
  const rn = safe(cr.resultat_net);

  return computeWeighted([
    // Déterministe 40% — fiabilité des données
    { name: 'Rentabilité réelle', weight: 15, score: rn > 0 ? 85 : (ca > 0 && rn > -ca * 0.2 ? 40 : 10), source: 'deterministic', detail: ca > 0 ? `marge ${(rn/ca*100).toFixed(1)}%` : 'pas de CA' },
    { name: 'Capitaux propres', weight: 10, score: safe(bil.capitaux_propres) > 0 ? 90 : (safe(bil.total_actif) > 0 ? 40 : 5), source: 'deterministic' },
    { name: 'Sources vérifiables', weight: 10, score: (data?.source_documents?.length >= 2) ? 90 : (data?.source_documents?.length >= 1 ? 50 : 10), source: 'deterministic' },
    { name: 'Cohérence bilan', weight: 5, score: data?._validation?.valid ? 95 : (data?._validation?.errors === 0 ? 70 : 30), source: 'deterministic' },
    // IA 60% — qualité extraction
    { name: 'Qualité extraction (IA)', weight: 60, score: clamp(safe(data?.score || data?.fiabilite)), source: 'ai' },
  ]);
}

// ─── BMC ─────────────────────────────────────────────────────

export function scoreBmc(data: any): ScoringResult {
  const canvas = data?.canvas || {};
  const swot = data?.swot || {};
  const fr = canvas.flux_revenus;

  return computeWeighted([
    // Déterministe 40% — fiabilité
    { name: 'Revenus chiffrés', weight: 15, score: (fr && typeof fr === 'object' && (fr.ca_mensuel || fr.marge_brute || fr.montant)) ? 95 : (fr ? 40 : 5), source: 'deterministic' },
    { name: 'Risques identifiés', weight: 15, score: (swot.faiblesses?.length >= 3 && swot.menaces?.length >= 2) ? 95 : (swot.faiblesses?.length >= 1 ? 50 : 10), source: 'deterministic' },
    { name: 'Concurrence analysée', weight: 10, score: canvas.concurrents?.length >= 2 || (typeof canvas.partenaires_cles === 'object' && canvas.partenaires_cles) ? 80 : 20, source: 'deterministic' },
    // IA 60% — qualité du business model
    { name: 'Qualité business model (IA)', weight: 60, score: clamp(safe(data?.score_global || data?.diagnostic?.score_global || data?.score)), source: 'ai' },
  ]);
}

// ─── SIC ─────────────────────────────────────────────────────

export function scoreSic(data: any): ScoringResult {
  const indicateurs = data?.indicateurs_impact?.indicateurs || data?.chiffres_cles || [];
  const nbIndic = Array.isArray(indicateurs) ? indicateurs.length : 0;

  return computeWeighted([
    // Déterministe 40%
    { name: 'Indicateurs mesurables', weight: 20, score: nbIndic >= 5 ? 95 : nbIndic >= 3 ? 65 : nbIndic >= 1 ? 35 : 5, source: 'deterministic' },
    { name: 'Théorie du changement', weight: 10, score: (data?.theorie_du_changement || data?.theorie_changement) ? 90 : 10, source: 'deterministic' },
    { name: 'ODD alignés', weight: 10, score: (data?.odd_detail?.length >= 3) ? 90 : (data?.odd_detail?.length >= 1 ? 50 : 10), source: 'deterministic' },
    // IA 60%
    { name: 'Qualité impact (IA)', weight: 60, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' },
  ]);
}

// ─── PRE-SCREENING ───────────────────────────────────────────

export function scorePreScreening(data: any): ScoringResult {
  const forces = (data?.forces || []).length;
  const risques = (data?.risques || []).length;

  return computeWeighted([
    // Déterministe 35%
    { name: 'Données extraites', weight: 15, score: (data?.kpis_extraits && Object.keys(data.kpis_extraits).length >= 3) ? 90 : 30, source: 'deterministic' },
    { name: 'Équilibre forces/risques', weight: 10, score: (forces >= 2 && risques >= 2) ? 90 : (forces + risques >= 2 ? 50 : 10), source: 'deterministic' },
    { name: 'Activités identifiées', weight: 10, score: (data?.activites_identifiees?.length >= 2) ? 90 : (data?.activites_identifiees?.length >= 1 ? 50 : 10), source: 'deterministic' },
    // IA 65%
    { name: 'Évaluation initiale (IA)', weight: 65, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' },
  ]);
}

// ─── DIAGNOSTIC ──────────────────────────────────────────────

export function scoreDiagnostic(data: any): ScoringResult {
  const bm = data?.benchmarks || {};
  const bmEntries = Object.values(bm).filter((v: any) => v?.entreprise != null && v?.verdict);
  const nbOk = bmEntries.filter((v: any) => v.verdict === 'au_dessus' || v.verdict === 'dans_norme').length;
  const bloquants = (data?.problemes || []).filter((p: any) => p.urgence === 'bloquant').length;

  return computeWeighted([
    // Déterministe 40%
    { name: 'Performance vs secteur', weight: 15, score: bmEntries.length > 0 ? Math.round((nbOk / bmEntries.length) * 100) : 0, source: 'deterministic', detail: `${nbOk}/${bmEntries.length}` },
    { name: 'Bloquants', weight: 15, score: bloquants === 0 ? 100 : bloquants <= 1 ? 45 : bloquants <= 3 ? 20 : 5, source: 'deterministic', detail: `${bloquants} bloquant(s)` },
    { name: 'Prêt bailleur', weight: 10, score: data?.verdict_readiness?.pret_pour_bailleur ? 100 : 15, source: 'deterministic' },
    // IA 60%
    { name: 'Score readiness (IA)', weight: 60, score: clamp(safe(data?.verdict_readiness?.score || data?.score_global || data?.score)), source: 'ai' },
  ]);
}

// ─── PLAN FINANCIER ──────────────────────────────────────────

export function scorePlanFinancier(data: any): ScoringResult {
  const kpis = data?.kpis || {};
  const indic = data?.indicateurs_decision || {};
  const margeBrute = safe(kpis.marge_brute_pct);
  const tri = safe(indic.tri);

  return computeWeighted([
    // Déterministe 40%
    { name: 'Rentabilité', weight: 15, score: margeBrute > 40 ? 95 : margeBrute > 25 ? 65 : margeBrute > 10 ? 35 : 5, source: 'deterministic', detail: `marge brute ${margeBrute}%` },
    { name: 'ROI investisseur', weight: 15, score: tri > 20 ? 95 : tri > 15 ? 75 : tri > 10 ? 50 : tri > 0 ? 30 : 5, source: 'deterministic', detail: `TRI ${tri}%` },
    { name: 'Solvabilité', weight: 10, score: safe(indic.dscr_moyen) > 1.5 ? 95 : safe(indic.dscr_moyen) > 1 ? 60 : (safe(indic.payback_years) > 0 && safe(indic.payback_years) < 5 ? 50 : 10), source: 'deterministic' },
    // IA 60%
    { name: 'Investissabilité (IA)', weight: 60, score: clamp(safe(data?.analyse?.score_investissabilite || data?.score)), source: 'ai' },
  ]);
}

// ─── ODD ─────────────────────────────────────────────────────

export function scoreOdd(data: any): ScoringResult {
  const cibles = data?.evaluation_cibles_odd?.cibles || [];
  const positives = cibles.filter((c: any) => c.evaluation === 'positif').length;
  const ratio = cibles.length > 0 ? (positives / cibles.length) * 100 : 0;

  return computeWeighted([
    // Déterministe 40%
    { name: 'Taux impact positif', weight: 20, score: clamp(ratio), source: 'deterministic', detail: `${positives}/${cibles.length}` },
    { name: 'Indicateurs avec cibles', weight: 10, score: (data?.indicateurs_impact?.indicateurs || []).filter((i: any) => i.cible || i.objectif).length >= 3 ? 90 : 30, source: 'deterministic' },
    { name: 'Couverture ODD', weight: 10, score: new Set(cibles.map((c: any) => String(c.target_id || '').split('.')[0])).size >= 5 ? 90 : 30, source: 'deterministic' },
    // IA 60%
    { name: 'Évaluation impact (IA)', weight: 60, score: clamp(safe(data?.score_global || data?.score)), source: 'ai' },
  ]);
}

// ─── BUSINESS PLAN ───────────────────────────────────────────

export function scoreBusinessPlan(data: any): ScoringResult {
  const marche = data?.analyse_marche || {};
  const swot = data?.swot || {};

  return computeWeighted([
    // Déterministe 40%
    { name: 'Marché chiffré', weight: 15, score: (marche.taille_marche?.tam || marche.taille_marche) ? 90 : 15, source: 'deterministic' },
    { name: 'Concurrence analysée', weight: 10, score: (marche.concurrents?.length >= 2 || marche.positionnement_entreprise) ? 90 : 20, source: 'deterministic' },
    { name: 'SWOT réaliste', weight: 10, score: (swot.forces?.length >= 2 && swot.faiblesses?.length >= 2) ? 90 : 25, source: 'deterministic' },
    { name: 'Projections financières', weight: 5, score: data?.financier_tableau?.annee1 ? 90 : 10, source: 'deterministic' },
    // IA 60%
    { name: 'Qualité globale (IA)', weight: 60, score: clamp(safe(data?.score)), source: 'ai' },
  ]);
}

// ─── VALUATION ───────────────────────────────────────────────

export function scoreValuation(data: any): ScoringResult {
  const synthese = data?.synthese_valorisation || {};
  const dcf = data?.dcf || {};
  const mult = data?.multiples || {};
  const vB = safe(synthese.valeur_basse); const vH = safe(synthese.valeur_haute); const vM = safe(synthese.valeur_mediane);
  let coherence = 0;
  if (vB > 0 && vH > 0 && vM > 0) { const spread = (vH - vB) / vM; coherence = spread < 0.5 ? 95 : spread < 1 ? 65 : spread < 2 ? 35 : 15; }
  const wacc = safe(dcf.wacc_pct || (dcf.wacc && dcf.wacc * 100));
  const multE = safe(mult.multiple_ebitda_retenu);

  return computeWeighted([
    // Déterministe 50% — la valuation est principalement calculée
    { name: 'Cohérence méthodes', weight: 20, score: coherence, source: 'deterministic' },
    { name: 'WACC crédible', weight: 10, score: (wacc > 10 && wacc < 35) ? 90 : (wacc > 0 ? 40 : 0), source: 'deterministic', detail: `${wacc.toFixed(1)}%` },
    { name: 'Multiple réaliste', weight: 10, score: (multE >= 3 && multE <= 8) ? 90 : (multE > 0 ? 40 : 0), source: 'deterministic', detail: `${multE}x` },
    { name: 'Qualité données source', weight: 10, score: data?._engine?.inputs_quality === 'high' ? 95 : data?._engine?.inputs_quality === 'medium' ? 55 : 20, source: 'deterministic' },
    // IA 50% — analyse qualitative
    { name: 'Analyse valorisation (IA)', weight: 50, score: clamp(safe(data?.score)), source: 'ai' },
  ]);
}

// ─── ONE-PAGER ───────────────────────────────────────────────

export function scoreOnepager(data: any): ScoringResult {
  const kpis = data?.kpis_financiers || data?.traction_finances || {};
  const hasChiffres = typeof kpis === 'object' && Object.keys(kpis).length > 0;

  return computeWeighted([
    // Déterministe 35%
    { name: 'Chiffres investisseur', weight: 20, score: (hasChiffres && data?.valorisation_indicative) ? 95 : hasChiffres ? 55 : 10, source: 'deterministic' },
    { name: 'Impact documenté', weight: 15, score: (data?.impact || data?.impact_odd) ? 90 : 10, source: 'deterministic' },
    // IA 65%
    { name: 'Qualité pitch (IA)', weight: 65, score: clamp(safe(data?.score)), source: 'ai' },
  ]);
}

// ─── INVESTMENT MEMO ─────────────────────────────────────────

export function scoreMemo(data: any): ScoringResult {
  const risques = data?.analyse_risques?.risques_identifies || [];
  const withMit = risques.filter((r: any) => r.mitigation?.length > 10);
  const theseP = data?.these_investissement?.these_positive;
  const theseN = data?.these_investissement?.these_negative;
  const posLen = typeof theseP === 'string' ? theseP.length : (theseP?.synthese?.length || 0);
  const negLen = typeof theseN === 'string' ? theseN.length : (theseN?.synthese?.length || 0);

  return computeWeighted([
    // Déterministe 40%
    { name: 'Thèse équilibrée', weight: 15, score: (posLen > 100 && negLen > 100) ? 95 : (posLen > 50 && negLen > 50) ? 60 : 15, source: 'deterministic' },
    { name: 'Risques mitigés', weight: 15, score: withMit.length >= 3 ? 95 : withMit.length >= 1 ? 45 : 5, source: 'deterministic' },
    { name: 'Recommandation argumentée', weight: 10, score: (data?.recommandation_finale?.justification?.length > 200 || data?.recommandation_finale?.justification?.facteur_decisif) ? 95 : (data?.recommandation_finale?.verdict ? 30 : 0), source: 'deterministic' },
    // IA 60%
    { name: 'Score Investment Readiness', weight: 60, score: clamp(safe(data?.resume_executif?.score_ir || data?.score)), source: 'ai' },
  ]);
}

// ─── SCREENING REPORT ────────────────────────────────────────

export function scoreScreening(data: any): ScoringResult {
  const matching = data?.matching_criteres || {};
  const met = (matching.criteres_remplis || []).length;
  const total = met + (matching.criteres_non_remplis || []).length + (matching.criteres_partiels || []).length;

  return computeWeighted([
    // Déterministe 40%
    { name: 'Critères remplis', weight: 20, score: total > 0 ? Math.round((met / total) * 100) : 0, source: 'deterministic', detail: `${met}/${total}` },
    { name: 'Verdict clair', weight: 10, score: data?.decision?.verdict ? 90 : 0, source: 'deterministic' },
    { name: 'Financement recommandé', weight: 10, score: data?.recommandation_financement?.montant ? 90 : 10, source: 'deterministic' },
    // IA 60%
    { name: 'Évaluation programme (IA)', weight: 60, score: clamp(safe(data?.score)), source: 'ai' },
  ]);
}
