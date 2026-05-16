-- Feature equipe_ba (extension) : étend UPDATE + DELETE de organization_members
-- aux managing_director (Partner BA) pour permettre :
--   - désactiver un membre (UPDATE is_active = false)
--   - réactiver un membre (UPDATE is_active = true)
--   - supprimer un membre de l'organisation (DELETE row)
--
-- Avant : owner/admin/super_admin only. Maintenant : ajoute MD de SON org.

DROP POLICY IF EXISTS "Owner admin remove members" ON public.organization_members;
DROP POLICY IF EXISTS "Owner admin update members" ON public.organization_members;

CREATE POLICY "Org managers remove members"
  ON public.organization_members
  FOR DELETE
  USING (
    is_owner_or_admin_of(organization_id)
    OR is_pe_md_or_owner(organization_id, auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Org managers update members"
  ON public.organization_members
  FOR UPDATE
  USING (
    is_owner_or_admin_of(organization_id)
    OR is_pe_md_or_owner(organization_id, auth.uid())
    OR (user_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
