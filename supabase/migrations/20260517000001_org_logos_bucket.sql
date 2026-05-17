-- 20260517000001_org_logos_bucket.sql
-- Bucket public org_logos pour les logos des fonds/orgs BA (feature parametres_ba).
-- Path convention : {organization_id}/logo.{ext}
-- Public car logos affichés dans interfaces et exports (teaser, IM) sans auth.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org_logos',
  'org_logos',
  true,
  2 * 1024 * 1024,  -- 2 MB max
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- SELECT : public (bucket public)
-- INSERT / UPDATE / DELETE : owner / admin / managing_director de l'org
DROP POLICY IF EXISTS "org_logos_owner_insert" ON storage.objects;
CREATE POLICY "org_logos_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org_logos'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'managing_director')
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "org_logos_owner_update" ON storage.objects;
CREATE POLICY "org_logos_owner_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'org_logos'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'managing_director')
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "org_logos_owner_delete" ON storage.objects;
CREATE POLICY "org_logos_owner_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org_logos'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'managing_director')
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
    )
  );

COMMENT ON POLICY "org_logos_owner_insert" ON storage.objects IS
  'BA parametres_ba : seuls owner/admin/MD de l''org peuvent uploader le logo.';
