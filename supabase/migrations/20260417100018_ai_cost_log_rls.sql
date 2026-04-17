-- RLS policy for ai_cost_log (multi-tenant)
-- Note: Edge Functions use service_role key which bypasses RLS for inserts
-- Wrapped in DO block because ai_cost_log may not exist in local dev

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_cost_log') THEN
    ALTER TABLE public.ai_cost_log ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "ai_cost_log_org_read" ON public.ai_cost_log;
    DROP POLICY IF EXISTS "ai_cost_log_service_insert" ON public.ai_cost_log;

    CREATE POLICY "ai_cost_log_org_read" ON public.ai_cost_log
      FOR SELECT TO authenticated USING (
        organization_id IS NULL
        OR public.is_member_of(organization_id)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );

    CREATE POLICY "ai_cost_log_service_insert" ON public.ai_cost_log
      FOR INSERT TO authenticated WITH CHECK (
        organization_id IS NULL
        OR public.is_member_of(organization_id)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );

    RAISE NOTICE 'ai_cost_log RLS policies applied';
  ELSE
    RAISE NOTICE 'ai_cost_log does not exist — skipping RLS';
  END IF;
END $$;
