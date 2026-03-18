
-- Table: deliverable_corrections (feedback loop)
CREATE TABLE IF NOT EXISTS public.deliverable_corrections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id   UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  deliverable_id  UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,
  corrected_by    UUID NOT NULL,
  field_path      TEXT NOT NULL,
  original_value  JSONB,
  corrected_value JSONB,
  correction_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_corrections_enterprise ON public.deliverable_corrections(enterprise_id);
CREATE INDEX idx_corrections_type ON public.deliverable_corrections(deliverable_type);

ALTER TABLE public.deliverable_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage corrections on own enterprises" ON public.deliverable_corrections
  FOR ALL USING (
    corrected_by = auth.uid() OR
    EXISTS (SELECT 1 FROM enterprises e WHERE e.id = deliverable_corrections.enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid()))
  );

-- Table: deliverable_versions (version history)
CREATE TABLE IF NOT EXISTS public.deliverable_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id  UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  enterprise_id   UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  version         INTEGER NOT NULL,
  data            JSONB NOT NULL,
  score           NUMERIC(5,2),
  validation_report JSONB,
  generated_by    TEXT DEFAULT 'ai',
  trigger_reason  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_versions_deliverable ON public.deliverable_versions(deliverable_id, version DESC);

ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own enterprise versions" ON public.deliverable_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM enterprises e WHERE e.id = deliverable_versions.enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid()))
  );

CREATE POLICY "System can insert versions" ON public.deliverable_versions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM enterprises e WHERE e.id = deliverable_versions.enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid()))
  );

-- Table: activity_log (audit trail)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id    UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  actor_id         UUID,
  actor_role       TEXT,
  action           TEXT NOT NULL,
  resource_type    TEXT,
  resource_id      UUID,
  deliverable_type TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_log_enterprise ON public.activity_log(enterprise_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own activity" ON public.activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM enterprises e WHERE e.id = activity_log.enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid()))
  );

CREATE POLICY "Users can insert activity" ON public.activity_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM enterprises e WHERE e.id = activity_log.enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid()))
  );

CREATE POLICY "Super admin sees all activity" ON public.activity_log
  FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));
