-- OVO Intelligence: new deliverable types + enterprise columns
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction

-- New deliverable types (each statement must be separate)
DO $$ BEGIN
  ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'compliance_report';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'ic_decision_report';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'risk_matrix';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'pre_ci_checklist';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- New columns on enterprises for programme manager features
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprises' AND column_name = 'score_ir_breakdown') THEN
    ALTER TABLE public.enterprises ADD COLUMN score_ir_breakdown jsonb DEFAULT NULL;
    COMMENT ON COLUMN public.enterprises.score_ir_breakdown IS 'IR score decomposed by OVO categories: operational, management, communication, market, financial, compliance';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprises' AND column_name = 'compliance_status') THEN
    ALTER TABLE public.enterprises ADD COLUMN compliance_status text DEFAULT NULL;
    COMMENT ON COLUMN public.enterprises.compliance_status IS 'pending | in_review | validated | rejected';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprises' AND column_name = 'odd_baseline') THEN
    ALTER TABLE public.enterprises ADD COLUMN odd_baseline jsonb DEFAULT NULL;
    COMMENT ON COLUMN public.enterprises.odd_baseline IS 'Snapshot of ODD analysis at programme intake for Y-o-Y comparison';
  END IF;
END $$;
