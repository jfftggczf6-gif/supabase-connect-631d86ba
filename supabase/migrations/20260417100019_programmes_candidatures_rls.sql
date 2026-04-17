-- RLS policies for programmes and candidatures (multi-tenant)

-- ═══ PROGRAMMES ═══
ALTER TABLE IF EXISTS public.programmes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programmes_read" ON public.programmes;
DROP POLICY IF EXISTS "programmes_insert" ON public.programmes;
DROP POLICY IF EXISTS "programmes_update" ON public.programmes;
DROP POLICY IF EXISTS "programmes_delete" ON public.programmes;

-- Read: org members see their org's programmes, super_admins see all, null org_id visible to all
CREATE POLICY "programmes_read" ON public.programmes
  FOR SELECT USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Insert: org members or super_admins
CREATE POLICY "programmes_insert" ON public.programmes
  FOR INSERT WITH CHECK (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Update: chef_programme or org admin/owner/manager or super_admin
CREATE POLICY "programmes_update" ON public.programmes
  FOR UPDATE USING (
    chef_programme_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_member_of(organization_id))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Delete: super_admin or chef_programme owner
CREATE POLICY "programmes_delete" ON public.programmes
  FOR DELETE USING (
    chef_programme_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ═══ CANDIDATURES ═══
ALTER TABLE IF EXISTS public.candidatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidatures_read" ON public.candidatures;
DROP POLICY IF EXISTS "candidatures_insert" ON public.candidatures;
DROP POLICY IF EXISTS "candidatures_update" ON public.candidatures;
DROP POLICY IF EXISTS "candidatures_delete" ON public.candidatures;

-- Read: org members, or the enterprise owner/coach, or super_admin
CREATE POLICY "candidatures_read" ON public.candidatures
  FOR SELECT USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Insert: org members or super_admin (EFs typically use service role)
CREATE POLICY "candidatures_insert" ON public.candidatures
  FOR INSERT WITH CHECK (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Update: same as insert
CREATE POLICY "candidatures_update" ON public.candidatures
  FOR UPDATE USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Delete: super_admin or chef_programme
CREATE POLICY "candidatures_delete" ON public.candidatures
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ═══ PROGRAMME_CRITERIA ═══
ALTER TABLE IF EXISTS public.programme_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programme_criteria_read" ON public.programme_criteria;
DROP POLICY IF EXISTS "programme_criteria_write" ON public.programme_criteria;

CREATE POLICY "programme_criteria_read" ON public.programme_criteria
  FOR SELECT USING (true);

CREATE POLICY "programme_criteria_write" ON public.programme_criteria
  FOR ALL USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ═══ PROGRAMME_KPIS ═══
ALTER TABLE IF EXISTS public.programme_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programme_kpis_read" ON public.programme_kpis;
DROP POLICY IF EXISTS "programme_kpis_write" ON public.programme_kpis;

CREATE POLICY "programme_kpis_read" ON public.programme_kpis
  FOR SELECT USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "programme_kpis_write" ON public.programme_kpis
  FOR ALL USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ═══ PROGRAMME_KPI_HISTORY ═══
ALTER TABLE IF EXISTS public.programme_kpi_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programme_kpi_history_read" ON public.programme_kpi_history;
DROP POLICY IF EXISTS "programme_kpi_history_write" ON public.programme_kpi_history;

CREATE POLICY "programme_kpi_history_read" ON public.programme_kpi_history
  FOR SELECT USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "programme_kpi_history_write" ON public.programme_kpi_history
  FOR ALL USING (true);
