-- Phase E' — Module Due Diligence
-- Tables pour le workflow DD : checklist items à vérifier + findings (problèmes/confirmations).
-- La DD vient ENRICHIR le memo (living document) — les findings ont impacts_section_codes
-- qui pointent vers les sections du memo qui doivent être mises à jour.

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE pe_dd_category AS ENUM (
    'financier',     -- audit états financiers, retraitements, BFR
    'juridique',     -- statuts, contrats, IP, contentieux, conformité OHADA
    'commercial',    -- CRM, contrats clients, concentration, pipeline
    'operationnel',  -- production, supply chain, capacités, certifications
    'rh',            -- équipe, contrats CDI, masse salariale, conventions collectives
    'esg',           -- environnement, social, gouvernance, ODD
    'fiscal',        -- audit fiscal, IS/TVA/CFE, conventions internationales
    'it'             -- systèmes IT, cybersécurité, RGPD
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pe_dd_severity AS ENUM ('Critical', 'High', 'Medium', 'Low');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pe_dd_checklist_status AS ENUM ('pending', 'verified', 'red_flag', 'na');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pe_dd_finding_status AS ENUM ('open', 'mitigated', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Table checklist DD : items à vérifier (project management view)
CREATE TABLE IF NOT EXISTS pe_dd_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  category pe_dd_category NOT NULL,
  item_label TEXT NOT NULL,
  item_description TEXT,
  status pe_dd_checklist_status NOT NULL DEFAULT 'pending',
  responsable_user_id UUID REFERENCES auth.users(id),
  due_date DATE,
  evidence_doc_ids UUID[] NOT NULL DEFAULT '{}',  -- liens vers pe_deal_documents
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  verification_note TEXT,
  position INTEGER NOT NULL DEFAULT 0,             -- ordre d'affichage dans la catégorie
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_dd_checklist_deal ON pe_dd_checklist(deal_id);
CREATE INDEX IF NOT EXISTS idx_pe_dd_checklist_status ON pe_dd_checklist(status, deal_id);
CREATE INDEX IF NOT EXISTS idx_pe_dd_checklist_category ON pe_dd_checklist(deal_id, category);

-- 3) Table findings DD : problèmes ou confirmations découverts
CREATE TABLE IF NOT EXISTS pe_dd_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  category pe_dd_category NOT NULL,
  severity pe_dd_severity NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recommendation TEXT,
  -- Quelles sections du memo seront impactées par ce finding
  -- (codes parmi : executive_summary, shareholding_governance, top_management,
  -- services, competition_market, unit_economics, financials_pnl, financials_balance,
  -- investment_thesis, support_requested, esg_risks, annexes)
  impacts_section_codes TEXT[] NOT NULL DEFAULT '{}',
  -- Lien optionnel à un item de checklist qui a déclenché ce finding
  related_checklist_id UUID REFERENCES pe_dd_checklist(id) ON DELETE SET NULL,
  -- Pièces probantes
  evidence_doc_ids UUID[] NOT NULL DEFAULT '{}',
  status pe_dd_finding_status NOT NULL DEFAULT 'open',
  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  -- Quand ce finding a été poussé dans le memo (sinon NULL)
  applied_to_memo_at TIMESTAMPTZ,
  applied_to_memo_by UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  -- 'ai' = généré automatiquement, 'manual' = ajouté par un user
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_dd_findings_deal ON pe_dd_findings(deal_id);
CREATE INDEX IF NOT EXISTS idx_pe_dd_findings_status ON pe_dd_findings(status, deal_id);
CREATE INDEX IF NOT EXISTS idx_pe_dd_findings_severity ON pe_dd_findings(severity, deal_id);
CREATE INDEX IF NOT EXISTS idx_pe_dd_findings_category ON pe_dd_findings(deal_id, category);

-- 4) RLS sur pe_dd_checklist
ALTER TABLE pe_dd_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_dd_checklist_select"
  ON pe_dd_checklist FOR SELECT
  USING (can_see_pe_deal(deal_id, auth.uid()));

CREATE POLICY "pe_dd_checklist_insert"
  ON pe_dd_checklist FOR INSERT
  WITH CHECK (
    can_see_pe_deal(deal_id, auth.uid())
    AND organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

CREATE POLICY "pe_dd_checklist_update"
  ON pe_dd_checklist FOR UPDATE
  USING (can_see_pe_deal(deal_id, auth.uid()));

-- DELETE réservé MD/admin/owner (pas via RLS pour ne pas pénaliser la lecture)
CREATE POLICY "pe_dd_checklist_delete"
  ON pe_dd_checklist FOR DELETE
  USING (
    can_see_pe_deal(deal_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = pe_dd_checklist.organization_id
        AND om.role IN ('managing_director', 'admin', 'owner')
        AND om.is_active = true
    )
  );

-- 5) RLS sur pe_dd_findings
ALTER TABLE pe_dd_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_dd_findings_select"
  ON pe_dd_findings FOR SELECT
  USING (can_see_pe_deal(deal_id, auth.uid()));

CREATE POLICY "pe_dd_findings_insert"
  ON pe_dd_findings FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND can_see_pe_deal(deal_id, auth.uid())
    AND organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

CREATE POLICY "pe_dd_findings_update"
  ON pe_dd_findings FOR UPDATE
  USING (can_see_pe_deal(deal_id, auth.uid()));

CREATE POLICY "pe_dd_findings_delete"
  ON pe_dd_findings FOR DELETE
  USING (
    can_see_pe_deal(deal_id, auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = pe_dd_findings.organization_id
          AND om.role IN ('managing_director', 'admin', 'owner')
          AND om.is_active = true
      )
    )
  );

-- 6) Trigger updated_at
CREATE OR REPLACE FUNCTION update_pe_dd_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pe_dd_checklist_updated_at ON pe_dd_checklist;
CREATE TRIGGER trg_pe_dd_checklist_updated_at
  BEFORE UPDATE ON pe_dd_checklist
  FOR EACH ROW EXECUTE FUNCTION update_pe_dd_updated_at();

DROP TRIGGER IF EXISTS trg_pe_dd_findings_updated_at ON pe_dd_findings;
CREATE TRIGGER trg_pe_dd_findings_updated_at
  BEFORE UPDATE ON pe_dd_findings
  FOR EACH ROW EXECUTE FUNCTION update_pe_dd_updated_at();

-- 7) Comments documentation
COMMENT ON TABLE pe_dd_checklist IS
  'Items à vérifier pendant la Due Diligence d''un deal PE. Vue project management : on coche au fur et à mesure. status : pending → verified/red_flag/na.';

COMMENT ON TABLE pe_dd_findings IS
  'Problèmes ou confirmations découverts pendant la DD. Chaque finding peut impacter une ou plusieurs sections du memo (impacts_section_codes). Quand applied_to_memo_at est non-null, le finding a été poussé dans les sections du memo (living document).';

COMMENT ON COLUMN pe_dd_findings.impacts_section_codes IS
  'Codes de sections memo impactées par ce finding. Permet à apply-dd-findings-to-memo de savoir quelles sections enrichir.';
