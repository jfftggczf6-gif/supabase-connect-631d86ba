-- Phase B' Step 2 — Documents uploadés sur les deals PE + Storage bucket

-- 1) Table pe_deal_documents
CREATE TABLE IF NOT EXISTS pe_deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes BIGINT,
  category TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_deal_documents_deal_id
  ON pe_deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_pe_deal_documents_org_recent
  ON pe_deal_documents(organization_id, created_at DESC);

-- 2) RLS
ALTER TABLE pe_deal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_deal_documents_select"
  ON pe_deal_documents FOR SELECT
  USING (can_see_pe_deal(deal_id, auth.uid()));

CREATE POLICY "pe_deal_documents_insert"
  ON pe_deal_documents FOR INSERT
  WITH CHECK (can_see_pe_deal(deal_id, auth.uid()));

CREATE POLICY "pe_deal_documents_delete"
  ON pe_deal_documents FOR DELETE
  USING (can_see_pe_deal(deal_id, auth.uid()));

-- 3) Storage bucket privé pour les docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pe_deal_docs', 'pe_deal_docs', false)
ON CONFLICT (id) DO NOTHING;

-- 4) Storage RLS : path pattern <org_id>/<deal_id>/<filename>
DROP POLICY IF EXISTS "pe_deal_docs_select" ON storage.objects;
CREATE POLICY "pe_deal_docs_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pe_deal_docs'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('managing_director', 'investment_manager', 'analyste', 'analyst', 'admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "pe_deal_docs_insert" ON storage.objects;
CREATE POLICY "pe_deal_docs_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pe_deal_docs'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('managing_director', 'investment_manager', 'analyste', 'analyst', 'admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "pe_deal_docs_delete" ON storage.objects;
CREATE POLICY "pe_deal_docs_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pe_deal_docs'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('managing_director', 'investment_manager', 'analyste', 'analyst', 'admin', 'owner')
    )
  );
