
-- Create bp-outputs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bp-outputs', 'bp-outputs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload BP files
CREATE POLICY "Authenticated users can upload BP files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bp-outputs');

-- RLS: authenticated users can read BP files
CREATE POLICY "Authenticated users can read BP files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bp-outputs');
