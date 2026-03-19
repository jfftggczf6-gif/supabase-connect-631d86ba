ALTER TABLE public.enterprises ADD COLUMN IF NOT EXISTS document_content TEXT;
ALTER TABLE public.enterprises ADD COLUMN IF NOT EXISTS document_content_updated_at TIMESTAMPTZ;
ALTER TABLE public.enterprises ADD COLUMN IF NOT EXISTS document_files_count INTEGER DEFAULT 0;