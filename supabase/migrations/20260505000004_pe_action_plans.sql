-- ============================================================================
-- Phase G — Plan 100 jours (post-closing)
-- ============================================================================
-- Suit l'exécution des actions clés des 3 premiers mois après le closing :
--   - Recrutement DAF/DRH
--   - Formalisation gouvernance (CA, comités)
--   - Mise en place reporting
--   - Quick wins identifiés dans la section "Accompagnement / Value creation"
-- ============================================================================

CREATE TYPE pe_action_category AS ENUM (
  'recrutement',
  'gouvernance',
  'reporting',
  'quick_win',
  'compliance',
  'finance',
  'commercial',
  'operationnel',
  'autre'
);

CREATE TYPE pe_action_status AS ENUM ('todo', 'in_progress', 'done', 'blocked');

CREATE TABLE pe_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_label TEXT NOT NULL,
  description TEXT,
  category pe_action_category NOT NULL DEFAULT 'autre',
  owner_user_id UUID REFERENCES auth.users(id),
  status pe_action_status NOT NULL DEFAULT 'todo',
  priority INT DEFAULT 5,                  -- 1 (haute) → 10 (basse)
  due_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  source TEXT DEFAULT 'manual',            -- 'manual' | 'memo_extracted'
  memo_section_code TEXT,                  -- si source=memo_extracted, la section d'origine
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pe_action_plans_deal ON pe_action_plans(deal_id);
CREATE INDEX idx_pe_action_plans_org ON pe_action_plans(organization_id);
CREATE INDEX idx_pe_action_plans_status ON pe_action_plans(status, due_date);
CREATE INDEX idx_pe_action_plans_owner ON pe_action_plans(owner_user_id) WHERE status != 'done';

CREATE TRIGGER trg_pe_action_plans_updated_at
  BEFORE UPDATE ON pe_action_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pe_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY pe_action_plans_select ON pe_action_plans FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR is_member_of(organization_id));

CREATE POLICY pe_action_plans_modify ON pe_action_plans FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_action_plans.organization_id
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
      WHERE om.user_id = auth.uid() AND om.organization_id = pe_action_plans.organization_id
        AND om.is_active
    )
  )
);

COMMENT ON TABLE pe_action_plans IS 'Plan 100 jours : actions à exécuter après closing pour la création de valeur';
