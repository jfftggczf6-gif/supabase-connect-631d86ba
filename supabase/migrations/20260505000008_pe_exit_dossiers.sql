-- ============================================================================
-- Phase G — Préparation sortie & exit (étape 12 du PDF)
-- ============================================================================
-- À horizon 3-7 ans, le fonds prépare la sortie (trade sale / secondary / IPO BRVM).
-- ESONO produit le dossier de sortie : vendor DD interne, scénarios de valorisation,
-- bilan thèse initiale vs réalisé, capitalisation post-exit dans la KB du fonds.
-- ============================================================================

-- Nouveaux stages (extension)

CREATE TYPE pe_exit_scenario AS ENUM (
  'trade_sale',
  'secondary',
  'ipo_brvm',
  'ipo_other',
  'mbo',
  'other'
);

CREATE TYPE pe_exit_status AS ENUM (
  'preparing',
  'in_negotiation',
  'signed',
  'closed',
  'cancelled'
);

CREATE TABLE pe_exit_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Scénario de sortie
  scenario pe_exit_scenario NOT NULL DEFAULT 'trade_sale',
  status pe_exit_status NOT NULL DEFAULT 'preparing',

  -- Valorisation de sortie
  exit_valuation NUMERIC(18, 2),                -- valuation de l'entreprise
  exit_devise TEXT DEFAULT 'EUR',
  fund_proceeds NUMERIC(18, 2),                 -- montant que touche le fonds (= equity_stake_pct × exit_valuation)
  exit_multiple NUMERIC(8, 2),                  -- ex: 2.2x sur le capital initial
  exit_irr NUMERIC(8, 4),                       -- ex: 0.187 (18.7%)
  holding_period_months INT,                    -- durée de portage en mois

  -- Données de sortie multi-scénarios
  scenarios_data JSONB DEFAULT '[]'::JSONB,
    -- Format : [{ name, valuation, multiple, probability, conditions }]

  -- Bilan thèse vs réalisé
  these_initiale TEXT,                          -- ce qu'on avait promis dans le memo IC final
  these_realise TEXT,                           -- ce qui a réellement été accompli
  these_alignment_pct INT,                      -- 0-100 : % de la thèse qui s'est matérialisée
  drivers_de_valeur JSONB DEFAULT '[]'::JSONB,  -- ce qui a marché ('croissance organique', 'expansion régionale'…)
  ratees JSONB DEFAULT '[]'::JSONB,             -- ce qui n'a pas marché

  -- Vendor DD interne (synthèse complète historique)
  vendor_dd_synthesis TEXT,                     -- rédigé par IM ou IA
  vendor_dd_doc_path TEXT,

  -- Acheteurs/contreparties potentiels
  potential_buyers JSONB DEFAULT '[]'::JSONB,
    -- Format : [{ type: 'industriel'|'fonds'|'ipo', name, intérêt, valuation_range }]

  -- Capitalisation post-exit (KB propriétaire alimentée)
  capitalized_in_kb BOOLEAN DEFAULT false,
  capitalization_date TIMESTAMPTZ,

  -- Méta
  prepared_by UUID REFERENCES auth.users(id),
  signed_at DATE,
  closed_at DATE,
  ai_generated_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pe_exit_org ON pe_exit_dossiers(organization_id);
CREATE INDEX idx_pe_exit_status ON pe_exit_dossiers(status);

CREATE TRIGGER trg_pe_exit_dossiers_updated_at
  BEFORE UPDATE ON pe_exit_dossiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pe_exit_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY pe_exit_select ON pe_exit_dossiers FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

CREATE POLICY pe_exit_modify ON pe_exit_dossiers FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_exit_dossiers.organization_id
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
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_exit_dossiers.organization_id
        AND om.role IN ('owner', 'admin', 'manager') AND om.is_active
    )
  )
);

COMMENT ON TABLE pe_exit_dossiers IS 'Dossier de sortie d''une participation : scénarios, valorisation, vendor DD, bilan thèse';
COMMENT ON COLUMN pe_exit_dossiers.these_alignment_pct IS '% de la thèse initiale qui s''est matérialisée — 0=raté, 100=parfait';
