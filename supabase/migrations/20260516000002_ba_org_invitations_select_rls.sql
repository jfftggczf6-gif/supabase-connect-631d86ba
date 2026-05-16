-- Feature equipe_ba : étend la RLS SELECT de organization_invitations
-- pour inclure les managing_director (Partner BA).
--
-- Contexte : is_owner_or_admin_of() ne contient que owner/admin. Le Partner
-- BA (rôle = managing_director) ne pouvait pas lister les invitations en
-- cours de SON org. send-invitation EF utilise service_role pour l'INSERT,
-- donc INSERT/UPDATE/DELETE restent inchangés (révocation = hors scope brief).

DROP POLICY IF EXISTS "Managers see invitations" ON public.organization_invitations;

CREATE POLICY "Org managers see invitations"
  ON public.organization_invitations
  FOR SELECT
  USING (
    is_owner_or_admin_of(organization_id)
    OR get_user_role_in(organization_id) = 'manager'
    OR is_pe_md_or_owner(organization_id, auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
