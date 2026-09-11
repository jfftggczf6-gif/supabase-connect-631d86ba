-- Référentiel de libellés du diagnostic de candidature — clé / fr / en.
--
-- Pourquoi une table et pas les JSON i18n du front : ces libellés recouvrent DEUX
-- populations que le front seul ne peut pas réconcilier.
--   1. Les libellés d'interface (titres de section, noms de champs) — traduisibles
--      comme n'importe quel texte d'écran.
--   2. Les VALEURS D'ÉNUMÉRATION produites par le modèle et STOCKÉES EN FRANÇAIS
--      dans candidatures.screening_data ('Élevée', 'Déficitaire', 'Cohérent'…).
--      Celles-là ne sont pas du texte d'écran : ce sont des données. Les traduire
--      dans le JSON du front reviendrait à dupliquer une correspondance qui doit
--      aussi servir au générateur PDF/Word, lequel ne charge pas i18next.
--
-- INVARIANT : cette table ne sert QU'À L'AFFICHAGE. Les comparaisons de code
-- continuent de porter sur les chaînes françaises stockées (cf. normalizeEnum
-- côté front). Aucune traduction ne remonte jamais dans screening_data.
--
-- RLS : lecture pour tout utilisateur authentifié (référentiel non sensible, aucune
-- donnée de candidature). Écriture réservée aux super_admin — c'est un référentiel
-- produit, pas une donnée d'organisation, donc pas de cloisonnement par org.

create table public.diagnostic_labels (
  key        text primary key,
  category   text not null,
  fr         text not null,
  en         text not null,
  -- Valeur française telle que le modèle l'écrit dans screening_data, NORMALISÉE
  -- (minuscules, sans accent, sans espaces de bord). Null pour les libellés
  -- d'interface, qui ne correspondent à aucune valeur stockée.
  match_fr   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.diagnostic_labels is
  'Référentiel clé/fr/en du diagnostic de candidature. Sert UNIQUEMENT à l''affichage (viewer + export PDF/Word). Les comparaisons de code portent sur les chaînes françaises stockées dans screening_data, jamais sur ces libellés.';
comment on column public.diagnostic_labels.category is
  'Famille : ''ui'' pour un libellé d''interface, sinon le nom de l''énumération (fiabilite, rentabilite, endettement, coherence_vs_ca, niveau_preuve, severite, classification, avis, statut_candidature…).';
comment on column public.diagnostic_labels.match_fr is
  'Valeur française normalisée (lower + sans accent + trim) telle qu''écrite par le modèle dans screening_data. Clé de rapprochement donnée → libellé. Null pour category=''ui''.';

-- Une valeur stockée ne doit pouvoir correspondre qu'à un seul libellé par famille,
-- sinon l'affichage devient non déterministe.
create unique index diagnostic_labels_match_uniq
  on public.diagnostic_labels (category, match_fr)
  where match_fr is not null;

create index diagnostic_labels_category_idx on public.diagnostic_labels (category);

-- Note RLS : auth.uid() est enveloppé dans (select …) pour n'être évalué qu'une
-- fois par requête au lieu d'une fois par ligne (règle Supabase security-rls-
-- performance). Les migrations antérieures du dépôt l'appellent nu ; on ne les
-- reprend pas ici, mais on ne propage pas le défaut.

alter table public.diagnostic_labels enable row level security;

create policy "diagnostic_labels_read_authenticated"
  on public.diagnostic_labels for select
  to authenticated
  using (true);

create policy "diagnostic_labels_write_super_admin"
  on public.diagnostic_labels for all
  to authenticated
  using (public.has_role((select auth.uid()), 'super_admin'))
  with check (public.has_role((select auth.uid()), 'super_admin'));

-- ───────────────────────────────────────────────────────────────────────────
-- Valeurs d'énumération produites par le modèle
-- Source : SCREENING_SCHEMA (esono-ai-worker/api/agents/screen_candidatures.py)
-- ───────────────────────────────────────────────────────────────────────────

insert into public.diagnostic_labels (key, category, fr, en, match_fr) values
  -- classification
  ('classification.eligible',    'classification', 'ÉLIGIBLE',   'ELIGIBLE',    'eligible'),
  ('classification.potentiel',   'classification', 'POTENTIEL',  'POTENTIAL',   'potentiel'),
  ('classification.hors_cible',  'classification', 'HORS_CIBLE', 'OUT_OF_SCOPE','hors_cible'),

  -- indicateurs_financiers.fiabilite
  ('fiabilite.elevee',  'fiabilite', 'Élevée',  'High',   'elevee'),
  ('fiabilite.moyenne', 'fiabilite', 'Moyenne', 'Medium', 'moyenne'),
  ('fiabilite.faible',  'fiabilite', 'Faible',  'Low',    'faible'),

  -- indicateurs_financiers.rentabilite
  ('rentabilite.rentable',       'rentabilite', 'Rentable',       'Profitable',   'rentable'),
  ('rentabilite.point_mort',     'rentabilite', 'Point mort',     'Break-even',   'point mort'),
  ('rentabilite.deficitaire',    'rentabilite', 'Déficitaire',    'Loss-making',  'deficitaire'),
  ('rentabilite.non_evaluable',  'rentabilite', 'Non évaluable',  'Not assessable','non evaluable'),

  -- indicateurs_financiers.tresorerie_estimee
  ('tresorerie.confortable',    'tresorerie', 'Confortable',   'Comfortable',    'confortable'),
  ('tresorerie.tendue',         'tresorerie', 'Tendue',        'Tight',          'tendue'),
  ('tresorerie.critique',       'tresorerie', 'Critique',      'Critical',       'critique'),
  ('tresorerie.non_evaluable',  'tresorerie', 'Non évaluable', 'Not assessable', 'non evaluable'),

  -- indicateurs_financiers.niveau_endettement
  ('endettement.faible',        'endettement', 'Faible',        'Low',            'faible'),
  ('endettement.modere',        'endettement', 'Modéré',        'Moderate',       'modere'),
  ('endettement.eleve',         'endettement', 'Élevé',         'High',           'eleve'),
  ('endettement.non_evaluable', 'endettement', 'Non évaluable', 'Not assessable', 'non evaluable'),

  -- sante_financiere.health_label
  ('sante.saine',          'sante', 'Saine',          'Healthy',        'saine'),
  ('sante.fragile',        'sante', 'Fragile',        'Fragile',        'fragile'),
  ('sante.critique',       'sante', 'Critique',       'Critical',       'critique'),
  ('sante.non_evaluable',  'sante', 'Non evaluable',  'Not assessable', 'non evaluable'),

  -- besoin_financement.coherence_vs_ca
  ('coherence.coherent',           'coherence_vs_ca', 'Cohérent',              'Consistent',            'coherent'),
  ('coherence.eleve_vs_ca',        'coherence_vs_ca', 'Élevé vs CA',           'High vs revenue',       'eleve vs ca'),
  ('coherence.faible_vs_ambition', 'coherence_vs_ca', 'Faible vs ambition',    'Low vs ambition',       'faible vs ambition'),
  ('coherence.non_evaluable',      'coherence_vs_ca', 'Non évaluable',         'Not assessable',        'non evaluable'),

  -- besoin_financement.type_adapte
  ('type_finct.subvention', 'type_adapte', 'Subvention', 'Grant',  'subvention'),
  ('type_finct.pret',       'type_adapte', 'Prêt',       'Loan',   'pret'),
  ('type_finct.mixte',      'type_adapte', 'Mixte',      'Blended','mixte'),
  ('type_finct.equity',     'type_adapte', 'Equity',     'Equity', 'equity'),

  -- besoin_financement.capacite_absorption
  ('absorption.bonne',         'absorption', 'Bonne',         'Good',           'bonne'),
  ('absorption.moyenne',       'absorption', 'Moyenne',       'Medium',         'moyenne'),
  ('absorption.faible',        'absorption', 'Faible',        'Low',            'faible'),
  ('absorption.non_evaluable', 'absorption', 'Non évaluable', 'Not assessable', 'non evaluable'),

  -- traction.niveau_preuve
  ('preuve.solide',                'niveau_preuve', 'Solide',                 'Solid',          'solide'),
  ('preuve.partiel',               'niveau_preuve', 'Partiel',                'Partial',        'partiel'),
  ('preuve.declaratif_uniquement', 'niveau_preuve', 'Déclaratif uniquement',  'Self-reported only', 'declaratif uniquement'),

  -- qualite_dossier.niveau_preuve
  ('preuve_dossier.n0', 'niveau_preuve_dossier', 'N0 Declaratif',    'N0 Self-reported', 'n0 declaratif'),
  ('preuve_dossier.n1', 'niveau_preuve_dossier', 'N1 Faible',        'N1 Weak',          'n1 faible'),
  ('preuve_dossier.n2', 'niveau_preuve_dossier', 'N2 Intermediaire', 'N2 Intermediate',  'n2 intermediaire'),
  ('preuve_dossier.n3', 'niveau_preuve_dossier', 'N3 Solide',        'N3 Solid',         'n3 solide'),

  -- incoherences_detectees[].severite
  ('severite.info',     'severite', 'INFO',      'INFO',     'info'),
  ('severite.attention','severite', 'ATTENTION', 'WARNING',  'attention'),
  ('severite.bloquant', 'severite', 'BLOQUANT',  'BLOCKING', 'bloquant'),

  -- constats_par_scope[].severite
  ('constat.urgent',   'severite_constat', 'urgent',   'urgent',   'urgent'),
  ('constat.attention','severite_constat', 'attention','warning',  'attention'),
  ('constat.positif',  'severite_constat', 'positif',  'positive', 'positif'),

  -- risques_programme[].probabilite
  ('proba.faible',  'probabilite', 'faible',  'low',    'faible'),
  ('proba.moyenne', 'probabilite', 'moyenne', 'medium', 'moyenne'),
  ('proba.elevee',  'probabilite', 'élevée',  'high',   'elevee'),

  -- recommandation_accompagnement.avis
  ('avis.favorable',          'avis', 'FAVORABLE',                'FAVOURABLE',            'favorable'),
  ('avis.favorable_reserve',  'avis', 'FAVORABLE SOUS RÉSERVE',   'FAVOURABLE WITH CONDITIONS', 'favorable sous reserve'),
  ('avis.a_approfondir',      'avis', 'À APPROFONDIR',            'NEEDS FURTHER REVIEW',  'a approfondir'),
  ('avis.defavorable',        'avis', 'DÉFAVORABLE',              'UNFAVOURABLE',          'defavorable'),

  -- equipe_gouvernance.gouvernance
  ('gouvernance.formelle',      'gouvernance', 'Formelle',      'Formal',         'formelle'),
  ('gouvernance.basique',       'gouvernance', 'Basique',       'Basic',          'basique'),
  ('gouvernance.inexistante',   'gouvernance', 'Inexistante',   'None',           'inexistante'),
  ('gouvernance.non_evaluable', 'gouvernance', 'Non évaluable', 'Not assessable', 'non evaluable'),

  -- marche_positionnement.barriere_entree
  ('barriere.faible', 'barriere_entree', 'Faible',  'Low',      'faible'),
  ('barriere.moderee','barriere_entree', 'Modérée', 'Moderate', 'moderee'),
  ('barriere.forte',  'barriere_entree', 'Forte',   'High',     'forte'),

  -- impact_mesurable.mesurabilite
  ('mesurabilite.forte',   'mesurabilite', 'Forte',   'Strong', 'forte'),
  ('mesurabilite.moyenne', 'mesurabilite', 'Moyenne', 'Medium', 'moyenne'),
  ('mesurabilite.faible',  'mesurabilite', 'Faible',  'Low',    'faible'),

  -- statuts de candidature (colonne candidatures.status, valeurs déjà en anglais)
  ('statut.received',      'statut_candidature', 'Reçue',             'Received',     'received'),
  ('statut.in_review',     'statut_candidature', 'En revue',          'In review',    'in_review'),
  ('statut.pre_selected',  'statut_candidature', 'Pré-sélectionnée',  'Shortlisted',  'pre_selected'),
  ('statut.selected',      'statut_candidature', 'Sélectionnée',      'Selected',     'selected'),
  ('statut.rejected',      'statut_candidature', 'Rejetée',           'Rejected',     'rejected'),
  ('statut.waitlisted',    'statut_candidature', 'Liste d''attente',  'Waitlisted',   'waitlisted');

-- ───────────────────────────────────────────────────────────────────────────
-- Libellés d'interface — viewer de candidature ET générateur PDF/Word
-- (les deux consomment la même source, pour qu'un écran et son extract ne
--  puissent pas diverger)
-- ───────────────────────────────────────────────────────────────────────────

insert into public.diagnostic_labels (key, category, fr, en) values
  -- Titres de document / de page
  ('doc.reporting_titre',   'ui', 'Reporting de candidatures',  'Application report'),
  ('doc.extract_titre',     'ui', 'Extract candidature',        'Application extract'),
  ('doc.candidature',       'ui', 'Candidature',                'Application'),
  ('doc.programme',         'ui', 'Programme',                  'Programme'),

  -- Titres de section
  ('section.fiche',         'ui', 'Fiche entreprise',            'Company profile'),
  ('section.dimensions',    'ui', 'Dimensions diagnostiques',    'Diagnostic dimensions'),
  ('section.indicateurs',   'ui', 'Indicateurs financiers',      'Financial indicators'),
  ('section.marche',        'ui', 'Marché & positionnement',     'Market & positioning'),
  ('section.equipe',        'ui', 'Équipe & gouvernance',        'Team & governance'),
  ('section.impact',        'ui', 'Impact mesurable',            'Measurable impact'),
  ('section.besoin',        'ui', 'Besoin de financement',       'Funding need'),
  ('section.risques',       'ui', 'Risques programme',           'Programme risks'),
  ('section.traction',      'ui', 'Traction & preuves',          'Traction & evidence'),
  ('section.benchmark',     'ui', 'Benchmark sectoriel',         'Sector benchmark'),
  ('section.matching',      'ui', 'Matching critères programme', 'Programme criteria match'),
  ('section.points_forts',  'ui', 'Points forts',                'Strengths'),
  ('section.vigilance',     'ui', 'Points de vigilance',         'Points of attention'),
  ('section.incoherences',  'ui', 'Incohérences détectées',      'Detected inconsistencies'),
  ('section.synthese',      'ui', 'Synthèse',                    'Summary'),
  ('section.resume_comite', 'ui', 'Résumé pour le comité',       'Committee summary'),

  -- Libellés de champ
  ('champ.nom',             'ui', 'Nom',              'Name'),
  ('champ.pays',            'ui', 'Pays',             'Country'),
  ('champ.contact',         'ui', 'Contact',          'Contact'),
  ('champ.email',           'ui', 'Email',            'Email'),
  ('champ.tel',             'ui', 'Tél',              'Phone'),
  ('champ.anciennete',      'ui', 'Ancienneté',       'Age'),
  ('champ.effectif',        'ui', 'Effectif',         'Headcount'),
  ('champ.employes',        'ui', 'Employés',         'Employees'),
  ('champ.taille',          'ui', 'Taille',           'Size'),
  ('champ.ca_annuel',       'ui', 'CA annuel',        'Annual revenue'),
  ('champ.croissance',      'ui', 'Croissance',       'Growth'),
  ('champ.marge',           'ui', 'Marge',            'Margin'),
  ('champ.rentabilite',     'ui', 'Rentabilité',      'Profitability'),
  ('champ.tresorerie',      'ui', 'Trésorerie',       'Cash position'),
  ('champ.endettement',     'ui', 'Endettement',      'Leverage'),
  ('champ.marche',          'ui', 'Marché',           'Market'),
  ('champ.positionnement',  'ui', 'Positionnement',   'Positioning'),
  ('champ.concurrence',     'ui', 'Concurrence',      'Competition'),
  ('champ.avantage',        'ui', 'Avantage',         'Advantage'),
  ('champ.equipe',          'ui', 'Équipe',           'Team'),
  ('champ.dirigeant',       'ui', 'Dirigeant',        'Founder / CEO'),
  ('champ.key_man_risk',    'ui', 'Key-man risk',     'Key-man risk'),
  ('champ.emplois_actuels', 'ui', 'Emplois actuels',  'Current jobs'),
  ('champ.femmes',          'ui', 'Femmes',           'Women'),
  ('champ.jeunes',          'ui', 'Jeunes',           'Youth'),
  ('champ.beneficiaires',   'ui', 'Bénéficiaires',    'Beneficiaries'),
  ('champ.absorption',      'ui', 'Absorption',       'Absorption capacity'),
  ('champ.type_adapte',     'ui', 'Type adapté',      'Suitable instrument'),
  ('champ.vs_ca',           'ui', 'vs CA',            'vs revenue'),
  ('champ.evolution_ca',    'ui', 'Évolution CA',     'Revenue trend'),
  ('champ.projection',      'ui', 'Projection',       'Projection'),
  ('champ.preuves',         'ui', 'Preuves',          'Evidence'),
  ('champ.score_ia',        'ui', 'Score IA',         'AI score'),
  ('champ.documents',       'ui', 'Documents',        'Documents'),

  -- Matching
  ('matching.valides',      'ui', 'Validés',      'Met'),
  ('matching.partiels',     'ui', 'Partiels',     'Partially met'),
  ('matching.non_remplis',  'ui', 'Non remplis',  'Not met'),

  -- Repli / états
  ('etat.non_renseigne',    'ui', 'Non renseigné',        'Not provided'),
  ('etat.donnees_decl',     'ui', 'Données déclaratives', 'Self-reported data'),
  ('champ.utilisation',       'ui', 'Utilisation prévue',            'Planned use'),
  ('champ.profil_coach',      'ui', 'Profil coach idéal',            'Ideal coach profile'),
  ('champ.priorites',         'ui', 'Priorités si sélectionnée',     'Priorities if selected'),
  ('champ.conditions',        'ui', 'Conditions préalables',         'Preconditions'),
  ('section.reponses_form',   'ui', 'Réponses au formulaire',        'Application form answers'),
  ('doc.recap_score',         'ui', 'Récapitulatif — trié par Score IA', 'Summary — sorted by AI score'),
  ('doc.repartition_statut',  'ui', 'Répartition par statut',        'Breakdown by status'),
  ('doc.repartition_secteur', 'ui', 'Répartition par secteur',       'Breakdown by sector'),

  ('etat.aucun_diagnostic', 'ui', 'Diagnostic à générer', 'Diagnostic to be generated');
