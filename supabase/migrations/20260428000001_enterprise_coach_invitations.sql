-- enterprise_coach_invitations — pré-assignation d'un coach à une entreprise
-- AVANT que le coach n'accepte son invitation. Permet au manager d'inviter
-- un nouveau coach et de l'assigner d'avance à un dossier ; à l'acceptation
-- de l'invitation, la pré-assignation se matérialise automatiquement en
-- enterprise_coaches (gérée par accept-invitation).

CREATE TABLE IF NOT EXISTS public.enterprise_coach_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES public.organization_invitations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'principal',
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enterprise_id, invitation_id)
);

CREATE INDEX IF NOT EXISTS idx_eci_invitation ON public.enterprise_coach_invitations(invitation_id);
CREATE INDEX IF NOT EXISTS idx_eci_enterprise ON public.enterprise_coach_invitations(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_eci_organization ON public.enterprise_coach_invitations(organization_id);

ALTER TABLE public.enterprise_coach_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT : super_admin OU membre de l'org
DROP POLICY IF EXISTS "Read pending coach invitations" ON public.enterprise_coach_invitations;
CREATE POLICY "Read pending coach invitations" ON public.enterprise_coach_invitations
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.is_member_of(organization_id)
  );

-- INSERT : super_admin OU owner/admin/manager de l'org
DROP POLICY IF EXISTS "Managers create pending coach invitations" ON public.enterprise_coach_invitations;
CREATE POLICY "Managers create pending coach invitations" ON public.enterprise_coach_invitations
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.is_owner_or_admin_of(organization_id)
    OR public.get_user_role_in(organization_id) = 'manager'
  );

-- DELETE : super_admin OU owner/admin/manager de l'org
DROP POLICY IF EXISTS "Managers delete pending coach invitations" ON public.enterprise_coach_invitations;
CREATE POLICY "Managers delete pending coach invitations" ON public.enterprise_coach_invitations
  FOR DELETE USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.is_owner_or_admin_of(organization_id)
    OR public.get_user_role_in(organization_id) = 'manager'
  );

COMMENT ON TABLE public.enterprise_coach_invitations IS 'Pré-assignation d''un coach invité (mais pas encore inscrit) à une entreprise. Matérialisée automatiquement en enterprise_coaches au moment où le coach accepte son invitation.';
