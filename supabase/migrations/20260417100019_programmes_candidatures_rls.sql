-- RLS policies for programmes, candidatures, criteria, KPIs (multi-tenant)
-- Uses has_role() and get_user_role_in() from migration 20260417100009

-- ═══ PROGRAMMES ═══
ALTER TABLE IF EXISTS public.programmes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programmes_read" ON public.programmes;
DROP POLICY IF EXISTS "programmes_insert" ON public.programmes;
DROP POLICY IF EXISTS "programmes_update" ON public.programmes;
DROP POLICY IF EXISTS "programmes_delete" ON public.programmes;

CREATE POLICY "programmes_read" ON public.programmes
  FOR SELECT TO authenticated USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programmes_insert" ON public.programmes
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Update: chef_programme owner, or org owner/admin/manager, or super_admin
CREATE POLICY "programmes_update" ON public.programmes
  FOR UPDATE TO authenticated USING (
    chef_programme_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programmes_delete" ON public.programmes
  FOR DELETE TO authenticated USING (
    chef_programme_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ CANDIDATURES ═══
ALTER TABLE IF EXISTS public.candidatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidatures_read" ON public.candidatures;
DROP POLICY IF EXISTS "candidatures_insert" ON public.candidatures;
DROP POLICY IF EXISTS "candidatures_update" ON public.candidatures;
DROP POLICY IF EXISTS "candidatures_delete" ON public.candidatures;

CREATE POLICY "candidatures_read" ON public.candidatures
  FOR SELECT TO authenticated USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "candidatures_insert" ON public.candidatures
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "candidatures_update" ON public.candidatures
  FOR UPDATE TO authenticated USING (
    organization_id IS NULL
    OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "candidatures_delete" ON public.candidatures
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ PROGRAMME_CRITERIA ═══
ALTER TABLE IF EXISTS public.programme_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programme_criteria_read" ON public.programme_criteria;
DROP POLICY IF EXISTS "programme_criteria_write" ON public.programme_criteria;
DROP POLICY IF EXISTS "programme_criteria_insert" ON public.programme_criteria;
DROP POLICY IF EXISTS "programme_criteria_update" ON public.programme_criteria;
DROP POLICY IF EXISTS "programme_criteria_delete" ON public.programme_criteria;

-- Read: org members only (criteria are confidential), super_admin sees all
CREATE POLICY "programme_criteria_read" ON public.programme_criteria
  FOR SELECT TO authenticated USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programme_criteria_insert" ON public.programme_criteria
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programme_criteria_update" ON public.programme_criteria
  FOR UPDATE TO authenticated USING (
    organization_id IS NULL
    OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programme_criteria_delete" ON public.programme_criteria
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ PROGRAMME_KPIS ═══
ALTER TABLE IF EXISTS public.programme_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programme_kpis_read" ON public.programme_kpis;
DROP POLICY IF EXISTS "programme_kpis_write" ON public.programme_kpis;
DROP POLICY IF EXISTS "programme_kpis_insert" ON public.programme_kpis;
DROP POLICY IF EXISTS "programme_kpis_update" ON public.programme_kpis;
DROP POLICY IF EXISTS "programme_kpis_delete" ON public.programme_kpis;

CREATE POLICY "programme_kpis_read" ON public.programme_kpis
  FOR SELECT TO authenticated USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programme_kpis_insert" ON public.programme_kpis
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programme_kpis_update" ON public.programme_kpis
  FOR UPDATE TO authenticated USING (
    organization_id IS NULL
    OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programme_kpis_delete" ON public.programme_kpis
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ PROGRAMME_KPI_HISTORY ═══
ALTER TABLE IF EXISTS public.programme_kpi_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programme_kpi_history_read" ON public.programme_kpi_history;
DROP POLICY IF EXISTS "programme_kpi_history_write" ON public.programme_kpi_history;
DROP POLICY IF EXISTS "programme_kpi_history_insert" ON public.programme_kpi_history;

CREATE POLICY "programme_kpi_history_read" ON public.programme_kpi_history
  FOR SELECT TO authenticated USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "programme_kpi_history_insert" ON public.programme_kpi_history
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ FUNDING_MATCHES ═══
ALTER TABLE IF EXISTS public.funding_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funding_matches_read" ON public.funding_matches;
DROP POLICY IF EXISTS "funding_matches_write" ON public.funding_matches;

CREATE POLICY "funding_matches_read" ON public.funding_matches
  FOR SELECT TO authenticated USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Insert/update: EFs use service_role (bypasses RLS), but also allow org members
CREATE POLICY "funding_matches_write" ON public.funding_matches
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ═══ FUNDING_PROGRAMS ═══
-- Global catalog — readable by all authenticated users, writable by super_admins
ALTER TABLE IF EXISTS public.funding_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funding_programs_read" ON public.funding_programs;
DROP POLICY IF EXISTS "funding_programs_write" ON public.funding_programs;

CREATE POLICY "funding_programs_read" ON public.funding_programs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "funding_programs_write" ON public.funding_programs
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
