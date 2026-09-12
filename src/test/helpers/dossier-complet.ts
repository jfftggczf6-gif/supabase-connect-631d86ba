// Dossier de référence du garde-fou de sortie — MAXIMAL, pas minimal.
//
// Le dossier précédent portait des noms de champs que le schéma producteur
// n'émet pas (`dimensions_diagnostiques`, `matching_criteres.valides`,
// `besoin_financement.montant`, des énumérations en snake_case). Résultat
// mesuré : quatre blocs du document ne sortaient pas du tout, donc aucune
// assertion ne portait sur eux. Un garde-fou qui n'atteint pas un bloc ne dit
// rien de ce bloc — il dit seulement qu'il ne l'a pas regardé.
//
// Celui-ci est aligné sur la source autoritaire : SCREENING_SCHEMA dans
// esono-ai-worker/api/agents/screen_candidatures.py. Il porte au moins une
// valeur par bloc et au moins une valeur par famille d'énumération.
//
// ⚠️ TOUTE LA PROSE EST EN ANGLAIS NEUTRE, volontairement. C'est ce qui rend le
// comptage mécanique : dans le document rendu en `en`, tout mot français
// restant vient du CODE, jamais de la donnée.

/** Valeurs d'énumération telles que le modèle les STOCKE (en français). */
export const ENUMS_STOCKES: Record<string, string> = {
  classification: 'POTENTIEL',
  stade: 'Croissance (2-5 ans)',
  fiabilite: 'Élevée',
  rentabilite: 'Rentable',
  tresorerie: 'Tendue',
  endettement: 'Modéré',
  sante: 'Fragile',
  coherence_vs_ca: 'Cohérent',
  type_adapte: 'Prêt',
  absorption: 'Bonne',
  niveau_preuve: 'Partiel',
  niveau_preuve_dossier: 'N2 Intermediaire',
  severite: 'ATTENTION',
  probabilite: 'moyenne',
  avis: 'FAVORABLE SOUS RÉSERVE',
  gouvernance: 'Basique',
  barriere_entree: 'Modérée',
  mesurabilite: 'Forte',
  statut_candidature: 'in_review',
};

/**
 * Énumérations STOCKÉES et RÉFÉRENCÉES, mais qu'aucun bloc du document n'affiche.
 *
 * Elles sont listées ici, avec leur raison, plutôt que retirées du dossier : un
 * garde-fou qui écarte silencieusement ce qu'il n'atteint pas finit par ne rien
 * prouver. Le garde-fou vérifie que ces valeurs sont bien ABSENTES des deux
 * documents. Le jour où un bloc les rend, l'assertion tombe et force à les
 * déplacer du bon côté — c'est le mécanisme qui empêche la couverture vide.
 */
export const ENUMS_NON_RENDUS: Record<string, string> = {
  sante: 'sante_financiere.health_label — produit par le screening, aucun bloc du document ne le rend',
  niveau_preuve_dossier: 'qualite_dossier.niveau_preuve — le document n\'a pas de bloc « qualité du dossier »',
};

/** Valeurs de données libres du dossier : ni libellés, ni énumérations. */
export const DONNEES_LIBRES = [
  'NEUTRAL TRADING LTD', 'Neutral Programme', 'Agrifood', 'Ghana', 'Accra', 'XOF',
  'A. Mensah', 'a.mensah@example.com', '+233 20 000 0000', 'SDG 8', 'SDG 5',
];

export function screeningDataComplet(): Record<string, any> {
  return {
    score: 62,
    classification: ENUMS_STOCKES.classification,
    resume_comite: 'Neutral committee summary over three documented years.',

    resume_executif: {
      synthese: 'Neutral executive summary.',
      points_forts: ['First strength', 'Second strength'],
      points_faibles: ['First weakness'],
      potentiel_estime: 'Neutral estimated potential.',
    },

    fiche_entreprise: {
      stade: ENUMS_STOCKES.stade,
      anciennete_ans: 4,
      ca_declare: 22289209,
      ca_devise: 'XOF',
      effectif_declare: 18,
      secteur_activite: 'Agrifood',
      pays: 'Ghana',
      ville: 'Accra',
      description_activite: 'Neutral activity description.',
    },

    diagnostic_dimensions: {
      maturite_business:    { score: 64, label: 'En croissance', constats: ['Neutral finding.'], donnees_manquantes: ['Neutral gap.'] },
      capacite_financiere:  { score: 55, label: 'Insuffisante',  constats: ['Neutral finding.'], donnees_manquantes: [] },
      potentiel_croissance: { score: 71, label: 'Fort',          constats: ['Neutral finding.'], donnees_manquantes: [] },
      impact_social:        { score: 68, label: 'Significatif',  constats: ['Neutral finding.'], donnees_manquantes: [] },
      qualite_dossier:      { score: 49, label: 'Insuffisant',   constats: ['Neutral finding.'] },
    },

    indicateurs_financiers: {
      ca_annuel: 22289209, croissance_ca_pct: 84.39, marge_estimee_pct: 21.4,
      rentabilite: ENUMS_STOCKES.rentabilite,
      tresorerie_estimee: ENUMS_STOCKES.tresorerie,
      niveau_endettement: ENUMS_STOCKES.endettement,
      fiabilite: ENUMS_STOCKES.fiabilite,
      source_donnees: 'Neutral data source.',
      commentaire: 'Neutral comment.',
    },

    sante_financiere: { health_label: ENUMS_STOCKES.sante, health_detail: 'Neutral health detail.' },

    marche_positionnement: {
      barriere_entree: ENUMS_STOCKES.barriere_entree,
      marche_cible: 'Neutral target market.', taille_estimee: 'Neutral market size.',
      positionnement: 'Neutral positioning.', concurrence: 'Neutral competition.',
      avantage_competitif: 'Neutral competitive advantage.',
    },

    equipe_gouvernance: {
      gouvernance: ENUMS_STOCKES.gouvernance, key_man_risk: true,
      profil_dirigeant: 'Neutral founder profile.', equipe_direction: 'Neutral management team.',
      commentaire: 'Neutral comment.',
    },

    impact_mesurable: {
      mesurabilite: ENUMS_STOCKES.mesurabilite,
      emplois_actuels: 18, pct_femmes: 40, pct_jeunes: 55,
      emplois_projetes: 'Neutral job projection.', beneficiaires_directs: 'Neutral direct beneficiaries.',
      odd_potentiels: ['SDG 8', 'SDG 5'], commentaire: 'Neutral comment.',
    },

    besoin_financement: {
      montant_demande: 15000000, montant_devise: 'XOF',
      type_adapte: ENUMS_STOCKES.type_adapte,
      coherence_vs_ca: ENUMS_STOCKES.coherence_vs_ca,
      capacite_absorption: ENUMS_STOCKES.absorption,
      utilisation_prevue: ['First planned use', 'Second planned use'],
      commentaire: 'Neutral comment.',
    },

    risques_programme: [
      { risque: 'First neutral risk.',  type: 'opérationnel', probabilite: ENUMS_STOCKES.probabilite,
        impact_programme: 'Neutral programme impact.', mitigation: 'Neutral mitigation.' },
      { risque: 'Second neutral risk.', type: 'financier',    probabilite: 'faible',
        impact_programme: 'Neutral programme impact.', mitigation: 'Neutral mitigation.' },
    ],

    traction: {
      niveau_preuve: ENUMS_STOCKES.niveau_preuve,
      anciennete: 'Neutral age statement.', evolution_ca: 'Neutral revenue trend.',
      preuves_tangibles: ['First evidence', 'Second evidence'],
    },

    benchmark_declaratif: { position_vs_secteur: 'Au-dessus', commentaire: 'Neutral benchmark comment.' },

    qualite_dossier: {
      score_qualite: 49, total_documents: 8, documents_exploitables: 7, documents_illisibles: 1,
      niveau_preuve: ENUMS_STOCKES.niveau_preuve_dossier,
      note_qualite: 'Eight documents received, seven usable.',
    },

    matching_criteres: {
      criteres_ok:       [{ critere: 'First met criterion', detail: 'Neutral detail.' }],
      criteres_partiels: [{ critere: 'Partially met criterion', detail: 'Neutral detail.', manque: 'Neutral gap.' }],
      criteres_ko:       [{ critere: 'Unmet criterion', detail: 'Neutral detail.', comment_corriger: 'Neutral fix.' }],
    },

    points_forts:     [{ titre: 'First strength', detail: 'Neutral detail.', impact: 'Neutral impact.' }],
    points_vigilance: [{ titre: 'First attention point', detail: 'Neutral detail.', risque: 'Neutral risk.', mitigation: 'Neutral mitigation.' }],
    incoherences_detectees: [{ severite: ENUMS_STOCKES.severite, observation: 'Neutral observation.' }],

    recommandation_accompagnement: {
      avis: ENUMS_STOCKES.avis,
      justification: 'Neutral justification.',
      priorites_si_selectionnee: ['First priority', 'Second priority'],
      conditions_prealables: ['First precondition'],
      potentiel_6_mois: 'Neutral six-month potential.',
      profil_coach_ideal: 'Neutral ideal coach profile.',
    },
  };
}

export function candidatureComplete(): Record<string, any> {
  return {
    id: 'dossier-complet',
    company_name: 'NEUTRAL TRADING LTD',
    screening_score: 62,
    status: ENUMS_STOCKES.statut_candidature,
    contact_name: 'A. Mensah',
    contact_email: 'a.mensah@example.com',
    contact_phone: '+233 20 000 0000',
    screening_data: screeningDataComplet(),
    form_data: { secteur: 'Agrifood', ville: 'Accra', pays: 'Ghana', effectif: 18 },
  };
}

// ── Ce que le modèle de rendu renvoie ───────────────────────────────────────
//
// Le document anglais n'est PAS construit depuis screening_data : il est
// construit depuis screening_data fusionné avec la prose rendue, exactement
// comme en production (diagnosticForLocale). Le garde-fou doit donc recevoir
// une prose anglaise, sinon il testerait un chemin qui n'existe pas.

import { extractProse } from '@/lib/diagnostic-prose';

/**
 * Traductions VERROUILLÉES par le bloc de terminologie de RENDER_DIAGNOSTIC v3.
 * Elles sont ici pour que le test échoue si le prompt et le test divergent :
 * `diagnostic-prompt-terminologie.test.ts` compare les deux listes.
 */
export const VOCABULAIRE_VERROUILLE: Record<string, string> = {
  // diagnostic_dimensions[].label — appréciations rédigées par le modèle
  'Mature': 'Mature',
  'En croissance': 'Growing',
  'Démarrage': 'Early-stage',
  'Pré-démarrage': 'Pre-launch',
  'Solide': 'Solid',
  'Correcte': 'Adequate',
  'Fragile': 'Fragile',
  'Insuffisante': 'Insufficient',
  'Insuffisant': 'Insufficient',
  'Fort': 'Strong',
  'Forte': 'Strong',
  'Modéré': 'Moderate',
  'Modérée': 'Moderate',
  'Limité': 'Limited',
  'Limitée': 'Limited',
  'Significatif': 'Significant',
  'Significative': 'Significant',
  'Faible': 'Low',
  'Non évaluable': 'Not assessable',
  'Excellent': 'Excellent',
  'Bon': 'Good',
  'Moyen': 'Average',
  // risques_programme[].type — les cinq du schéma producteur
  'financier': 'financial',
  'opérationnel': 'operational',
  'réputationnel': 'reputational',
  'exécution': 'execution',
  'concentration': 'concentration',
};

/** Prose anglaise du dossier : la sortie attendue du modèle de rendu. */
export function proseEnComplet(): Record<string, any> {
  const prose: any = extractProse(screeningDataComplet());

  // Classe C — champs passés en prose le 12/09, vocabulaire verrouillé.
  for (const cle of Object.keys(prose.diagnostic_dimensions ?? {})) {
    const fr = prose.diagnostic_dimensions[cle]?.label;
    if (fr) prose.diagnostic_dimensions[cle].label = VOCABULAIRE_VERROUILLE[fr] ?? fr;
  }
  for (const r of prose.risques_programme ?? []) {
    if (r?.type) r.type = VOCABULAIRE_VERROUILLE[r.type] ?? r.type;
  }

  return prose;
}

/** Toutes les valeurs de chaîne du dossier — sert à distinguer donnée et libellé. */
export function valeursDonnees(...objets: unknown[]): Set<string> {
  const out = new Set<string>();
  const visiter = (v: unknown): void => {
    if (typeof v === 'string') { const t = v.trim(); if (t) out.add(t); return; }
    if (Array.isArray(v)) { v.forEach(visiter); return; }
    if (v && typeof v === 'object') { Object.values(v).forEach(visiter); }
  };
  objets.forEach(visiter);
  return out;
}
