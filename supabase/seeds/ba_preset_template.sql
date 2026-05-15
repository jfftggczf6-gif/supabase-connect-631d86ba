-- ===========================================================================
-- TEMPLATE — Preset Banque d'Affaires (BA / Advisory)
--
-- À UTILISER une fois que l'org BA est créée sur l'environnement cible.
-- Remplacer :
--   - <BA_ORG_ID>  : l'UUID de l'org BA (type='banque_affaires')
--
-- Stages BA (5)              : recus → im_vendeur → interets → nego → close
-- Rôles BA (mapping ESONO)   : analyst→Analyste BA · investment_manager→Senior · managing_director→Partner
-- ===========================================================================

INSERT INTO organization_presets (
  organization_id,
  fund_segment,
  devise,
  langue,
  horizon_projection,
  livrables_actifs,
  workflow_overrides,
  templates_custom
) VALUES (
  '<BA_ORG_ID>',                          -- ⚠ remplacer
  'mid_market',                           -- ou amorcage / gros_tickets selon le mandat
  'EUR',                                  -- BA = ticket en EUR (vs XOF/FCFA pour PE/Programme)
  'fr',
  5,
  ARRAY['teaser', 'im_vendeur', 'matching_acquereurs', 'tracking_negotiation'],
  jsonb_build_object(
    'pipeline_statuts', jsonb_build_array(
      jsonb_build_object('code', 'recus',      'label', 'Reçus',                  'order', 1),
      jsonb_build_object('code', 'im_vendeur', 'label', 'IM vendeur',             'order', 2),
      jsonb_build_object('code', 'interets',   'label', 'Intérêts acquéreurs',    'order', 3),
      jsonb_build_object('code', 'nego',       'label', 'Négociation',            'order', 4),
      jsonb_build_object('code', 'close',      'label', 'Close',                  'order', 5)
    ),
    'roles_labels', jsonb_build_object(
      'analyst',            'Analyste BA',
      'investment_manager', 'Senior',
      'managing_director',  'Partner'
    ),
    'pipeline_views_per_role', jsonb_build_object(
      'analyst',            jsonb_build_array('recus', 'im_vendeur', 'interets'),
      'investment_manager', jsonb_build_array('recus', 'im_vendeur', 'interets', 'nego'),
      'managing_director',  jsonb_build_array('recus', 'im_vendeur', 'interets', 'nego', 'close'),
      'partner',            jsonb_build_array('recus', 'im_vendeur', 'interets', 'nego', 'close'),
      'owner',              jsonb_build_array('recus', 'im_vendeur', 'interets', 'nego', 'close'),
      'admin',              jsonb_build_array('recus', 'im_vendeur', 'interets', 'nego', 'close')
    )
  ),
  jsonb_build_object(
    'branding', jsonb_build_object(
      'primary_color', '#0f172a',         -- BA = palette plus sobre que PE (à ajuster)
      'secondary_color', '#64748b',
      'logo_url', NULL
    )
  )
)
ON CONFLICT (organization_id) DO UPDATE SET
  fund_segment       = EXCLUDED.fund_segment,
  devise             = EXCLUDED.devise,
  langue             = EXCLUDED.langue,
  horizon_projection = EXCLUDED.horizon_projection,
  livrables_actifs   = EXCLUDED.livrables_actifs,
  workflow_overrides = EXCLUDED.workflow_overrides,
  templates_custom   = EXCLUDED.templates_custom,
  updated_at         = NOW();
