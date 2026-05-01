-- Phase C' itération 3 — Workflow validation IM/MD par section

-- 1) Enum status par section
DO $$ BEGIN
  CREATE TYPE memo_section_status AS ENUM (
    'draft',                -- analyste en train de travailler
    'pending_validation',   -- analyste a soumis, attend IM/MD
    'validated',            -- IM ou MD a validé
    'needs_revision'        -- IM/MD a demandé des corrections (avec commentaire)
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Ajouter colonne status sur memo_sections
ALTER TABLE memo_sections
  ADD COLUMN IF NOT EXISTS status memo_section_status NOT NULL DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_memo_sections_status ON memo_sections(status);

-- 3) Audit log des validations
CREATE TABLE IF NOT EXISTS memo_section_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES memo_sections(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submit', 'validate', 'request_revision', 'reset_to_draft')),
  from_status memo_section_status,
  to_status memo_section_status NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_role TEXT,                    -- snapshot du rôle au moment de l'action (analyste/im/md)
  comment TEXT,                       -- commentaire optionnel (obligatoire pour request_revision)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memo_section_validations_section ON memo_section_validations(section_id, created_at DESC);

-- 4) RLS sur memo_section_validations
ALTER TABLE memo_section_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memo_section_validations_select"
  ON memo_section_validations FOR SELECT
  USING (
    section_id IN (
      SELECT ms.id FROM memo_sections ms
      JOIN memo_versions mv ON mv.id = ms.version_id
      JOIN investment_memos im ON im.id = mv.memo_id
      WHERE can_see_pe_deal(im.deal_id, auth.uid())
    )
  );

CREATE POLICY "memo_section_validations_insert"
  ON memo_section_validations FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND section_id IN (
      SELECT ms.id FROM memo_sections ms
      JOIN memo_versions mv ON mv.id = ms.version_id
      JOIN investment_memos im ON im.id = mv.memo_id
      WHERE can_see_pe_deal(im.deal_id, auth.uid())
    )
  );

COMMENT ON TABLE memo_section_validations IS 'Audit log des transitions de status sur memo_sections (submit/validate/request_revision/reset). Permet la timeline collaborative.';
COMMENT ON COLUMN memo_sections.status IS 'Status workflow : draft → pending_validation (par analyste) → validated/needs_revision (par IM/MD).';
