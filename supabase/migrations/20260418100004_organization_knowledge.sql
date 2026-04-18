-- organization_knowledge — Espace privé de connaissance par organisation (Pilier 3)
-- Thèses, méthodologies, anciens deals, guides de coaching, comparables historiques
-- Isolé par RLS : une org ne voit JAMAIS le contenu d'une autre

CREATE TABLE IF NOT EXISTS public.organization_knowledge (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category        text NOT NULL DEFAULT 'general' CHECK (category IN (
    'these', 'methodologie', 'ancien_deal', 'guide_coaching',
    'note_sectorielle', 'comparable', 'standard_reporting',
    'grille_scoring', 'template', 'general'
  )),
  title           text NOT NULL,
  content         text NOT NULL,
  metadata        jsonb DEFAULT '{}',
  sector          text,
  country         text,
  source          text,
  tags            text[] DEFAULT '{}',
  embedding       vector(1536),
  created_by      uuid REFERENCES auth.users(id),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_knowledge_org ON public.organization_knowledge (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_knowledge_category ON public.organization_knowledge (category);
CREATE INDEX IF NOT EXISTS idx_org_knowledge_sector ON public.organization_knowledge (sector);

-- RLS
ALTER TABLE public.organization_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_knowledge_read" ON public.organization_knowledge
  FOR SELECT TO authenticated USING (
    public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "org_knowledge_insert" ON public.organization_knowledge
  FOR INSERT TO authenticated WITH CHECK (
    public.is_member_of(organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "org_knowledge_update" ON public.organization_knowledge
  FOR UPDATE TO authenticated USING (
    public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "org_knowledge_delete" ON public.organization_knowledge
  FOR DELETE TO authenticated USING (
    public.get_user_role_in(organization_id) IN ('owner', 'admin')
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
