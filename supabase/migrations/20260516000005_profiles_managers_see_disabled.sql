-- Fix : full_name + email d'un membre désactivé disparaissent de la liste
-- Équipe (RLS profiles filtrait sur om2.is_active).
--
-- Solution : policy additive (OR) pour les managers (owner/admin/manager/MD)
-- qui retire le filtre is_active sur les membres de leur org. Permet d'afficher
-- correctement les comptes désactivés (avec leur nom) dans la page Équipe.
--
-- La policy existante "Org members can view profiles of co-members" reste
-- inchangée (membres standards voient uniquement les profils actifs).

CREATE POLICY "Org managers can view all member profiles"
  ON public.profiles
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id IN (
        SELECT om1.organization_id
        FROM public.organization_members om1
        WHERE om1.user_id = auth.uid()
          AND om1.is_active
          AND om1.role IN ('owner', 'admin', 'manager', 'managing_director')
      )
      -- Pas de filtre is_active : managers voient aussi les membres désactivés.
    )
  );
