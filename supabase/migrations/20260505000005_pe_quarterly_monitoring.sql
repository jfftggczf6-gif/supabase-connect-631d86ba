-- ============================================================================
-- Phase G — Monitoring trimestriel (post-closing, 3-7 ans)
-- ============================================================================
-- Outil de pilotage continu :
--   - pe_quarterly_reports : données envoyées par l'entrepreneur chaque trimestre
--   - pe_score_history : évolution du scoring 6 dimensions sur courbe temporelle
--   - pe_alert_signals : signaux d'alerte auto-générés (seuils breached vs projections)
-- ============================================================================

CREATE TYPE pe_alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE pe_alert_category AS ENUM (
  'financier', 'operationnel', 'commercial', 'rh',
  'gouvernance', 'esg', 'compliance', 'autre'
);

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Rapports trimestriels reçus de la cible
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE pe_quarterly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,              -- 'Q1-2026', 'Q2-2026', 'H1-2026', '2026'…
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pnl_data JSONB DEFAULT '{}'::JSONB,    -- CA, EBITDA, RN, marges, etc.
  bilan_data JSONB DEFAULT '{}'::JSONB,  -- actifs, dettes, FP, BFR
  kpi_data JSONB DEFAULT '{}'::JSONB,    -- effectifs, clients, retention, etc.
  narrative TEXT,                         -- commentaire libre dirigeant/IM
  source TEXT DEFAULT 'manual',           -- 'manual' | 'upload' | 'integration'
  uploaded_doc_id UUID REFERENCES pe_deal_documents(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by UUID REFERENCES auth.users(id),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, period)
);

CREATE INDEX idx_pe_qr_deal_period ON pe_quarterly_reports(deal_id, period_end DESC);
CREATE INDEX idx_pe_qr_org ON pe_quarterly_reports(organization_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Historique du scoring 6 dimensions (recalculé à chaque rapport)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE pe_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  period_end DATE NOT NULL,
  score_total INT,                        -- 0-100
  score_financier INT,
  score_marche INT,
  score_management INT,
  score_gouvernance INT,
  score_modele INT,
  score_esg INT,
  delta_vs_previous INT,                  -- delta vs trimestre N-1
  delta_vs_entry INT,                     -- delta vs valeur d'entrée
  drivers JSONB DEFAULT '{}'::JSONB,      -- raisons du changement
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, period)
);

CREATE INDEX idx_pe_score_deal_period ON pe_score_history(deal_id, period_end);

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Signaux d'alerte auto-générés
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE pe_alert_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quarterly_report_id UUID REFERENCES pe_quarterly_reports(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  severity pe_alert_severity NOT NULL DEFAULT 'warning',
  category pe_alert_category NOT NULL DEFAULT 'financier',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  threshold_label TEXT,                   -- 'EBITDA < 80% projection'
  actual_value NUMERIC,
  expected_value NUMERIC,
  delta_pct NUMERIC,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pe_alerts_deal_open ON pe_alert_signals(deal_id, raised_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_pe_alerts_org ON pe_alert_signals(organization_id, severity);

-- ───────────────────────────────────────────────────────────────────────────
-- Triggers updated_at
-- ───────────────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_pe_quarterly_reports_updated_at
  BEFORE UPDATE ON pe_quarterly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — tous membres actifs en lecture, modify pour analyste/IM/MD
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE pe_quarterly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe_alert_signals ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY pe_qr_select ON pe_quarterly_reports FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

CREATE POLICY pe_score_select ON pe_score_history FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

CREATE POLICY pe_alerts_select ON pe_alert_signals FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

-- INSERT/UPDATE/DELETE — analyste, IM, MD, owner, admin
CREATE POLICY pe_qr_modify ON pe_quarterly_reports FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_quarterly_reports.organization_id
        AND om.is_active
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_quarterly_reports.organization_id
        AND om.is_active
    )
  )
);

CREATE POLICY pe_alerts_modify ON pe_alert_signals FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_alert_signals.organization_id
        AND om.is_active
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_alert_signals.organization_id
        AND om.is_active
    )
  )
);

COMMENT ON TABLE pe_quarterly_reports IS 'Rapports trimestriels (PnL, bilan, KPI) reçus de la cible post-investissement.';
COMMENT ON TABLE pe_score_history IS 'Historique scoring 6 dimensions sur la durée du portage. Alimente les courbes monitoring.';
COMMENT ON TABLE pe_alert_signals IS 'Signaux d''alerte auto-générés à partir des rapports trimestriels (seuils breached).';
