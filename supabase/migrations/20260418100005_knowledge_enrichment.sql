-- Knowledge enrichment tables for auto-enrich pipeline

-- Log of each enrichment run
CREATE TABLE IF NOT EXISTS public.knowledge_enrichment_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date        timestamptz DEFAULT now(),
  sources_refreshed int DEFAULT 0,
  new_discovered  int DEFAULT 0,
  auto_ingested   int DEFAULT 0,
  pending_review  int DEFAULT 0,
  rejected        int DEFAULT 0,
  cost_usd        numeric(10,4) DEFAULT 0,
  details         jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- Pending review queue for documents awaiting human validation
CREATE TABLE IF NOT EXISTS public.knowledge_pending_review (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  content         text NOT NULL,
  category        text DEFAULT 'general',
  sector          text,
  country         text,
  source          text,
  source_url      text,
  quality_score   numeric(3,1),
  ai_summary      text,
  ai_reasoning    text,
  status          text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  tags            text[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.knowledge_enrichment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_pending_review ENABLE ROW LEVEL SECURITY;

-- Only super_admin can see enrichment logs and pending reviews
CREATE POLICY "sa_read_enrichment_log" ON public.knowledge_enrichment_log
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "sa_read_pending_review" ON public.knowledge_pending_review
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Insert allowed for service role (auto-enrich cron)
CREATE POLICY "service_insert_enrichment_log" ON public.knowledge_enrichment_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "service_insert_pending_review" ON public.knowledge_pending_review
  FOR INSERT TO authenticated WITH CHECK (true);
