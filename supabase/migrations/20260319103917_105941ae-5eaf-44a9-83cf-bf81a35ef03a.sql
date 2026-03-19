ALTER TABLE public.programme_criteria ADD COLUMN IF NOT EXISTS source_document_url text;
ALTER TABLE public.programme_criteria ADD COLUMN IF NOT EXISTS raw_criteria_text text;