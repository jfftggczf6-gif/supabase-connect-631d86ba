-- RLS policies for programmes, candidatures, criteria, KPIs, funding (multi-tenant)
-- Wrapped in DO blocks for tables that may not exist in local dev

-- Helper: create_policy_if_table_exists
CREATE OR REPLACE FUNCTION _temp_apply_rls(statements text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE stmt text;
BEGIN
  FOREACH stmt IN ARRAY statements LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table does not exist — skipping: %', left(stmt, 80);
    END;
  END LOOP;
END $$;

-- ═══ PROGRAMMES ═══
SELECT _temp_apply_rls(ARRAY[
  'ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "programmes_read" ON public.programmes',
  'DROP POLICY IF EXISTS "programmes_insert" ON public.programmes',
  'DROP POLICY IF EXISTS "programmes_update" ON public.programmes',
  'DROP POLICY IF EXISTS "programmes_delete" ON public.programmes',
  'CREATE POLICY "programmes_read" ON public.programmes FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programmes_insert" ON public.programmes FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.get_user_role_in(organization_id) IN (''owner'', ''admin'', ''manager'') OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programmes_update" ON public.programmes FOR UPDATE TO authenticated USING (chef_programme_id = auth.uid() OR (organization_id IS NOT NULL AND public.get_user_role_in(organization_id) IN (''owner'', ''admin'', ''manager'')) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programmes_delete" ON public.programmes FOR DELETE TO authenticated USING (chef_programme_id = auth.uid() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))'
]);

-- ═══ CANDIDATURES ═══
SELECT _temp_apply_rls(ARRAY[
  'ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "candidatures_read" ON public.candidatures',
  'DROP POLICY IF EXISTS "candidatures_insert" ON public.candidatures',
  'DROP POLICY IF EXISTS "candidatures_update" ON public.candidatures',
  'DROP POLICY IF EXISTS "candidatures_delete" ON public.candidatures',
  'CREATE POLICY "candidatures_read" ON public.candidatures FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "candidatures_insert" ON public.candidatures FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "candidatures_update" ON public.candidatures FOR UPDATE TO authenticated USING (organization_id IS NULL OR public.get_user_role_in(organization_id) IN (''owner'', ''admin'', ''manager'') OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "candidatures_delete" ON public.candidatures FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::public.app_role))'
]);

-- ═══ PROGRAMME_CRITERIA ═══
SELECT _temp_apply_rls(ARRAY[
  'ALTER TABLE public.programme_criteria ENABLE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "programme_criteria_read" ON public.programme_criteria',
  'DROP POLICY IF EXISTS "programme_criteria_write" ON public.programme_criteria',
  'DROP POLICY IF EXISTS "programme_criteria_insert" ON public.programme_criteria',
  'DROP POLICY IF EXISTS "programme_criteria_update" ON public.programme_criteria',
  'DROP POLICY IF EXISTS "programme_criteria_delete" ON public.programme_criteria',
  'CREATE POLICY "programme_criteria_read" ON public.programme_criteria FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programme_criteria_insert" ON public.programme_criteria FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.get_user_role_in(organization_id) IN (''owner'', ''admin'', ''manager'') OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programme_criteria_update" ON public.programme_criteria FOR UPDATE TO authenticated USING (organization_id IS NULL OR public.get_user_role_in(organization_id) IN (''owner'', ''admin'', ''manager'') OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programme_criteria_delete" ON public.programme_criteria FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::public.app_role))'
]);

-- ═══ PROGRAMME_KPIS ═══
SELECT _temp_apply_rls(ARRAY[
  'ALTER TABLE public.programme_kpis ENABLE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "programme_kpis_read" ON public.programme_kpis',
  'DROP POLICY IF EXISTS "programme_kpis_write" ON public.programme_kpis',
  'DROP POLICY IF EXISTS "programme_kpis_insert" ON public.programme_kpis',
  'DROP POLICY IF EXISTS "programme_kpis_update" ON public.programme_kpis',
  'DROP POLICY IF EXISTS "programme_kpis_delete" ON public.programme_kpis',
  'CREATE POLICY "programme_kpis_read" ON public.programme_kpis FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programme_kpis_insert" ON public.programme_kpis FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.get_user_role_in(organization_id) IN (''owner'', ''admin'', ''manager'') OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programme_kpis_update" ON public.programme_kpis FOR UPDATE TO authenticated USING (organization_id IS NULL OR public.get_user_role_in(organization_id) IN (''owner'', ''admin'', ''manager'') OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programme_kpis_delete" ON public.programme_kpis FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::public.app_role))'
]);

-- ═══ PROGRAMME_KPI_HISTORY ═══
SELECT _temp_apply_rls(ARRAY[
  'ALTER TABLE public.programme_kpi_history ENABLE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "programme_kpi_history_read" ON public.programme_kpi_history',
  'DROP POLICY IF EXISTS "programme_kpi_history_write" ON public.programme_kpi_history',
  'DROP POLICY IF EXISTS "programme_kpi_history_insert" ON public.programme_kpi_history',
  'CREATE POLICY "programme_kpi_history_read" ON public.programme_kpi_history FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "programme_kpi_history_insert" ON public.programme_kpi_history FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))'
]);

-- ═══ FUNDING_MATCHES ═══
SELECT _temp_apply_rls(ARRAY[
  'ALTER TABLE public.funding_matches ENABLE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "funding_matches_read" ON public.funding_matches',
  'DROP POLICY IF EXISTS "funding_matches_write" ON public.funding_matches',
  'CREATE POLICY "funding_matches_read" ON public.funding_matches FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
  'CREATE POLICY "funding_matches_write" ON public.funding_matches FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))'
]);

-- ═══ FUNDING_PROGRAMS ═══
SELECT _temp_apply_rls(ARRAY[
  'ALTER TABLE public.funding_programs ENABLE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "funding_programs_read" ON public.funding_programs',
  'DROP POLICY IF EXISTS "funding_programs_write" ON public.funding_programs',
  'CREATE POLICY "funding_programs_read" ON public.funding_programs FOR SELECT TO authenticated USING (true)',
  'CREATE POLICY "funding_programs_write" ON public.funding_programs FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.is_member_of(organization_id) OR public.has_role(auth.uid(), ''super_admin''::public.app_role))'
]);

-- Cleanup temp function
DROP FUNCTION IF EXISTS _temp_apply_rls(text[]);
