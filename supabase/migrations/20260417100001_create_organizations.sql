-- ============================================================================
-- Phase 1A — Migration 1/8 : Table organizations
-- Chaque client ESONO (Enabel, GIZ, Fonds PE) = une organisation isolée
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  type          text NOT NULL CHECK (type IN ('programme', 'pe', 'mixed')),
  country       text,
  logo_url      text,
  primary_color text,
  secondary_color text,
  settings      jsonb DEFAULT '{}',
  is_active     boolean DEFAULT true,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE public.organizations IS 'Organisations clientes ESONO — chaque org est un espace isolé (multi-tenant)';
COMMENT ON COLUMN public.organizations.slug IS 'Identifiant URL unique (ex: enabel-ci)';
COMMENT ON COLUMN public.organizations.type IS 'Type: programme (opérateur/bailleur), pe (private equity), mixed';
COMMENT ON COLUMN public.organizations.settings IS 'Configuration custom: modules activés, langue, devise, pipeline, etc.';
COMMENT ON COLUMN public.organizations.primary_color IS 'Couleur primaire branding (hex)';
COMMENT ON COLUMN public.organizations.secondary_color IS 'Couleur secondaire branding (hex)';

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(is_active) WHERE is_active = true;

-- Réutilise le trigger update_updated_at existant
CREATE OR REPLACE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activer RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
