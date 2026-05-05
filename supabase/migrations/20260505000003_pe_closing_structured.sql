-- ============================================================================
-- Phase F — Closing structuré (term sheet + décaissements en tranches)
-- ============================================================================
-- Avant : transition stage → closing était un simple changement d'état.
-- Maintenant : structure complète du closing pour suivre le décaissement
-- en plusieurs tranches avec leurs conditions.
-- ============================================================================

CREATE TYPE pe_tranche_status AS ENUM ('pending', 'released', 'blocked', 'cancelled');

CREATE TABLE pe_term_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signed_at DATE,
  total_amount NUMERIC(18,2),
  devise TEXT DEFAULT 'EUR',
  equity_stake_pct NUMERIC(5,2),  -- ex 22.50 = 22.5%
  pre_money_valuation NUMERIC(18,2),
  post_money_valuation NUMERIC(18,2),
  governance_seats INT,
  liquidation_preference TEXT,
  anti_dilution TEXT,
  drag_along BOOLEAN,
  tag_along BOOLEAN,
  vesting_terms TEXT,
  notes TEXT,
  pacte_doc_path TEXT,  -- chemin storage du pacte d'actionnaires signé
  termsheet_doc_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pe_disbursement_tranches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tranche_number INT NOT NULL,        -- 1, 2, 3…
  amount NUMERIC(18,2) NOT NULL,
  devise TEXT DEFAULT 'EUR',
  scheduled_date DATE,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id),
  conditions TEXT[] DEFAULT '{}'::TEXT[],   -- conditions à remplir avant release
  conditions_met BOOLEAN DEFAULT false,
  status pe_tranche_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, tranche_number)
);

CREATE INDEX idx_pe_term_sheets_org ON pe_term_sheets(organization_id);
CREATE INDEX idx_pe_disbursement_tranches_deal ON pe_disbursement_tranches(deal_id);
CREATE INDEX idx_pe_disbursement_tranches_status ON pe_disbursement_tranches(status, scheduled_date);

-- Triggers updated_at
CREATE TRIGGER trg_pe_term_sheets_updated_at
  BEFORE UPDATE ON pe_term_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pe_disbursement_tranches_updated_at
  BEFORE UPDATE ON pe_disbursement_tranches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE pe_term_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe_disbursement_tranches ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre actif de l'org
CREATE POLICY pe_term_sheets_select ON pe_term_sheets FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

CREATE POLICY pe_disbursement_tranches_select ON pe_disbursement_tranches FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

-- Insert/Update : owner/admin/manager (les analystes ne touchent pas le closing)
CREATE POLICY pe_term_sheets_modify ON pe_term_sheets FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_term_sheets.organization_id
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
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_term_sheets.organization_id
        AND om.role IN ('owner', 'admin', 'manager') AND om.is_active
    )
  )
);

CREATE POLICY pe_disbursement_tranches_modify ON pe_disbursement_tranches FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_disbursement_tranches.organization_id
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
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_disbursement_tranches.organization_id
        AND om.role IN ('owner', 'admin', 'manager') AND om.is_active
    )
  )
);

COMMENT ON TABLE pe_term_sheets IS 'Term sheet signé du closing (1 par deal max).';
COMMENT ON TABLE pe_disbursement_tranches IS 'Tranches de décaissement avec conditions.';
