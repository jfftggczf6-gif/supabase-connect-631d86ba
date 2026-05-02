-- Phase E.10' — Bucket pe_org_templates pour stocker les templates par org
-- Path pattern : <org_id>/<filename> — ex: 55555555-..../memo_ic1.docx
-- Path pattern fallback : _default/<filename> — bundlés dans le service esono-render
-- Le service esono-render lit en priorité le path org-specific, puis fallback _default.

INSERT INTO storage.buckets (id, name, public)
VALUES ('pe_org_templates', 'pe_org_templates', false)
ON CONFLICT (id) DO NOTHING;

-- ═══ RLS ═══
-- SELECT : tout membre actif d'une org peut lire les templates de son org
--          + tout user authentifié peut lire _default (templates ESONO bundlés)
DROP POLICY IF EXISTS "pe_org_templates_select" ON storage.objects;
CREATE POLICY "pe_org_templates_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pe_org_templates'
    AND (
      SPLIT_PART(name, '/', 1) = '_default'
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.is_active = true
          AND om.organization_id::text = SPLIT_PART(name, '/', 1)
      )
    )
  );

-- INSERT : seuls owner/admin/managing_director d'une org peuvent uploader
--          des templates pour leur org. _default est réservé au service role
--          (déploiement initial via script).
DROP POLICY IF EXISTS "pe_org_templates_insert" ON storage.objects;
CREATE POLICY "pe_org_templates_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pe_org_templates'
    AND SPLIT_PART(name, '/', 1) <> '_default'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('owner', 'admin', 'managing_director')
    )
  );

-- UPDATE : pareil INSERT
DROP POLICY IF EXISTS "pe_org_templates_update" ON storage.objects;
CREATE POLICY "pe_org_templates_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pe_org_templates'
    AND SPLIT_PART(name, '/', 1) <> '_default'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('owner', 'admin', 'managing_director')
    )
  );

-- DELETE : pareil
DROP POLICY IF EXISTS "pe_org_templates_delete" ON storage.objects;
CREATE POLICY "pe_org_templates_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pe_org_templates'
    AND SPLIT_PART(name, '/', 1) <> '_default'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('owner', 'admin', 'managing_director')
    )
  );

