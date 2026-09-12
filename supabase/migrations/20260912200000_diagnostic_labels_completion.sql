-- Complément du référentiel de libellés — fermeture des défauts 2 et 3.
--
-- Le garde-fou de sortie (src/test/diagnostic-rendered-document.test.ts) mesure
-- sur le DOCUMENT PRODUIT, par différentiel fr/en, les segments qui ne changent
-- pas avec la langue sans que le référentiel l'ait décidé. Au 12/09 il en
-- comptait 44. Deux causes :
--
--   Défaut 2 — des énumérations rendues brutes. Deux familles n'existaient même
--   pas au référentiel (`stade`, `position_vs_secteur`) ; les autres existaient
--   mais le code affichait la valeur stockée au lieu d'appeler enumLabel().
--
--   Défaut 3 — des libellés français écrits en dur dans le générateur, absents
--   du référentiel. Le scan de source ne pouvait pas les voir : il ne signale
--   que ce qui DUPLIQUE une entrée existante.
--
-- Les cinq clés de dimension (`maturite_business`…) sont des clés STRUCTURELLES
-- du schéma, pas des valeurs produites par le modèle. Elles étaient imprimées
-- telles quelles (« capacite financiere »). Elles reçoivent donc un libellé
-- d'interface, comme n'importe quel nom de champ — et non une traduction par le
-- modèle, qui les rendrait instables d'un dossier à l'autre.
--
-- Idempotente : rejouable sans effet de bord.

-- ───────────────────────────────────────────────────────────────────────────
-- Familles d'énumération manquantes
-- Source autoritaire : SCREENING_SCHEMA, esono-ai-worker/api/agents/screen_candidatures.py
-- ───────────────────────────────────────────────────────────────────────────

insert into public.diagnostic_labels (key, category, fr, en, match_fr) values
  -- fiche_entreprise.stade
  ('stade.idee',       'stade', 'Idée',                 'Idea',                  'idee'),
  ('stade.demarrage',  'stade', 'Démarrage (<2 ans)',   'Start-up (<2 years)',   'demarrage (<2 ans)'),
  ('stade.croissance', 'stade', 'Croissance (2-5 ans)', 'Growth (2-5 years)',    'croissance (2-5 ans)'),
  ('stade.maturite',   'stade', 'Maturité (>5 ans)',    'Maturity (>5 years)',   'maturite (>5 ans)'),

  -- benchmark_declaratif.position_vs_secteur
  ('position.au_dessus',     'position_vs_secteur', 'Au-dessus',     'Above sector',   'au-dessus'),
  ('position.dans_la_norme', 'position_vs_secteur', 'Dans la norme', 'In line',        'dans la norme'),
  ('position.en_dessous',    'position_vs_secteur', 'En-dessous',    'Below sector',   'en-dessous'),
  ('position.non_evaluable', 'position_vs_secteur', 'Non évaluable', 'Not assessable', 'non evaluable')
on conflict (key) do update
  set category = excluded.category, fr = excluded.fr, en = excluded.en,
      match_fr = excluded.match_fr, updated_at = now();

-- ───────────────────────────────────────────────────────────────────────────
-- Libellés d'interface manquants
-- ───────────────────────────────────────────────────────────────────────────

insert into public.diagnostic_labels (key, category, fr, en) values
  -- Clés de dimension — structurelles, jamais traduites par le modèle.
  ('dimension.maturite_business',    'ui', 'Maturité business',      'Business maturity'),
  ('dimension.capacite_financiere',  'ui', 'Capacité financière',    'Financial capacity'),
  ('dimension.potentiel_croissance', 'ui', 'Potentiel de croissance','Growth potential'),
  ('dimension.impact_social',        'ui', 'Impact social',          'Social impact'),
  ('dimension.qualite_dossier',      'ui', 'Qualité du dossier',     'File quality'),

  -- Libellés de champ écrits en dur dans le générateur
  ('champ.ca',              'ui', 'CA',                 'Revenue'),
  ('champ.montant',         'ui', 'Montant',            'Amount'),
  ('champ.stade',           'ui', 'Stade',              'Stage'),
  ('champ.secteur',         'ui', 'Secteur',            'Sector'),
  ('champ.fiabilite',       'ui', 'Fiabilité',          'Reliability'),
  ('champ.barriere_entree', 'ui', 'Barrière à l''entrée','Barrier to entry'),
  ('champ.mesurabilite',    'ui', 'Mesurabilité',       'Measurability'),
  ('champ.impact_programme','ui', 'Impact programme',   'Programme impact'),
  ('champ.mitigation',      'ui', 'Mitigation',         'Mitigation'),
  ('champ.risque',          'ui', 'Risque',             'Risk'),
  ('champ.potentiel_6_mois','ui', 'Potentiel 6 mois',   '6-month potential'),
  ('champ.localisation',    'ui', 'Localisation',       'Location'),
  ('champ.statut',          'ui', 'Statut',             'Status'),
  ('champ.entreprise',      'ui', 'Entreprise',         'Company'),
  ('champ.sourcing',        'ui', 'Sourcing projet',    'Project sourcing'),

  -- Unité affichée à côté d'un nombre
  ('unite.ans',             'ui', 'ans',                'years'),

  -- Section
  ('section.recommandation','ui', 'Recommandation d''accompagnement', 'Support recommendation'),

  -- Document
  ('doc.fiche',                 'ui', 'Fiche',                'Profile'),
  ('doc.extract',               'ui', 'Extract',              'Extract'),
  ('doc.candidatures',          'ui', 'candidatures',         'applications'),
  ('doc.aucune_candidature',    'ui', 'Aucune candidature',   'No application'),
  ('doc.pied_confidentiel',     'ui', 'Généré par ESONO BIS Studio — Document confidentiel',
                                      'Generated by ESONO BIS Studio — Confidential document'),

  -- États d'absence de diagnostic
  ('etat.diagnostic_indisponible', 'ui',
     'Diagnostic IA non disponible — données non disponibles pour cette candidature.',
     'AI diagnostic unavailable — no data available for this application.'),
  ('etat.diagnostic_erreur', 'ui',
     'Diagnostic IA en erreur — données non disponibles pour cette candidature.',
     'AI diagnostic failed — no data available for this application.')
on conflict (key) do update
  set category = excluded.category, fr = excluded.fr, en = excluded.en,
      updated_at = now();
