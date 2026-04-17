-- ============================================================================
-- Phase 1B — Migration 10 : Policies RLS sur les nouvelles tables
-- organizations, organization_members, organization_invitations, enterprise_coaches
-- ============================================================================

-- ═══ ORGANIZATIONS ═══
CREATE POLICY "Members see their org"
  ON public.organizations FOR SELECT
  USING (public.is_member_of(id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admin creates orgs"
  ON public.organizations FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Owner or admin updates org"
  ON public.organizations FOR UPDATE
  USING (public.is_owner_or_admin_of(id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admin deletes orgs"
  ON public.organizations FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- ═══ ORGANIZATION_MEMBERS ═══
CREATE POLICY "Members see org members"
  ON public.organization_members FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organizations()) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Owner admin manager invite members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    public.is_owner_or_admin_of(organization_id)
    OR public.get_user_role_in(organization_id) = 'manager'
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Owner admin update members"
  ON public.organization_members FOR UPDATE
  USING (
    public.is_owner_or_admin_of(organization_id)
    OR user_id = auth.uid()  -- un membre peut se retirer lui-même
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Owner admin remove members"
  ON public.organization_members FOR DELETE
  USING (
    public.is_owner_or_admin_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ ORGANIZATION_INVITATIONS ═══
CREATE POLICY "Managers see invitations"
  ON public.organization_invitations FOR SELECT
  USING (
    public.is_owner_or_admin_of(organization_id)
    OR public.get_user_role_in(organization_id) = 'manager'
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Managers create invitations"
  ON public.organization_invitations FOR INSERT
  WITH CHECK (
    public.is_owner_or_admin_of(organization_id)
    OR public.get_user_role_in(organization_id) = 'manager'
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Owner admin manage invitations"
  ON public.organization_invitations FOR UPDATE
  USING (
    public.is_owner_or_admin_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Owner admin delete invitations"
  ON public.organization_invitations FOR DELETE
  USING (
    public.is_owner_or_admin_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ ENTERPRISE_COACHES ═══
CREATE POLICY "Members see coaches of their org enterprises"
  ON public.enterprise_coaches FOR SELECT
  USING (
    public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Managers assign coaches"
  ON public.enterprise_coaches FOR INSERT
  WITH CHECK (
    public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Managers update coach assignments"
  ON public.enterprise_coaches FOR UPDATE
  USING (
    public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Managers remove coach assignments"
  ON public.enterprise_coaches FOR DELETE
  USING (
    public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
