-- ============================================================================
-- Phase F — Décisions IC formalisées
-- ============================================================================
-- Avant : transition note_ic1 → dd ou note_ic_finale → closing par drag-drop,
--         sans capture explicite de la décision (Go / Go conditionnel / No-go)
-- Maintenant : à chaque transition critique, capture structurée :
--   - ic_type : ic1 | ic_finale
--   - decision : go | go_conditional | no_go
--   - conditions[] (si go_conditional)
--   - motif (si no_go)
--   - voted_by[] : votants présents au comité
-- ============================================================================

CREATE TYPE pe_ic_type AS ENUM ('ic1', 'ic_finale');
CREATE TYPE pe_ic_decision_type AS ENUM ('go', 'go_conditional', 'no_go');

CREATE TABLE pe_ic_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_type pe_ic_type NOT NULL,
  decision pe_ic_decision_type NOT NULL,
  conditions TEXT[] DEFAULT '{}'::TEXT[],
  motif TEXT,
  voted_by UUID[] DEFAULT '{}'::UUID[],
  decided_by UUID NOT NULL REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  CONSTRAINT pe_ic_decisions_motif_required_for_no_go CHECK (
    decision != 'no_go' OR (motif IS NOT NULL AND length(trim(motif)) > 0)
  ),
  CONSTRAINT pe_ic_decisions_conditions_required_for_conditional CHECK (
    decision != 'go_conditional' OR array_length(conditions, 1) > 0
  )
);

CREATE INDEX idx_pe_ic_decisions_deal ON pe_ic_decisions(deal_id);
CREATE INDEX idx_pe_ic_decisions_org ON pe_ic_decisions(organization_id);

ALTER TABLE pe_ic_decisions ENABLE ROW LEVEL SECURITY;

-- Lecture : owner/admin/manager/analyst de l'org du deal
CREATE POLICY pe_ic_decisions_select ON pe_ic_decisions FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_member_of(organization_id)
);

-- Insert : managing_director, admin, owner uniquement (les analystes ne décident pas)
CREATE POLICY pe_ic_decisions_insert ON pe_ic_decisions FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    is_member_of(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = pe_ic_decisions.organization_id
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active
    )
  )
);

COMMENT ON TABLE pe_ic_decisions IS 'Décisions formalisées des comités d''investissement (IC1 et IC finale).';
COMMENT ON COLUMN pe_ic_decisions.ic_type IS 'Type de comité : ic1 (avant DD) ou ic_finale (après DD)';
COMMENT ON COLUMN pe_ic_decisions.decision IS 'Verdict : go (validé), go_conditional (validé sous conditions), no_go (rejeté)';
COMMENT ON COLUMN pe_ic_decisions.conditions IS 'Liste des conditions (uniquement si go_conditional)';
COMMENT ON COLUMN pe_ic_decisions.motif IS 'Motif du rejet (uniquement si no_go)';
COMMENT ON COLUMN pe_ic_decisions.voted_by IS 'Liste des user_id qui ont participé au vote';
