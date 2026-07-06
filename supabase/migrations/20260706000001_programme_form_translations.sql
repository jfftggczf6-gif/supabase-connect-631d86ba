-- ============================================================================
-- Formulaire de candidature bilingue (toggle FR<->EN, zéro mélange).
--
-- La langue de RÉDACTION du formulaire vit dans les colonnes existantes
-- (name, form_presentation, default_fields[].label, form_fields[].label/options).
-- Les traductions vers les AUTRES langues sont stockées dans form_translations,
-- indexées par code langue :
--   {
--     "en": {
--       "presentation": "…",                         -- form_presentation traduite
--       "default_fields": { "<key>": "<label>" },    -- overrides de libellés par défaut traduits
--       "form_fields":    { "<fieldId>": { "label": "…", "options": { "<value>": "<label>" } } }
--     }
--   }
--
-- form_base_lang = langue de rédaction (celle des colonnes de base). Défaut 'fr'
-- car tout l'existant est en français -> repli sur la base = comportement actuel
-- (zéro régression). Aucun changement de RLS (colonnes ajoutées à une table déjà
-- filtrée par organization_id).
-- ============================================================================

ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS form_base_lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS form_translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.programmes.form_base_lang IS
  'Langue de rédaction du formulaire (celle des colonnes de base : name, form_presentation, default_fields, form_fields). Les autres langues vivent dans form_translations.';

COMMENT ON COLUMN public.programmes.form_translations IS
  'Traductions du formulaire par code langue : { <lang>: { presentation, default_fields:{key:label}, form_fields:{fieldId:{label, options:{value:label}}} } }. La langue de base n''y figure pas (elle est dans les colonnes de base).';
