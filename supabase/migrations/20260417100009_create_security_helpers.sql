-- ============================================================================
-- Phase 1B — Migration 9 : Fonctions helpers sécurité multi-tenant
-- Toutes SECURITY DEFINER + SET search_path = '' pour éviter les injections
-- ============================================================================

-- Vérifie qu'un utilisateur est membre actif d'une organisation
CREATE OR REPLACE FUNCTION public.is_member_of(org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND is_active = true
  )
$$;
COMMENT ON FUNCTION public.is_member_of(uuid) IS 'Vérifie que le user courant est membre actif de l org';

-- Retourne le rôle du user dans une org (null si pas membre)
CREATE OR REPLACE FUNCTION public.get_user_role_in(org_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND is_active = true
  LIMIT 1
$$;
COMMENT ON FUNCTION public.get_user_role_in(uuid) IS 'Retourne le rôle du user dans l org, null si pas membre';

-- Retourne la liste des org_ids dont le user est membre actif
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = auth.uid() AND is_active = true
$$;
COMMENT ON FUNCTION public.get_user_organizations() IS 'Liste des IDs d organisations du user courant';

-- Raccourci : le user est-il owner ou admin de l'org ?
CREATE OR REPLACE FUNCTION public.is_owner_or_admin_of(org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND is_active = true
      AND role IN ('owner', 'admin')
  )
$$;
COMMENT ON FUNCTION public.is_owner_or_admin_of(uuid) IS 'Vérifie que le user est owner ou admin de l org';

-- Vérifie que le user est coach assigné à une entreprise (N-à-N)
-- REMPLACE le pattern ancien e.coach_id = auth.uid()
CREATE OR REPLACE FUNCTION public.is_coach_of_enterprise(ent_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enterprise_coaches
    WHERE coach_id = auth.uid()
      AND enterprise_id = ent_id
      AND is_active = true
  )
  -- Fallback temporaire : vérifier aussi l'ancien coach_id (compat pendant migration UI)
  OR EXISTS (
    SELECT 1 FROM public.enterprises
    WHERE id = ent_id AND coach_id = auth.uid()
  )
$$;
COMMENT ON FUNCTION public.is_coach_of_enterprise(uuid) IS 'Vérifie que le user est coach assigné à cette entreprise (N-à-N + fallback 1-à-1)';

-- Grants
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_in(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_or_admin_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coach_of_enterprise(uuid) TO authenticated;
