-- RLS policy for ai_cost_log (multi-tenant)
-- Restricts access to organization members or super_admins

ALTER TABLE IF EXISTS public.ai_cost_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "ai_cost_log_org_read" ON public.ai_cost_log;
DROP POLICY IF EXISTS "ai_cost_log_service_insert" ON public.ai_cost_log;

-- Read: org members can see their org's costs, super_admins see all
CREATE POLICY "ai_cost_log_org_read" ON public.ai_cost_log
  FOR SELECT USING (
    organization_id IS NULL
    OR public.is_member_of(organization_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Insert: service role or authenticated users (EFs use service role)
CREATE POLICY "ai_cost_log_service_insert" ON public.ai_cost_log
  FOR INSERT WITH CHECK (true);
