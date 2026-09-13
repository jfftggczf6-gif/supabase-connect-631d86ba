// Contrat de prose du diagnostic de candidature.
//
// Ce fichier définit LA frontière entre ce qui peut être rendu dans une autre
// langue (la prose) et ce qui ne doit jamais l'être (le déterministe : score,
// montants, statuts, niveaux de preuve, sévérités, booléens de cohérence).
//
// Il est la raison pour laquelle l'invariance fr/en est vraie PAR CONSTRUCTION :
// un champ absent de PROSE_PATHS n'est jamais transmis au modèle de rendu, donc
// aucun changement de langue ne peut le déplacer. Le test d'invariance
// (src/test/diagnostic-locale-invariants.test.ts) doit passer trivialement ;
// s'il échoue, c'est qu'un chemin a fui d'un côté à l'autre.
//
// ⚠️ MIROIR : supabase/functions/_shared/diagnostic-prose.ts porte la même liste.
// Deno ne peut pas importer depuis src/. Toute modification ici doit y être
// reportée — le test compare les deux listes et échoue en cas de dérive.

/**
 * Chemins de PROSE dans screening_data.
 * `[]` marque un tableau : le segment suivant s'applique à chaque élément.
 * Un chemin sans segment après `[]` désigne un tableau de chaînes.
 */
export const PROSE_PATHS: readonly string[] = [
  // Synthèses
  'resume_comite',
  'resume_executif.synthese',
  'resume_executif.points_forts[]',
  'resume_executif.points_faibles[]',
  'resume_executif.potentiel_estime',

  // Identité et contexte
  'fiche_entreprise.description_activite',
  'contexte_entreprise.histoire',
  'contexte_entreprise.marche',
  'contexte_entreprise.activite',

  // Constats par axe
  'constats_par_scope.financier[].titre',
  'constats_par_scope.financier[].constat',
  'constats_par_scope.financier[].piste',
  'constats_par_scope.financier[].source',
  'constats_par_scope.commercial[].titre',
  'constats_par_scope.commercial[].constat',
  'constats_par_scope.commercial[].piste',
  'constats_par_scope.commercial[].source',
  'constats_par_scope.operationnel[].titre',
  'constats_par_scope.operationnel[].constat',
  'constats_par_scope.operationnel[].piste',
  'constats_par_scope.operationnel[].source',
  'constats_par_scope.equipe_rh[].titre',
  'constats_par_scope.equipe_rh[].constat',
  'constats_par_scope.equipe_rh[].piste',
  'constats_par_scope.equipe_rh[].source',
  'constats_par_scope.legal_conformite[].titre',
  'constats_par_scope.legal_conformite[].constat',
  'constats_par_scope.legal_conformite[].piste',
  'constats_par_scope.legal_conformite[].source',

  // Dimensions — constats, données manquantes ET libellé qualitatif.
  //
  // `.label` est passé en PROSE le 12/09. C'est une APPRÉCIATION rédigée par le
  // modèle (« En croissance », « Insuffisante »), pas une clé de schéma : laissée
  // déterministe, elle sortait en français dans un document anglais, entre deux
  // phrases anglaises. Vérifié avant de la déplacer : AUCUN site ne la compare,
  // les quatre usages l'interpolent pour l'affichage. Le `.score`, lui, reste
  // déterministe — c'est un nombre, il n'a pas de langue.
  //
  // En contrepartie le vocabulaire est VERROUILLÉ dans RENDER_DIAGNOSTIC v3 :
  // un adjectif isolé part au rendu sans contexte, donc « Fort » pourrait revenir
  // Strong, High ou Robust selon la section. Un comité lirait une gradation là où
  // il n'y a qu'une variation de traduction.
  'diagnostic_dimensions.maturite_business.label',
  'diagnostic_dimensions.capacite_financiere.label',
  'diagnostic_dimensions.potentiel_croissance.label',
  'diagnostic_dimensions.impact_social.label',
  'diagnostic_dimensions.qualite_dossier.label',
  'diagnostic_dimensions.maturite_business.constats[]',
  'diagnostic_dimensions.maturite_business.donnees_manquantes[]',
  'diagnostic_dimensions.capacite_financiere.constats[]',
  'diagnostic_dimensions.capacite_financiere.donnees_manquantes[]',
  'diagnostic_dimensions.potentiel_croissance.constats[]',
  'diagnostic_dimensions.potentiel_croissance.donnees_manquantes[]',
  'diagnostic_dimensions.impact_social.constats[]',
  'diagnostic_dimensions.impact_social.donnees_manquantes[]',
  'diagnostic_dimensions.qualite_dossier.constats[]',

  // Financier — commentaires seulement
  'indicateurs_financiers.commentaire',
  'indicateurs_financiers.source_donnees',
  'sante_financiere.health_detail',
  'sante_financiere.benchmark_comparison[].indicateur',
  'sante_financiere.benchmark_comparison[].valeur_entreprise',
  'sante_financiere.benchmark_comparison[].benchmark_secteur',
  'sante_financiere.benchmark_comparison[].source',

  // Validation croisée — les détails, pas les booléens ni les montants
  'cross_validation.ca_detail',
  'cross_validation.bilan_detail',
  'cross_validation.charges_vs_effectifs_detail',
  'cross_validation.tresorerie_detail',
  'cross_validation.dates_detail',

  // Qualité du dossier — la note et les listes, pas les compteurs
  'qualite_dossier.note_qualite',
  'qualite_dossier.couverture.finance.documents_trouves[]',
  'qualite_dossier.couverture.finance.manquants_critiques[]',
  'qualite_dossier.couverture.legal.documents_trouves[]',
  'qualite_dossier.couverture.legal.manquants_critiques[]',
  'qualite_dossier.couverture.commercial.documents_trouves[]',
  'qualite_dossier.couverture.commercial.manquants_critiques[]',
  'qualite_dossier.couverture.rh.documents_trouves[]',
  'qualite_dossier.couverture.rh.manquants_critiques[]',

  // Marché, équipe, impact, besoin
  'marche_positionnement.marche_cible',
  'marche_positionnement.taille_estimee',
  'marche_positionnement.positionnement',
  'marche_positionnement.concurrence',
  'marche_positionnement.avantage_competitif',
  'equipe_gouvernance.profil_dirigeant',
  'equipe_gouvernance.equipe_direction',
  'equipe_gouvernance.commentaire',
  'impact_mesurable.emplois_projetes',
  'impact_mesurable.beneficiaires_directs',
  'impact_mesurable.odd_potentiels[]',
  'impact_mesurable.commentaire',
  'besoin_financement.utilisation_prevue[]',
  'besoin_financement.commentaire',

  // Risques — libellés ET type. Pas la probabilité.
  //
  // `.type` est passé en PROSE le 12/09, même raisonnement que `.label` : c'est
  // un mot rédigé (« opérationnel », « réputationnel ») affiché tel quel, que
  // personne ne compare. La `probabilite`, elle, reste déterministe : elle EST
  // comparée (enumIs) pour la couleur du badge, et son habillage passe par
  // enumLabel. Les cinq types du schéma producteur sont verrouillés dans v3.
  'risques_programme[].type',
  'risques_programme[].risque',
  'risques_programme[].impact_programme',
  'risques_programme[].mitigation',

  // Traction, benchmark
  'traction.anciennete',
  'traction.evolution_ca',
  'traction.preuves_tangibles[]',
  'benchmark_declaratif.commentaire',

  // Analyse narrative
  'analyse_narrative.comparaison_sectorielle.positionnement_global',
  'analyse_narrative.comparaison_sectorielle.benchmark_detail[].indicateur',
  'analyse_narrative.comparaison_sectorielle.benchmark_detail[].valeur_entreprise',
  'analyse_narrative.comparaison_sectorielle.benchmark_detail[].mediane_secteur',
  'analyse_narrative.comparaison_sectorielle.benchmark_detail[].top_quartile',
  'analyse_narrative.comparaison_sectorielle.benchmark_detail[].bottom_quartile',
  'analyse_narrative.comparaison_sectorielle.benchmark_detail[].commentaire',
  'analyse_narrative.scenarios_prospectifs.scenario_pessimiste.description',
  'analyse_narrative.scenarios_prospectifs.scenario_base.description',
  'analyse_narrative.scenarios_prospectifs.scenario_optimiste.description',
  'analyse_narrative.verdict_analyste.synthese_pour_comite',
  'analyse_narrative.verdict_analyste.deal_breakers[]',
  'analyse_narrative.verdict_analyste.conditions_sine_qua_non[]',
  'analyse_narrative.verdict_analyste.quick_wins[]',

  // Points forts / vigilance / incohérences
  'points_forts[].titre',
  'points_forts[].detail',
  'points_forts[].impact',
  'points_vigilance[].titre',
  'points_vigilance[].detail',
  'points_vigilance[].risque',
  'points_vigilance[].mitigation',
  'incoherences_detectees[].observation',

  // Matching — libellés et explications, pas la répartition
  'matching_criteres.criteres_ok[].critere',
  'matching_criteres.criteres_ok[].detail',
  'matching_criteres.criteres_ko[].critere',
  'matching_criteres.criteres_ko[].detail',
  'matching_criteres.criteres_ko[].comment_corriger',
  'matching_criteres.criteres_partiels[].critere',
  'matching_criteres.criteres_partiels[].detail',
  'matching_criteres.criteres_partiels[].manque',

  // Recommandation — la justification, pas l'avis (qui est une énumération)
  'recommandation_accompagnement.justification',
  'recommandation_accompagnement.priorites_si_selectionnee[]',
  'recommandation_accompagnement.conditions_prealables[]',
  'recommandation_accompagnement.potentiel_6_mois',
  'recommandation_accompagnement.profil_coach_ideal',
] as const;

/**
 * Champs DÉTERMINISTES. Ne sont jamais transmis au rendu et ne changent jamais
 * avec la langue. Liste explicite : elle sert d'assertion au test d'invariance,
 * pour qu'un ajout de champ au schéma ne passe pas silencieusement du mauvais côté.
 */
export const DETERMINISTIC_PATHS: readonly string[] = [
  'score',
  'classification',
  'diagnostic_dimensions.maturite_business.score',
  'diagnostic_dimensions.capacite_financiere.score',
  'diagnostic_dimensions.potentiel_croissance.score',
  'diagnostic_dimensions.impact_social.score',
  'diagnostic_dimensions.qualite_dossier.score',
  'fiche_entreprise.anciennete_ans',
  'fiche_entreprise.ca_declare',
  'fiche_entreprise.ca_devise',
  'fiche_entreprise.effectif_declare',
  'indicateurs_financiers.ca_annuel',
  'indicateurs_financiers.croissance_ca_pct',
  'indicateurs_financiers.marge_estimee_pct',
  'indicateurs_financiers.rentabilite',
  'indicateurs_financiers.tresorerie_estimee',
  'indicateurs_financiers.niveau_endettement',
  'indicateurs_financiers.fiabilite',
  'sante_financiere.ca_estime',
  'sante_financiere.marge_brute_pct',
  'sante_financiere.marge_nette_pct',
  'sante_financiere.ratio_endettement_pct',
  'sante_financiere.tresorerie_nette',
  'sante_financiere.health_label',
  'cross_validation.ca_coherent',
  'cross_validation.ca_declared',
  'cross_validation.ca_from_documents',
  'cross_validation.ca_ecart_pct',
  'cross_validation.bilan_equilibre',
  'cross_validation.charges_vs_effectifs',
  'cross_validation.tresorerie_coherent',
  'cross_validation.dates_coherentes',
  'qualite_dossier.score_qualite',
  'qualite_dossier.total_documents',
  'qualite_dossier.documents_exploitables',
  'qualite_dossier.documents_illisibles',
  'qualite_dossier.niveau_preuve',
  'marche_positionnement.barriere_entree',
  'equipe_gouvernance.gouvernance',
  'equipe_gouvernance.key_man_risk',
  'impact_mesurable.emplois_actuels',
  'impact_mesurable.pct_femmes',
  'impact_mesurable.pct_jeunes',
  'impact_mesurable.mesurabilite',
  'besoin_financement.montant_demande',
  'besoin_financement.montant_devise',
  'besoin_financement.coherence_vs_ca',
  'besoin_financement.type_adapte',
  'besoin_financement.capacite_absorption',
  'traction.niveau_preuve',
  'benchmark_declaratif.position_vs_secteur',
  'recommandation_accompagnement.avis',
] as const;

type AnyRec = Record<string, any>;

function splitPath(path: string): string[] {
  return path.split('.');
}

/** Lit une valeur en suivant un chemin, `[]` déployant les tableaux. */
function readPath(source: any, segments: string[]): any {
  if (source === null || source === undefined) return undefined;
  if (segments.length === 0) return source;

  const [head, ...rest] = segments;
  if (head.endsWith('[]')) {
    const key = head.slice(0, -2);
    const arr = source[key];
    if (!Array.isArray(arr)) return undefined;
    // Tableau de chaînes : `foo[]` sans segment suivant.
    if (rest.length === 0) return arr.slice();
    return arr.map((item) => readPath(item, rest));
  }
  return readPath(source[head], rest);
}

/** Écrit une valeur en suivant un chemin, en créant les nœuds manquants. */
function writePath(target: AnyRec, segments: string[], value: any): void {
  if (value === undefined) return;
  const [head, ...rest] = segments;

  if (head.endsWith('[]')) {
    const key = head.slice(0, -2);
    if (!Array.isArray(value)) return;
    if (!Array.isArray(target[key])) target[key] = [];
    if (rest.length === 0) {
      target[key] = value.slice();
      return;
    }
    value.forEach((item: any, i: number) => {
      if (item === undefined) return;
      if (typeof target[key][i] !== 'object' || target[key][i] === null) target[key][i] = {};
      writePath(target[key][i], rest, item);
    });
    return;
  }

  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  if (typeof target[head] !== 'object' || target[head] === null) target[head] = {};
  writePath(target[head], rest, value);
}

/** Extrait la seule prose de screening_data. C'est ce qui part au modèle de rendu. */
export function extractProse(screeningData: AnyRec | null | undefined): AnyRec {
  const out: AnyRec = {};
  if (!screeningData) return out;
  for (const path of PROSE_PATHS) {
    const segments = splitPath(path);
    const value = readPath(screeningData, segments);
    if (value !== undefined) writePath(out, segments, value);
  }
  return out;
}

/**
 * Fusionne une prose rendue sur le diagnostic source.
 * Le déterministe vient TOUJOURS de `screeningData` : `renderedProse` ne peut
 * écraser que des chemins listés dans PROSE_PATHS. Une clé étrangère envoyée
 * par le modèle est ignorée.
 */
export function mergeProse(screeningData: AnyRec | null | undefined, renderedProse: AnyRec | null | undefined): AnyRec {
  const base: AnyRec = structuredClone(screeningData ?? {});
  if (!renderedProse) return base;
  for (const path of PROSE_PATHS) {
    const segments = splitPath(path);
    const value = readPath(renderedProse, segments);
    if (value !== undefined) writePath(base, segments, value);
  }
  return base;
}

/**
 * Diagnostic prêt à afficher pour une locale.
 * `fr` renvoie la source telle quelle : la prose française EST screening_data,
 * il n'existe pas de rendu français (ce serait une seconde vérité).
 */
export function diagnosticForLocale(
  screeningData: AnyRec | null | undefined,
  locale: string,
  render: { prose: AnyRec } | null | undefined,
): AnyRec {
  if (!screeningData) return {};
  if (locale === 'fr' || !render) return structuredClone(screeningData);
  return mergeProse(screeningData, render.prose);
}
