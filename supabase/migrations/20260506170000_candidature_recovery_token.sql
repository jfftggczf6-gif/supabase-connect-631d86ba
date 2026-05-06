-- ============================================================================
-- Lien de rattrapage candidature
-- ============================================================================
-- Permet de générer un lien sécurisé à token éphémère pour qu'un candidat dont
-- les uploads ont échoué silencieusement (cas FoodSen) puisse re-soumettre
-- ses pièces justificatives sans recréer toute la candidature.
--
-- Workflow :
--   1. MD/admin clique "Générer lien de rattrapage" dans le drawer candidature
--      → edge fn candidature-recovery (action=generate) crée un token + 7j d'expiration
--   2. MD copie le lien et l'envoie par email à FoodSen
--   3. FoodSen clique → page publique /candidature/recovery/:token
--      → edge fn candidature-recovery (action=info) renvoie les infos
--      → re-uploade les fichiers via storage anon
--      → edge fn candidature-recovery (action=submit) met à jour documents[]
--   4. Token consommé (used_at).
-- ============================================================================

ALTER TABLE candidatures
  ADD COLUMN IF NOT EXISTS recovery_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS recovery_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_candidatures_recovery_token
  ON candidatures(recovery_token)
  WHERE recovery_token IS NOT NULL AND recovery_used_at IS NULL;

COMMENT ON COLUMN candidatures.recovery_token IS
  'Token aléatoire pour générer un lien de rattrapage (cas où uploads ont échoué).';
COMMENT ON COLUMN candidatures.recovery_expires_at IS
  'Date d''expiration du token (généralement 7 jours après création).';
COMMENT ON COLUMN candidatures.recovery_used_at IS
  'Date à laquelle le candidat a utilisé le lien (token consommé).';
