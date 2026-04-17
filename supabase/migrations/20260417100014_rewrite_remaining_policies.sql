-- ============================================================================
-- Phase 1B — Migration 14 : Réécriture policies restantes
-- activity_log, score_history, inputs_history, aggregated_benchmarks, workspace_knowledge
-- ============================================================================

-- ═══ ACTIVITY_LOG ═══
DROP POLICY IF EXISTS "Users see own activity" ON public.activity_log;
DROP POLICY IF EXISTS "Users can insert activity" ON public.activity_log;
DROP POLICY IF EXISTS "Super admin sees all activity" ON public.activity_log;
-- Note : "SA activity" peut aussi exister avec un nom différent
DROP POLICY IF EXISTS "SA activity" ON public.activity_log;

CREATE POLICY "Users see org activity v2"
  ON public.activity_log FOR SELECT TO public
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.is_member_of(organization_id) AND EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id = activity_log.enterprise_id
          AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid()
               OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager'))
      )
    )
  );

CREATE POLICY "Users insert activity v2"
  ON public.activity_log FOR INSERT TO public
  WITH CHECK (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = activity_log.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

-- ═══ SCORE_HISTORY ═══
DROP POLICY IF EXISTS "Users see score_history" ON public.score_history;
DROP POLICY IF EXISTS "Insert score_history" ON public.score_history;
DROP POLICY IF EXISTS "SA select score_history" ON public.score_history;

CREATE POLICY "Users see score history v2"
  ON public.score_history FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.is_member_of(organization_id) AND EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id = score_history.enterprise_id
          AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid()
               OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager'))
      )
    )
  );

CREATE POLICY "Insert score history v2"
  ON public.score_history FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of(organization_id) AND EXISTS (
      SELECT 1 FROM public.enterprises e
      WHERE e.id = score_history.enterprise_id
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
    )
  );

-- ═══ INPUTS_HISTORY ═══
DROP POLICY IF EXISTS "Users can view inputs history for their enterprises" ON public.inputs_history;
DROP POLICY IF EXISTS "SA select inputs_history" ON public.inputs_history;

CREATE POLICY "Users see inputs history v2"
  ON public.inputs_history FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.is_member_of(organization_id) AND (
        enterprise_id IN (SELECT id FROM public.enterprises WHERE user_id = auth.uid())
        OR public.is_coach_of_enterprise(enterprise_id)
        OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
      )
    )
  );

-- ═══ AGGREGATED_BENCHMARKS ═══
-- Garder global en lecture, restreindre l'écriture
DROP POLICY IF EXISTS "Authenticated can read aggregated_benchmarks" ON public.aggregated_benchmarks;
DROP POLICY IF EXISTS "Super admin can manage aggregated_benchmarks" ON public.aggregated_benchmarks;

CREATE POLICY "Members read benchmarks"
  ON public.aggregated_benchmarks FOR SELECT TO authenticated
  USING (true); -- Reste global en lecture (données partagées)

CREATE POLICY "SA manage benchmarks"
  ON public.aggregated_benchmarks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- ═══ WORKSPACE_KNOWLEDGE ═══
DROP POLICY IF EXISTS "Manage own workspace" ON public.workspace_knowledge;
DROP POLICY IF EXISTS "Read own workspace" ON public.workspace_knowledge;
DROP POLICY IF EXISTS "SA manage workspace_knowledge" ON public.workspace_knowledge;

CREATE POLICY "Users manage own workspace v2"
  ON public.workspace_knowledge FOR ALL TO authenticated
  USING (
    (owner_id = auth.uid() AND public.is_member_of(organization_id))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
