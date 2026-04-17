-- ============================================================================
-- Phase 1A — Migration 2/8 : Table organization_members
-- Qui a accès à quelle org, avec quel rôle
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'analyst', 'coach', 'entrepreneur')),
  invited_by      uuid REFERENCES auth.users(id),
  joined_at       timestamptz DEFAULT now(),
  is_active       boolean DEFAULT true,
  UNIQUE(organization_id, user_id)
);

COMMENT ON TABLE public.organization_members IS 'Membres de chaque organisation avec leur rôle';
COMMENT ON COLUMN public.organization_members.role IS 'owner=créateur, admin=gestionnaire, manager=chef prog/MD, analyst=IM, coach=coach/analyste PE, entrepreneur=PE optionnel';
COMMENT ON COLUMN public.organization_members.is_active IS 'false = membre retiré (soft delete)';

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON public.organization_members(organization_id, role) WHERE is_active = true;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
