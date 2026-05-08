-- ============================================================================
-- ai_jobs — Ajout colonne programme_id pour screen-candidatures
-- ============================================================================
-- Le bouton "Screening IA" de Nathalie (chef de programme) lance un screening
-- batch sur tout un programme. On track le programme_id pour pouvoir afficher
-- côté front "screening en cours sur le programme X".
-- ============================================================================

ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES public.programmes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_jobs_programme_id ON public.ai_jobs(programme_id) WHERE programme_id IS NOT NULL;
