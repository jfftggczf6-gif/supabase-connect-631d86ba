-- ============================================================================
-- Phase 1B — Migration 12 : Réécriture policies deliverables, modules, versions, corrections
-- Ajout org check + remplacement coach_id par is_coach_of_enterprise
-- ============================================================================

-- ═══ DELIVERABLES ═══
DROP POLICY IF EXISTS "Users see deliverables of own enterprises" ON public.deliverables;
DROP POLICY IF EXISTS "Users can insert deliverables for own enterprises" ON public.deliverables;
DROP POLICY IF EXISTS "Users can update deliverables of own enterprises" ON public.deliverables;
DROP POLICY IF EXISTS "Users can delete deliverables of own enterprises" ON public.deliverables;
DROP POLICY IF EXISTS "Chef programme can view all deliverables" ON public.deliverables;
-- Préserver SA policies

-- SELECT : préserver la logique métier complexe (generated_by + visibility)
CREATE POLICY "Users see deliverables v2"
  ON public.deliverables FOR SELECT TO public
  USING (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = deliverables.enterprise_id AND (
        public.is_coach_of_enterprise(e.id)
        OR (e.user_id = auth.uid() AND (
          deliverables.generated_by = 'entrepreneur'
          OR deliverables.generated_by = 'coach_mirror'
          OR deliverables.visibility = 'shared'
        ))
      )
    )
  );

-- Managers voient tous les deliverables de leur org
CREATE POLICY "Managers see all org deliverables"
  ON public.deliverables FOR SELECT TO authenticated
  USING (
    public.is_member_of(organization_id)
    AND public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager', 'analyst')
  );

CREATE POLICY "Users insert deliverables v2"
  ON public.deliverables FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = deliverables.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

CREATE POLICY "Users update deliverables v2"
  ON public.deliverables FOR UPDATE TO authenticated
  USING (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = deliverables.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

CREATE POLICY "Users delete deliverables v2"
  ON public.deliverables FOR DELETE TO public
  USING (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = deliverables.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

-- ═══ ENTERPRISE_MODULES ═══
DROP POLICY IF EXISTS "Users see modules of own enterprises" ON public.enterprise_modules;
DROP POLICY IF EXISTS "Users can insert modules for own enterprises" ON public.enterprise_modules;
DROP POLICY IF EXISTS "Users can update modules of own enterprises" ON public.enterprise_modules;
DROP POLICY IF EXISTS "Users can delete modules of own enterprises" ON public.enterprise_modules;

CREATE POLICY "Users see modules v2"
  ON public.enterprise_modules FOR SELECT TO authenticated
  USING (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = enterprise_modules.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid()
             OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager', 'analyst'))
    )
  );

CREATE POLICY "Users insert modules v2"
  ON public.enterprise_modules FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = enterprise_modules.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

CREATE POLICY "Users update modules v2"
  ON public.enterprise_modules FOR UPDATE TO authenticated
  USING (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = enterprise_modules.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

CREATE POLICY "Users delete modules v2"
  ON public.enterprise_modules FOR DELETE TO public
  USING (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = enterprise_modules.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

-- ═══ DELIVERABLE_VERSIONS ═══
DROP POLICY IF EXISTS "Users see own enterprise versions" ON public.deliverable_versions;
DROP POLICY IF EXISTS "System can insert versions" ON public.deliverable_versions;

CREATE POLICY "Users see versions v2"
  ON public.deliverable_versions FOR SELECT TO public
  USING (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = deliverable_versions.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid()
             OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager', 'analyst'))
    )
  );

CREATE POLICY "System insert versions v2"
  ON public.deliverable_versions FOR INSERT TO public
  WITH CHECK (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = deliverable_versions.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

-- ═══ DELIVERABLE_CORRECTIONS ═══
DROP POLICY IF EXISTS "Users manage corrections on own enterprises" ON public.deliverable_corrections;
DROP POLICY IF EXISTS "Super admin can select all deliverable_corrections" ON public.deliverable_corrections;

CREATE POLICY "Users manage corrections v2"
  ON public.deliverable_corrections FOR ALL TO public
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.is_member_of(organization_id) AND (
        corrected_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.enterprises e
          WHERE e.id = deliverable_corrections.enterprise_id
            AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
        )
      )
    )
  );
