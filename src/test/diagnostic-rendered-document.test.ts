// Garde-fou de SORTIE : les assertions portent sur le document PRODUIT, pas sur
// le code qui le produit.
//
// Pourquoi ce fichier existe, et pourquoi il ne remplace pas le scan de source.
//
// Le 11/09, trois défauts sont sortis d'un contrôle sur document rendu alors que
// le scan de source (diagnostic-hardcoded-french.test.ts) était vert :
//
//   1. Onze `{L.label('…')}` écrits SANS le `$`. Le gabarit s'imprimait
//      littéralement dans le document — en français comme en anglais. Le scan ne
//      pouvait pas le voir : la chaîne fautive n'est pas française, et sa regex
//      de texte JSX exclut explicitement les accolades.
//   2. Des énumérations rendues brutes, sans passer par le référentiel. Ce sont
//      des VALEURS D'EXÉCUTION, absentes du source par construction.
//   3. Des libellés français en dur absents du référentiel. Le scan ne signale
//      que ce qui duplique une entrée du référentiel ; ce qui n'y figure pas lui
//      est invisible.
//
// Ces trois classes échappent à un scan statique par construction, pas par
// oubli. Un contrôle qui lit le code ne peut pas établir ce que le lecteur
// recevra. Les deux contrôles sont complémentaires : le scan attrape la dérive
// à l'écriture, celui-ci attrape ce que l'écriture ne dit pas.
//
// Portée actuelle : la classe « gabarit non interpolé ». Les assertions sur les
// énumérations non traduites et les libellés français résiduels (défauts 2 et 3,
// ouverts) viendront ici même — c'est l'endroit qui les aurait vus.

import { describe, it, expect, vi } from 'vitest';

// Stub de module, pas capture de rejection.
//
// Le référentiel n'est PAS résolu par le builder : il lui est injecté par
// `__setRenderContext(locale, rows)`. Ce stub ne sert donc pas à fournir des
// libellés — le test n'en a pas besoin.
//
// Ce qu'il compense est un couplage de MODULE : `buildHtml` partage son fichier
// avec `resolveDiagnostics` et les quatre points d'entrée d'export, qui importent
// le client Supabase. Importer le builder pur construit donc le client, qui
// démarre son auto-refresh sous jsdom et laisse une rejection non gérée — vitest
// signale alors un risque de faux positif sur TOUTE la suite, ce qu'un garde-fou
// ne doit surtout pas causer.
//
// Le découplage réel est de sortir les fonctions pures dans leur propre module,
// avec l'état de rendu qu'elles portent. Ce n'est pas une modification mécanique
// et ce n'est pas le sujet de ce commit : c'est consigné dans les points ouverts
// du brief. En attendant, ce stub est aligné sur export-single-candidature.test,
// qui fait déjà exactement la même chose pour la même raison.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null as any } }) } },
}));

import {
  buildSingleHtml,
  buildHtml,
  __setRenderContext,
} from '@/lib/export-candidature-report-pdf';
import { seedLabelRows } from './helpers/label-seed';

/** Dossier de synthèse : chaque bloc du document doit être atteint, sinon
 *  l'assertion ne prouve rien sur les blocs non rendus. */
const DOSSIER = {
  id: 'doc-1',
  company_name: 'Société Témoin',
  status: 'pre_selected',
  screening_score: 61,
  secteur: 'Agro-industrie',
  screening_data: {
    score_global: 61,
    classification: 'POTENTIEL',
    fiche_entreprise: { nom: 'Société Témoin', pays: 'Ghana', secteur: 'Agro-industrie', anciennete_annees: 10, effectif: 55 },
    resume_executif: 'Synthèse.',
    indicateurs_financiers: {
      fiabilite: 'faible', ca_annuel: 1234567, croissance_ca_pct: 12, marge_estimee_pct: 30,
      rentabilite: 'non_evaluable', tresorerie_estimee: 'tendue', niveau_endettement: 'modere',
      commentaire: 'Commentaire.', source_donnees: 'Déclaratif',
    },
    marche_positionnement: { marche_cible: 'Riz', taille_estimee: 'Grande', positionnement: 'Transformateur', concurrence: 'Fragmentée', avantage_concurrentiel: 'Intégration' },
    equipe_gouvernance: { dirigeant: 'Dirigeant', equipe: 'Équipe', key_man_risk: true },
    impact_mesurable: { beneficiaires: '55', emplois_actuels: 55, femmes: 10, jeunes: 20, mesurabilite: 'moyenne' },
    besoin_financement: { montant: 150000, type_adapte: 'mixte', utilisation_prevue: ['Fonds de roulement', 'Équipement'] },
    traction: { anciennete_annees: 10, evolution_ca: 'Stable', preuves_tangibles: ['Site web', 'Registre'] },
    benchmark_declaratif: { positionnement_global: 'Au-dessus de la médiane' },
    matching_criteres: { valides: ['Critère A'], partiels: ['Critère B'], non_remplis: ['Critère C'] },
    points_forts: [{ titre: 'Force', explication: 'Explication.' }],
    points_vigilance: [{ titre: 'Vigilance', explication: 'Explication.', mitigation: 'Mitigation.' }],
    incoherences_detectees: [{ severite: 'BLOQUANT', observation: 'Observation.' }],
    risques_programme: [{ risque: 'Risque', impact: 'Impact', mitigation: 'Mitigation', probabilite: 'moyenne' }],
    recommandation_accompagnement: {
      avis: 'A_APPROFONDIR',
      justification: 'Justification.',
      priorites_si_selectionnee: ['Priorité 1'],
      conditions_prealables: ['Condition 1'],
      potentiel_6_mois: 'Potentiel.',
      profil_coach_ideal: 'Profil.',
    },
    dimensions_diagnostiques: { maturite: { note: 3, constat: 'Constat.' } },
    qualite_dossier: { niveau_preuve: 'declaratif_uniquement', note_qualite: 'Note.' },
  },
};

/** Gabarit resté littéral dans la sortie : `{L.label('x')}`, `{esc(y)}`, `{x}`. */
const GABARIT_NON_INTERPOLE = /\{[A-Za-z_$][\w$]*(?:\.[\w$]+)*\([^{}]*\)\}/g;

describe('document rendu — aucun gabarit non interpolé', () => {
  for (const locale of ['fr', 'en'] as const) {
    it(`extract solo (${locale})`, () => {
      __setRenderContext(locale, seedLabelRows());
      const html = buildSingleHtml(DOSSIER, 'Programme Témoin');
      const fuites = [...new Set(html.match(GABARIT_NON_INTERPOLE) ?? [])];
      expect(fuites, `gabarits imprimés tels quels : ${fuites.join(' | ')}`).toEqual([]);
    });

    it(`reporting multi-dossiers (${locale})`, () => {
      __setRenderContext(locale, seedLabelRows());
      const html = buildHtml([DOSSIER], 'Programme Témoin');
      const fuites = [...new Set(html.match(GABARIT_NON_INTERPOLE) ?? [])];
      expect(fuites, `gabarits imprimés tels quels : ${fuites.join(' | ')}`).toEqual([]);
    });
  }

  it('le détecteur attrape bien un gabarit oublié', () => {
    // Sans cette contre-épreuve, un détecteur cassé rendrait les assertions
    // ci-dessus vertes en permanence — c'est exactement le mode de défaillance
    // qu'on cherche à éviter.
    const faux = `<span class="score-lbl">{L.label('champ.score_ia')}</span>`;
    expect(faux.match(GABARIT_NON_INTERPOLE)).toEqual([`{L.label('champ.score_ia')}`]);
  });
});
