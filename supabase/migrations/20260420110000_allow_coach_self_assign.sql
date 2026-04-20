-- Permet à un coach de s'auto-assigner à une entreprise qu'il vient de créer
-- Avant : seuls owner/admin/manager pouvaient faire des inserts dans enterprise_coaches
-- → bloquait le flow "coach crée un entrepreneur" (403 après création de enterprise)

DROP POLICY IF EXISTS "Managers assign coaches" ON public.enterprise_coaches;

CREATE POLICY "Managers and self assign coaches"
  ON public.enterprise_coaches FOR INSERT
  WITH CHECK (
    public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    -- Auto-assignment: un coach membre de l'org peut se lier à une entreprise
    OR (coach_id = auth.uid() AND public.is_member_of(organization_id))
  );
