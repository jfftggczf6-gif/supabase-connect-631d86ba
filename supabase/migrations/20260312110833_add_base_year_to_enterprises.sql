-- C6: Freeze base_year at enterprise creation
-- base_year is the reference year for all financial projections.
-- It must NOT change across regenerations so year labels remain stable.

ALTER TABLE public.enterprises
  ADD COLUMN IF NOT EXISTS base_year INTEGER;

-- Backfill existing rows: derive base_year from creation_date if available,
-- otherwise from created_at timestamp
UPDATE public.enterprises
SET base_year = COALESCE(
  EXTRACT(YEAR FROM creation_date)::INTEGER,
  EXTRACT(YEAR FROM created_at)::INTEGER
)
WHERE base_year IS NULL;

-- For new enterprises, automatically set base_year from created_at
CREATE OR REPLACE FUNCTION public.set_enterprise_base_year()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.base_year IS NULL THEN
    NEW.base_year := EXTRACT(YEAR FROM now())::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_enterprise_base_year ON public.enterprises;
CREATE TRIGGER trg_set_enterprise_base_year
  BEFORE INSERT ON public.enterprises
  FOR EACH ROW EXECUTE FUNCTION public.set_enterprise_base_year();
