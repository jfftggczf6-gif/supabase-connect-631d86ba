-- ============================================================================
-- Phase G — Reporting LPs (Limited Partners)
-- ============================================================================
-- Génération de rapports périodiques destinés aux LPs (investisseurs du fonds) :
--   - Format 'participation' : fiche d'une participation (KPIs, NAV, IRR, MOIC, faits marquants, risques)
--   - Format 'portfolio' : agrégat fonds (NAV totale, IRR net, TVPI, DPI, performance secteur/pays, sorties prévues)
--
-- Permet aux IM de générer 1 jeu de données → 3 exports formats différents
-- (note interne, board pack, reporting LP) — adresse "le reformatage sans fin".
-- ============================================================================

CREATE TYPE pe_lp_report_format AS ENUM ('participation', 'portfolio');
CREATE TYPE pe_lp_report_status AS ENUM ('draft', 'finalized', 'sent');

CREATE TABLE pe_lp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- deal_id NULLABLE : NULL = rapport portfolio agrégé, sinon participation spécifique
  deal_id UUID REFERENCES pe_deals(id) ON DELETE CASCADE,
  format pe_lp_report_format NOT NULL,
  period TEXT NOT NULL,                  -- 'Q1-2026' ou 'H1-2026' ou '2026'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status pe_lp_report_status NOT NULL DEFAULT 'draft',
  -- Données structurées du rapport (snapshot à la finalisation)
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Liste des destinataires (emails LPs)
  sent_to TEXT[] DEFAULT '{}'::TEXT[],
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  -- Lien vers le doc généré (PDF/PPTX) si rendu effectué
  rendered_doc_path TEXT,
  rendered_doc_format TEXT,              -- 'pdf' | 'pptx' | 'xlsx'
  -- Notes internes
  notes TEXT,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pe_lp_reports_org ON pe_lp_reports(organization_id, period_end DESC);
CREATE INDEX idx_pe_lp_reports_deal ON pe_lp_reports(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_pe_lp_reports_status ON pe_lp_reports(status);

CREATE TRIGGER trg_pe_lp_reports_updated_at
  BEFORE UPDATE ON pe_lp_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pe_lp_reports ENABLE ROW LEVEL SECURITY;

-- Lecture : tous membres actifs de l'org
CREATE POLICY pe_lp_reports_select ON pe_lp_reports FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

-- Modify : owner/admin/manager (les analystes ne pilotent pas le reporting LP)
CREATE POLICY pe_lp_reports_modify ON pe_lp_reports FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_lp_reports.organization_id
        AND om.role IN ('owner', 'admin', 'manager') AND om.is_active
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_lp_reports.organization_id
        AND om.role IN ('owner', 'admin', 'manager') AND om.is_active
    )
  )
);

COMMENT ON TABLE pe_lp_reports IS 'Rapports périodiques pour les LPs du fonds (par participation ou portefeuille agrégé).';
