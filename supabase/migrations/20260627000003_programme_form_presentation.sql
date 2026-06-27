-- ============================================================================
-- Séparer la description INTERNE du programme de la présentation PUBLIQUE du formulaire.
-- Avant : la colonne `description` servait aux deux (elle s'affichait directement sur le formulaire
-- public). Désormais :
--   - `description`       = info interne sur le programme (onglet Paramètres / création), non publique ;
--   - `form_presentation` = présentation publique du formulaire (Markdown), visible par les candidats.
-- ============================================================================

ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS form_presentation text;

COMMENT ON COLUMN public.programmes.form_presentation IS
  'Présentation publique du formulaire de candidature (Markdown, visible par les candidats). Distincte de description (usage interne).';

-- Backfill : ce qui était dans description s'affichait jusqu'ici sur le formulaire public.
-- On le recopie dans form_presentation pour ne RIEN perdre côté public (zéro régression).
UPDATE public.programmes
  SET form_presentation = description
  WHERE form_presentation IS NULL
    AND description IS NOT NULL
    AND btrim(description) <> '';
