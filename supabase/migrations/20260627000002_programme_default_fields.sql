-- ============================================================================
-- Refonte du constructeur de formulaire de candidature.
-- Champs « par défaut » éditables (libellé / activé / requis) + intégration Pays & Secteur
-- en listes déroulantes contrôlées. La config est persistée par programme.
-- ============================================================================

ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS default_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.programmes.default_fields IS
  'Config des champs par défaut du formulaire de candidature : [{ "key", "label", "enabled", "required" }]. '
  'Fusionnée côté app avec le canon (src/lib/default-fields.ts). Vide = tous les champs par défaut actifs.';
