
-- Programme criteria table for donor-side screening configuration
CREATE TABLE public.programme_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  -- Scoring weights & thresholds
  min_score_ir integer DEFAULT 0,
  max_score_ir integer DEFAULT 100,
  required_deliverables text[] DEFAULT '{}',
  sector_filter text[] DEFAULT '{}',
  country_filter text[] DEFAULT '{}',
  -- Financial thresholds
  min_revenue numeric DEFAULT 0,
  max_debt_ratio numeric DEFAULT 100,
  min_margin numeric DEFAULT 0,
  -- Custom criteria as flexible JSON
  custom_criteria jsonb DEFAULT '{}',
  -- Metadata
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.programme_criteria ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage programme criteria
CREATE POLICY "Super admin can select programme_criteria"
  ON public.programme_criteria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can insert programme_criteria"
  ON public.programme_criteria FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can update programme_criteria"
  ON public.programme_criteria FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete programme_criteria"
  ON public.programme_criteria FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Coaches can view active criteria (read-only)
CREATE POLICY "Coaches can view active programme_criteria"
  ON public.programme_criteria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach') AND is_active = true);

-- Auto-update updated_at
CREATE TRIGGER update_programme_criteria_updated_at
  BEFORE UPDATE ON public.programme_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
