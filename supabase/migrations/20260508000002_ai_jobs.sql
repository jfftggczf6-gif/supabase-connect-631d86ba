-- ============================================================================
-- ai_jobs — Table centralisée pour tracker les exécutions d'agents IA
-- ============================================================================
-- Architecture POC Railway : les agents IA longs (>400s) sortent des edge fns
-- Supabase et tournent sur esono-ai-worker. L'edge fn insère un job ici
-- (status='pending'), POST fire-and-forget vers le worker, et retourne
-- immédiatement. Le worker met à jour le job au fur et à mesure
-- (running → ready/error). Le front écoute via Realtime.
--
-- error_kind permet d'instrumenter les vrais cas de timeout vs autres erreurs
-- (api_error, validation_error) pour décider plus tard si on étend la migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  error_kind TEXT,

  -- Liens optionnels vers les entités du domaine pour la queryabilité front
  deal_id UUID REFERENCES public.pe_deals(id) ON DELETE SET NULL,
  candidature_id UUID,
  memo_id UUID REFERENCES public.investment_memos(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INT,

  CONSTRAINT ai_jobs_status_check CHECK (status IN ('pending', 'running', 'ready', 'error')),
  CONSTRAINT ai_jobs_error_kind_check CHECK (error_kind IS NULL OR error_kind IN ('timeout', 'api_error', 'validation_error', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON public.ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_deal_id ON public.ai_jobs(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_jobs_organization_id ON public.ai_jobs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON public.ai_jobs(created_at DESC);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

-- Lecture : un user authentifié voit les jobs de son organisation OU ses propres jobs
DROP POLICY IF EXISTS "ai_jobs_select_own_org" ON public.ai_jobs;
CREATE POLICY "ai_jobs_select_own_org"
  ON public.ai_jobs FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

-- Écriture : seul le service_role (edge fn + worker) écrit, pas de policy authenticated
-- (les UPDATE viennent uniquement du worker via service role)

-- Realtime pour que le front voie les changements live
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_jobs;
