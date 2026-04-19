-- S3: Rewrite storage policies for organization isolation
-- CRITICAL: Current policies allow ANY authenticated user to access ALL files

-- Drop overly permissive policies on 'documents' bucket
DO $$
BEGIN
  -- Drop all existing policies on storage.objects for documents bucket
  DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can read documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

  RAISE NOTICE 'Dropped all old storage policies';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some policies did not exist — continuing';
END $$;

-- New policies: users can only access files in their organization's path
-- Path pattern: documents/{enterprise_id}/... or {org_id}/...
-- We check enterprise membership via is_coach_of_enterprise or enterprise ownership

-- SELECT: user can read files of enterprises they own, coach, or are org members of
CREATE POLICY "org_read_documents" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'documents' AND (
      -- Super admin sees all
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      -- Or user has access to the enterprise (via path: first segment = enterprise_id)
      OR EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id::text = (storage.foldername(name))[1]
        AND (
          e.user_id = auth.uid()
          OR public.is_coach_of_enterprise(e.id)
          OR public.is_member_of(e.organization_id)
        )
      )
    )
  );

-- INSERT: same logic
CREATE POLICY "org_insert_documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'documents' AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id::text = (storage.foldername(name))[1]
        AND (
          e.user_id = auth.uid()
          OR public.is_coach_of_enterprise(e.id)
          OR public.is_member_of(e.organization_id)
        )
      )
    )
  );

-- UPDATE: same
CREATE POLICY "org_update_documents" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'documents' AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id::text = (storage.foldername(name))[1]
        AND (
          e.user_id = auth.uid()
          OR public.is_coach_of_enterprise(e.id)
          OR public.is_member_of(e.organization_id)
        )
      )
    )
  );

-- DELETE: only owner or super_admin
CREATE POLICY "org_delete_documents" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'documents' AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id::text = (storage.foldername(name))[1]
        AND e.user_id = auth.uid()
      )
    )
  );

-- Policies for other buckets (coaching-files, templates, exports)
-- coaching-files: coach can access their own uploads
CREATE POLICY "coach_read_coaching_files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'coaching-files' AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id::text = (storage.foldername(name))[1]
        AND (
          e.user_id = auth.uid()
          OR public.is_coach_of_enterprise(e.id)
          OR public.is_member_of(e.organization_id)
        )
      )
    )
  );

CREATE POLICY "coach_insert_coaching_files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'coaching-files' AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id::text = (storage.foldername(name))[1]
        AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
      )
    )
  );

-- templates: read-only for authenticated, write for super_admin
CREATE POLICY "read_templates" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'templates');

CREATE POLICY "write_templates" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'templates' AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
