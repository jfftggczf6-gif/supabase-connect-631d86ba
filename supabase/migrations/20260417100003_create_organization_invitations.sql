-- ============================================================================
-- Phase 1A — Migration 3/8 : Table organization_invitations
-- Invitations par email pour rejoindre une org
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL CHECK (role IN ('admin', 'manager', 'analyst', 'coach', 'entrepreneur')),
  invited_by      uuid REFERENCES auth.users(id),
  personal_message text,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE public.organization_invitations IS 'Invitations en attente pour rejoindre une organisation';
COMMENT ON COLUMN public.organization_invitations.token IS 'Token unique envoyé par email, valide 7 jours';
COMMENT ON COLUMN public.organization_invitations.role IS 'Rôle attribué à l acceptation (owner exclu — créé par super_admin)';

-- Pas d'invitation owner — seul super_admin crée les owners dans organization_members directement

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_pending ON public.organization_invitations(organization_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations FORCE ROW LEVEL SECURITY;
