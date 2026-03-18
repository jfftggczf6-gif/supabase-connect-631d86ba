
DO $$ BEGIN
  CREATE TYPE public.operating_mode AS ENUM ('reconstruction', 'due_diligence');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.enterprises
  ADD COLUMN IF NOT EXISTS operating_mode public.operating_mode,
  ADD COLUMN IF NOT EXISTS data_room_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_room_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS enterprises_data_room_slug_idx
  ON public.enterprises (data_room_slug)
  WHERE data_room_slug IS NOT NULL;
