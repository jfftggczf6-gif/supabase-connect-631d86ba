-- ============================================================================
-- Prompt 2 : RPC pour lister toutes les orgs (super_admin uniquement)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_all_organizations_for_admin()
RETURNS TABLE(
  id uuid, name text, slug text, type text, country text,
  is_active boolean, member_count bigint, enterprise_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: super_admin role required';
  END IF;
  RETURN QUERY SELECT
    o.id, o.name, o.slug, o.type, o.country, o.is_active,
    (SELECT count(*) FROM public.organization_members om WHERE om.organization_id = o.id AND om.is_active),
    (SELECT count(*) FROM public.enterprises e WHERE e.organization_id = o.id),
    o.created_at
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_organizations_for_admin() TO authenticated;

-- RPC pour vérifier la disponibilité d'un slug
CREATE OR REPLACE FUNCTION public.check_slug_available(p_slug text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = p_slug)
$$;

GRANT EXECUTE ON FUNCTION public.check_slug_available(text) TO authenticated;
