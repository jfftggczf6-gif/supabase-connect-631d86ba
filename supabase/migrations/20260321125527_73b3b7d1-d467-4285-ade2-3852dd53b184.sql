CREATE TABLE public.coaching_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  input_type TEXT NOT NULL DEFAULT 'text',
  raw_content TEXT,
  file_path TEXT,
  file_name TEXT,
  resume_ia TEXT,
  infos_extraites JSONB DEFAULT '[]',
  date_rdv DATE,
  titre TEXT,
  visible_chef_programme BOOLEAN DEFAULT true
);

CREATE INDEX idx_coaching_notes_enterprise ON public.coaching_notes(enterprise_id, created_at DESC);

ALTER TABLE public.coaching_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage coaching notes for their enterprises"
ON public.coaching_notes FOR ALL TO authenticated
USING (
  coach_id = auth.uid()
  OR enterprise_id IN (SELECT id FROM public.enterprises WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

INSERT INTO storage.buckets (id, name, public) VALUES ('coaching-files', 'coaching-files', false)
ON CONFLICT (id) DO NOTHING;