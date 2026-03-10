
CREATE TABLE public.score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  score integer NOT NULL,
  scores_detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see score_history of own enterprises"
ON public.score_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM enterprises e
  WHERE e.id = score_history.enterprise_id
  AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())
));

CREATE POLICY "Service can insert score_history"
ON public.score_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM enterprises e
  WHERE e.id = score_history.enterprise_id
  AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())
));
