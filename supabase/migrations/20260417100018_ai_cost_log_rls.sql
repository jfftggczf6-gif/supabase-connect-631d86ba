-- RLS policy for ai_cost_log (multi-tenant)
-- Note: Edge Functions use service_role key which bypasses RLS for inserts

ALTER TABLE IF EXISTS public.ai_cost_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_cost_log_org_read" ON public.ai_cost_log;
DROP POLICY IF EXISTS "ai_cost_log_service_insert" ON public.ai_cost_log;

-- Read: org members see their org's costs, super_admins see all
CREATE POLICY "ai_cost_log_org_read" ON public.ai_cost_log
  FOR SELECT TO authenticated USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Insert: authenticated users with org membership (EFs use service_role which bypasses RLS)
CREATE POLICY "ai_cost_log_service_insert" ON public.ai_cost_log
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
