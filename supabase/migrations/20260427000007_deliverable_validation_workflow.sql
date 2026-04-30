-- ===========================================================================
-- Workflow producteur/valideur sur deliverables (segment Banque mais réutilisable).
--
-- États possibles d'un livrable :
--   draft               → en cours par le producteur (conseiller)
--   submitted           → soumis pour validation à l'analyste
--   revision_requested  → l'analyste a demandé des corrections
--   validated           → validé par l'analyste / verrouillé
--   locked              → verrouillé en lecture (état terminal — décaissement ou archive)
--
-- Migration ADDITIVE — n'affecte pas les deliverables existants
-- (validation_status par défaut = NULL = "pas concerné par ce workflow").
-- ===========================================================================

ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS validation_status TEXT
    CHECK (validation_status IS NULL OR validation_status IN (
      'draft', 'submitted', 'revision_requested', 'validated', 'locked'
    ));

ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id);
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS review_comment TEXT;          -- dernier commentaire (rapide à afficher)
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS review_history JSONB DEFAULT '[]'::jsonb;
-- review_history format : [{ at, by_user_id, by_role, action, comment }]
-- actions possibles : 'submitted' | 'validated' | 'revision_requested' | 'unlocked'

CREATE INDEX IF NOT EXISTS idx_deliverables_validation_status
  ON deliverables(enterprise_id, validation_status)
  WHERE validation_status IS NOT NULL;
