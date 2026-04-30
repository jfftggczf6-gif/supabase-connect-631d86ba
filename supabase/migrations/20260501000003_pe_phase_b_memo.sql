-- Phase B' Step 3 — Living document: investment_memos, memo_versions, memo_sections

-- 1) Enum pour les codes des 12 sections fixes
DO $$ BEGIN
  CREATE TYPE memo_section_code AS ENUM (
    'executive_summary',
    'shareholding_governance',
    'top_management',
    'services',
    'competition_market',
    'unit_economics',
    'financials_pnl',
    'financials_balance',
    'investment_thesis',
    'support_requested',
    'esg_risks',
    'annexes'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Enum pour le statut d'une version
DO $$ BEGIN
  CREATE TYPE memo_version_status AS ENUM (
    'generating', 'ready', 'validated', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3) investment_memos : 1 row par deal, conteneur immortel
CREATE TABLE IF NOT EXISTS investment_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES pe_deals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4) memo_versions : snapshots versionnés
CREATE TABLE IF NOT EXISTS memo_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES investment_memos(id) ON DELETE CASCADE,
  parent_version_id UUID REFERENCES memo_versions(id),
  label TEXT NOT NULL,
  stage pe_deal_stage NOT NULL,
  status memo_version_status NOT NULL DEFAULT 'generating',
  overall_score NUMERIC,
  classification TEXT,
  error_message TEXT,
  generated_by_agent TEXT,
  generated_by_user_id UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memo_versions_unique_label UNIQUE(memo_id, label)
);
CREATE INDEX IF NOT EXISTS idx_memo_versions_memo_recent
  ON memo_versions(memo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_versions_stage_status
  ON memo_versions(stage, status);

-- 5) memo_sections : contenu riche, 12 par version
CREATE TABLE IF NOT EXISTS memo_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES memo_versions(id) ON DELETE CASCADE,
  section_code memo_section_code NOT NULL,
  title TEXT,
  content_md TEXT,
  content_json JSONB,
  source_doc_ids UUID[] DEFAULT '{}',
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memo_sections_unique_code UNIQUE(version_id, section_code)
);
CREATE INDEX IF NOT EXISTS idx_memo_sections_version
  ON memo_sections(version_id);

-- 6) Trigger updated_at sur memo_sections
CREATE OR REPLACE FUNCTION set_memo_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memo_sections_updated_at ON memo_sections;
CREATE TRIGGER trg_memo_sections_updated_at
  BEFORE UPDATE ON memo_sections
  FOR EACH ROW
  EXECUTE FUNCTION set_memo_sections_updated_at();

-- 7) RLS
ALTER TABLE investment_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investment_memos_select"
  ON investment_memos FOR SELECT
  USING (can_see_pe_deal(deal_id, auth.uid()));

ALTER TABLE memo_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memo_versions_select"
  ON memo_versions FOR SELECT
  USING (
    memo_id IN (
      SELECT id FROM investment_memos WHERE can_see_pe_deal(deal_id, auth.uid())
    )
  );

ALTER TABLE memo_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memo_sections_select"
  ON memo_sections FOR SELECT
  USING (
    version_id IN (
      SELECT mv.id FROM memo_versions mv
      JOIN investment_memos im ON im.id = mv.memo_id
      WHERE can_see_pe_deal(im.deal_id, auth.uid())
    )
  );

-- 8) Comments doc
COMMENT ON TABLE investment_memos IS 'Conteneur dossier d''investissement PE — 1 par deal, créé à la 1ère génération.';
COMMENT ON TABLE memo_versions IS 'Snapshots versionnés du living document. 1 nouvelle version à chaque transition de stage IA.';
COMMENT ON TABLE memo_sections IS 'Les 12 sections fixes du dossier, attachées à une version.';
COMMENT ON COLUMN memo_versions.overall_score IS 'Score global 0-100 (1 seul score affiché — le scoring multi-dim est Phase F'').';
