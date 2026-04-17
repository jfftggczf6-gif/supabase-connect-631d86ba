-- ============================================================================
-- Phase 1A — Migration 5/8 : Table enterprise_coaches (N-à-N)
-- Remplace la relation 1-à-1 enterprises.coach_id (qui est DEPRECATED mais conservée)
-- Permet d'assigner plusieurs coaches à une entreprise (OVO: coach financier + stratégique)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_coaches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  coach_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text DEFAULT 'principal' CHECK (role IN ('principal', 'secondaire', 'financier', 'strategique', 'junior', 'senior')),
  assigned_by   uuid REFERENCES auth.users(id),
  assigned_at   timestamptz DEFAULT now(),
  unassigned_at timestamptz,
  is_active     boolean DEFAULT true,
  notes         text
);

COMMENT ON TABLE public.enterprise_coaches IS 'Relation N-à-N entre coaches et entreprises. Remplace enterprises.coach_id (deprecated, conservée pour compat UI temporaire)';
COMMENT ON COLUMN public.enterprise_coaches.role IS 'Rôle du coach: principal (par défaut), secondaire, financier, strategique, junior, senior';
COMMENT ON COLUMN public.enterprise_coaches.unassigned_at IS 'Date de fin d assignation (soft delete via is_active=false)';

-- Contrainte unique partielle : un coach ne peut être assigné qu'une fois activement à une entreprise
CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_coaches_unique_active
  ON public.enterprise_coaches(enterprise_id, coach_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_enterprise_coaches_coach ON public.enterprise_coaches(coach_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_enterprise_coaches_enterprise ON public.enterprise_coaches(enterprise_id) WHERE is_active = true;

ALTER TABLE public.enterprise_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_coaches FORCE ROW LEVEL SECURITY;
