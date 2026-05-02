-- Phase E.10 — Section Valuation dédiée
-- Une table pe_valuation par deal (UPSERT) qui contient l'analyse de valuation
-- détaillée selon 3 méthodes (DCF, multiples, ANCC) + synthèse pondérée.
-- Le memo investment_thesis reste la vue executive ; pe_valuation est la source
-- de vérité full-detail. Quand on régénère, on sync le content_json du memo.

CREATE TABLE IF NOT EXISTS pe_valuation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- ═══ DCF ═══
  -- dcf_inputs : { wacc, terminal_growth_rate, tax_rate, beta, risk_free_rate,
  --                equity_risk_premium, cost_of_debt, debt_to_capital, currency }
  dcf_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- dcf_projections : [ { year, revenue, ebitda, ebit, capex, nwc_change, fcf } ] × 7
  dcf_projections jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- dcf_terminal : { method (gordon|exit_multiple), tv, pv_tv, exit_multiple, exit_year }
  dcf_terminal jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- dcf_outputs : { enterprise_value, net_debt, minority_interests, equity_value,
  --                 sensitivity_matrix (rows=wacc, cols=g, values=ev),
  --                 wacc_axis, g_axis }
  dcf_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- ═══ MULTIPLES ═══
  -- multiples_comparables : [ { company, country, sector, source_year,
  --                             ev_ebitda, ev_sales, pe, ev_local, currency } ]
  multiples_comparables jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- multiples_outputs : { selected_ev_ebitda, selected_ev_sales, selected_pe,
  --                       ebitda_year_n, revenue_year_n, ev_from_ebitda, ev_from_sales,
  --                       blended_ev, justification }
  multiples_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- ═══ ANCC (Actif Net Comptable Corrigé) ═══
  -- ancc_assets : [ { label, book_value, adjustment, adjusted_value, note } ]
  ancc_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ancc_liabilities : [ { label, book_value, adjustment, adjusted_value, note } ]
  ancc_liabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ancc_outputs : { total_assets_adjusted, total_liabilities_adjusted, anc_corrected, justification }
  ancc_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- ═══ SYNTHÈSE ═══
  -- synthesis : { weights: { dcf, multiples, ancc },  // somme = 1.0
  --               method_evs: { dcf, multiples, ancc },
  --               weighted_ev,
  --               range: { bear, base, bull },
  --               pre_money_recommended, post_money_recommended,
  --               ticket_recommended, equity_stake_pct,
  --               moic_bear, moic_base, moic_bull,
  --               irr_bear, irr_base, irr_bull,
  --               exit_horizon_years,
  --               justification }
  synthesis jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- ═══ MÉTA ═══
  ai_justification text,                         -- résumé global de la valuation par l'IA
  currency text DEFAULT 'FCFA',                  -- devise des montants
  status text NOT NULL DEFAULT 'draft',          -- draft | ready | error
  error_message text,
  generated_at timestamptz,
  generated_by_user_id uuid REFERENCES auth.users(id),
  generated_by_agent text,                       -- ex: 'managing_director'

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pe_valuation_deal_unique UNIQUE (deal_id),
  CONSTRAINT pe_valuation_status_check CHECK (status IN ('draft', 'generating', 'ready', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_pe_valuation_org ON pe_valuation(organization_id);
CREATE INDEX IF NOT EXISTS idx_pe_valuation_deal ON pe_valuation(deal_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_pe_valuation_updated_at ON pe_valuation;
CREATE TRIGGER trg_pe_valuation_updated_at
  BEFORE UPDATE ON pe_valuation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══ RLS ═══
ALTER TABLE pe_valuation ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre actif qui voit le deal
CREATE POLICY "pe_valuation_select" ON pe_valuation
  FOR SELECT USING (can_see_pe_deal(deal_id, auth.uid()));

CREATE POLICY "pe_valuation_insert" ON pe_valuation
  FOR INSERT WITH CHECK (
    can_see_pe_deal(deal_id, auth.uid())
    AND organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

CREATE POLICY "pe_valuation_update" ON pe_valuation
  FOR UPDATE USING (can_see_pe_deal(deal_id, auth.uid()));

CREATE POLICY "pe_valuation_delete" ON pe_valuation
  FOR DELETE USING (
    can_see_pe_deal(deal_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = pe_valuation.organization_id
        AND om.is_active = true
        AND om.role IN ('owner', 'admin', 'managing_director')
    )
  );

COMMENT ON TABLE pe_valuation IS
  'Valuation détaillée par deal (1 row, UPSERT). Source de vérité pour DCF/multiples/ANCC/synthèse. Le memo investment_thesis reste la vue executive ; il est synced quand pe_valuation est régénéré.';
COMMENT ON COLUMN pe_valuation.dcf_outputs IS
  'enterprise_value + sensitivity_matrix WACC×g. Format matrix: { wacc_axis: [%], g_axis: [%], values: [[...]] }';
COMMENT ON COLUMN pe_valuation.synthesis IS
  'Pondération des 3 méthodes + EV synthétique + scénarios bear/base/bull + MOIC/IRR. Sert à mettre à jour la section investment_thesis du memo.';
