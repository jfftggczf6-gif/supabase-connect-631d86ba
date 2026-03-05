
-- Drop existing policies and recreate with simpler approach
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- Simpler RLS: authenticated users can upload to documents bucket
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can read documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can update documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents');
