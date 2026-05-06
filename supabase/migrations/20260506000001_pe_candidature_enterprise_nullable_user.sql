-- ============================================================================
-- Phase G — PE Candidature → pipeline pré-screening automatique
-- ============================================================================
-- Quand une candidature est soumise sur le formulaire public d'un programme
-- appartenant à une org de type 'pe', l'edge fn submit-candidature crée :
--   1. Une enterprise (avec contact info, sans user_id car compte pas encore créé)
--   2. Un pe_deal en stage='pre_screening', source='appel_candidatures'
--
-- Pour permettre la création de l'enterprise avant que le candidat n'ait un
-- compte user (création différée à la validation par le MD), on rend
-- enterprises.user_id NULLABLE. Le user sera lié plus tard via update-candidature
-- quand le MD accepte le lead.
-- ============================================================================

ALTER TABLE enterprises ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN enterprises.user_id IS
  'User propriétaire de l''entreprise. NULL pour les leads PE sourcés via candidature
   tant que le MD n''a pas validé et créé le compte (cf update-candidature).';

-- Étend l'enum pe_deal_source pour distinguer les leads sourcés via formulaire public
ALTER TYPE pe_deal_source ADD VALUE IF NOT EXISTS 'appel_candidatures';
