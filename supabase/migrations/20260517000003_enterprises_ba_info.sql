-- 20260517000003_enterprises_ba_info.sql
-- Ajoute la colonne ba_info_metadata jsonb sur enterprises pour stocker
-- les infos structurées renseignées par l'Analyste BA (feature info_analyste).
--
-- Structure attendue :
-- {
--   identity: { rccm, date_creation_iso, legal_form, capital_social },
--   shareholders: [{ name, pct, role }],
--   management: [{ name, role, anciennete_years }],
--   activity: { products, markets, key_clients, competitive_advantages },
--   financials: { ca_n, ca_n_1, ca_n_2, ebitda_n, marge_ebitda_n, dette_totale }
-- }
-- Tout est optionnel et alimenté progressivement par l'Analyste + l'IA.

ALTER TABLE enterprises
  ADD COLUMN IF NOT EXISTS ba_info_metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ba_info_ai_filled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ba_info_updated_at timestamptz;

COMMENT ON COLUMN enterprises.ba_info_metadata IS
  'Données structurées BA : identity/shareholders/management/activity/financials. Pré-remplies via extract-ba-info depuis document_content.';
COMMENT ON COLUMN enterprises.ba_info_ai_filled IS
  'true si au moins un champ a été pré-rempli par l''IA (sert au badge "Pré-rempli par IA").';
