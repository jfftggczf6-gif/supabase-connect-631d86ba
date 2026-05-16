-- Fix : "infinite recursion detected in policy for relation pe_team_assignments"
--
-- La policy pe_team_select avait une subquery SELECT sur pe_team_assignments
-- elle-même, ce qui re-déclenche la RLS check à l'infini :
--   ... OR (im_user_id IN (SELECT t.im_user_id FROM pe_team_assignments t
--          WHERE t.analyst_user_id = auth.uid() AND t.is_active = true))
--
-- Solution : encapsuler la lookup dans une fonction SECURITY DEFINER qui
-- bypass la RLS pendant l'exécution interne. Pas de récursion possible.

CREATE OR REPLACE FUNCTION public.get_im_for_analyst(p_analyst_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT t.im_user_id
  FROM public.pe_team_assignments t
  WHERE t.analyst_user_id = p_analyst_id
    AND t.is_active = true;
$$;

DROP POLICY IF EXISTS pe_team_select ON public.pe_team_assignments;

CREATE POLICY pe_team_select
  ON public.pe_team_assignments
  FOR SELECT
  USING (
    is_pe_md_or_owner(organization_id, auth.uid())
    OR (im_user_id = auth.uid())
    OR (im_user_id IN (SELECT public.get_im_for_analyst(auth.uid())))
  );
