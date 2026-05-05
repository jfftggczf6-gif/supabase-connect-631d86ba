-- ============================================================================
-- Phase G — Valorisation périodique (NAV) post-closing
-- ============================================================================
-- Recalcule la valorisation de chaque participation à intervalles réguliers
-- (semestriel ou annuel) avec les données réelles du monitoring (vs projections).
-- Standards IPEV pour la NAV.
-- ============================================================================

CREATE TABLE pe_periodic_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                -- 'H1-2026', '2026-FY', etc.
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  devise TEXT NOT NULL DEFAULT 'EUR',

  -- DCF recalculé avec données réelles
  dcf_inputs JSONB DEFAULT '{}'::JSONB,
  dcf_outputs JSONB DEFAULT '{}'::JSONB,

  -- Multiples comparables actualisés
  multiples_comparables JSONB DEFAULT '[]'::JSONB,
  multiples_outputs JSONB DEFAULT '{}'::JSONB,

  -- ANCC (Actif Net Comptable Corrigé)
  ancc_outputs JSONB DEFAULT '{}'::JSONB,

  -- NAV finale (avec pondération)
  nav_amount NUMERIC(18, 2),
  nav_method TEXT,                     -- 'dcf' | 'multiples' | 'weighted' | 'ancc' | 'cost'
  weighting JSONB,                     -- ex: { dcf: 0.5, multiples: 0.35, ancc: 0.15 }

  -- Comparaisons
  comparison_entry JSONB,              -- vs valuation d'entrée (ticket)
  comparison_n_minus_1 JSONB,          -- vs période précédente

  -- Bridge de valeur (waterfall : ce qui a changé)
  bridge_de_valeur JSONB,
    -- Format attendu : [
    --   { item: 'Croissance CA', impact_pct: 18, amount: 50000000 },
    --   { item: 'Amélioration marge', impact_pct: 5, amount: 14000000 },
    --   { item: 'Multiple expansion', impact_pct: -10, amount: -28000000 },
    -- ]

  -- Metrics financiers à date
  moic_to_date NUMERIC(8, 2),          -- ex 1.45 (= 145% du capital initial)
  irr_to_date NUMERIC(8, 4),           -- ex 0.187 (= 18.7%)
  tvpi NUMERIC(8, 2),                  -- Total Value to Paid-In
  dpi NUMERIC(8, 2),                   -- Distribution to Paid-In (pour participations avec sortie partielle)
  rvpi NUMERIC(8, 2),                  -- Residual Value to Paid-In

  -- Méthodologie + commentaires
  methodology_notes TEXT,              -- ex: "Conforme IPEV guidelines section 5"
  ai_justification TEXT,
  computed_by UUID REFERENCES auth.users(id),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, period)
);

CREATE INDEX idx_pe_pv_deal ON pe_periodic_valuations(deal_id, period_end);
CREATE INDEX idx_pe_pv_org ON pe_periodic_valuations(organization_id);

CREATE TRIGGER trg_pe_pv_updated_at
  BEFORE UPDATE ON pe_periodic_valuations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pe_periodic_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pe_pv_select ON pe_periodic_valuations FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

CREATE POLICY pe_pv_modify ON pe_periodic_valuations FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_periodic_valuations.organization_id
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
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_periodic_valuations.organization_id
        AND om.role IN ('owner', 'admin', 'manager') AND om.is_active
    )
  )
);

COMMENT ON TABLE pe_periodic_valuations IS 'Valorisations périodiques (NAV) recalculées à partir des données réelles du monitoring. Conforme IPEV.';
COMMENT ON COLUMN pe_periodic_valuations.bridge_de_valeur IS 'Waterfall expliquant l''évolution de valeur depuis l''entrée ou la période précédente.';
COMMENT ON COLUMN pe_periodic_valuations.tvpi IS 'Total Value to Paid-In (NAV + distributions) / capital initial';
