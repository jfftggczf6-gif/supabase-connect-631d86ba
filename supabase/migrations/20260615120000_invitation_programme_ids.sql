-- Programmes que l'invité (chef de programme) devra gérer, appliqués à l'acceptation.
ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS programme_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.organization_invitations.programme_ids IS
  'IDs de programmes dont l''invité devient chef_programme_id à l''acceptation (rôle manager).';
