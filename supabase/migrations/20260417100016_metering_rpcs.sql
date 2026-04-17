-- ============================================================================
-- Prompt 6 : RPCs metering + index performance
-- ============================================================================

-- Index pour les agrégations temporelles (skip si table n'existe pas en local)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_cost_log') THEN
    CREATE INDEX IF NOT EXISTS idx_ai_cost_log_org_date ON public.ai_cost_log(organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_cost_log_date ON public.ai_cost_log(created_at DESC);
    RAISE NOTICE 'Indexes created on ai_cost_log';
  ELSE
    RAISE NOTICE 'ai_cost_log does not exist locally — skipping indexes';
  END IF;
END $$;

-- Résumé global par org
CREATE OR REPLACE FUNCTION public.get_metering_summary(
  period_start timestamptz,
  period_end timestamptz,
  org_filter uuid DEFAULT NULL
)
RETURNS TABLE(
  organization_id uuid, organization_name text, organization_type text,
  total_cost numeric, call_count bigint, enterprise_count bigint,
  avg_cost_per_enterprise numeric, avg_cost_per_call numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  RETURN QUERY
  SELECT
    a.organization_id,
    o.name,
    o.type,
    COALESCE(SUM(a.cost_usd), 0)::numeric as total_cost,
    COUNT(*)::bigint as call_count,
    COUNT(DISTINCT a.enterprise_id)::bigint as enterprise_count,
    CASE WHEN COUNT(DISTINCT a.enterprise_id) > 0
      THEN ROUND(SUM(a.cost_usd) / COUNT(DISTINCT a.enterprise_id), 4)
      ELSE 0 END as avg_cost_per_enterprise,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(SUM(a.cost_usd) / COUNT(*), 6)
      ELSE 0 END as avg_cost_per_call
  FROM public.ai_cost_log a
  JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.created_at >= period_start
    AND a.created_at <= period_end
    AND (org_filter IS NULL OR a.organization_id = org_filter)
  GROUP BY a.organization_id, o.name, o.type
  ORDER BY total_cost DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_metering_summary(timestamptz, timestamptz, uuid) TO authenticated;

-- Détail par org
CREATE OR REPLACE FUNCTION public.get_metering_org_detail(
  p_org_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
RETURNS TABLE(
  function_name text, model text, call_count bigint,
  total_cost numeric, total_input_tokens bigint, total_output_tokens bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  RETURN QUERY
  SELECT
    a.function_name,
    a.model,
    COUNT(*)::bigint,
    COALESCE(SUM(a.cost_usd), 0)::numeric,
    COALESCE(SUM(a.input_tokens), 0)::bigint,
    COALESCE(SUM(a.output_tokens), 0)::bigint
  FROM public.ai_cost_log a
  WHERE a.organization_id = p_org_id
    AND a.created_at >= period_start
    AND a.created_at <= period_end
  GROUP BY a.function_name, a.model
  ORDER BY SUM(a.cost_usd) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_metering_org_detail(uuid, timestamptz, timestamptz) TO authenticated;
