-- Phase E' — Upload rapport DD externe + snapshots du memo
-- Le DD est externalisé (cabinet d'expertise) → on upload son rapport + l'IA compare avec le memo IC1.
-- Les snapshots permettent de figer le memo "pré-DD" avant d'intégrer les findings DD,
-- pour exports granulaires et vue comparative.

-- 1) Flag DD report sur les pièces
ALTER TABLE pe_deal_documents
  ADD COLUMN IF NOT EXISTS is_dd_report BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pe_deal_documents_dd_report
  ON pe_deal_documents(deal_id, is_dd_report)
  WHERE is_dd_report = true;

COMMENT ON COLUMN pe_deal_documents.is_dd_report IS
  'TRUE si la pièce est un rapport DD externe (à analyser pour findings vs memo IC1). Différent des pièces classiques (pitch, bilan, etc.) qui alimentent le memo direct.';

-- 2) Snapshots du memo (pour figer un état avant mutation)
ALTER TABLE memo_versions
  ADD COLUMN IF NOT EXISTS is_snapshot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snapshot_label TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_of_version_id UUID REFERENCES memo_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snapshot_taken_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_taken_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_memo_versions_snapshots
  ON memo_versions(memo_id, is_snapshot)
  WHERE is_snapshot = true;

COMMENT ON COLUMN memo_versions.is_snapshot IS
  'TRUE si cette ligne est un snapshot figé (read-only audit) — distinct de la version live qui évolue. La version live a is_snapshot=false. Snapshot_label décrit le moment (ex: "Pré-DD", "IC1 final").';

COMMENT ON COLUMN memo_versions.snapshot_of_version_id IS
  'Référence à la version live dont ce snapshot est une copie figée. NULL pour les versions live.';

-- 3) Helper RPC : créer un snapshot d'une version (clone version + sections)
CREATE OR REPLACE FUNCTION pe_create_memo_snapshot(
  p_version_id UUID,
  p_label TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_source_version memo_versions%ROWTYPE;
  v_snapshot_id UUID;
BEGIN
  -- 1) Charger la version source
  SELECT * INTO v_source_version FROM memo_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % introuvable', p_version_id;
  END IF;
  IF v_source_version.is_snapshot THEN
    RAISE EXCEPTION 'On ne crée pas de snapshot d''un snapshot (version % est déjà un snapshot)', p_version_id;
  END IF;

  -- 2) Créer la nouvelle row memo_versions = copie figée
  INSERT INTO memo_versions (
    memo_id, label, parent_version_id, stage, status,
    overall_score, classification, generated_by_agent, generated_by_user_id,
    generated_at, error_message,
    is_snapshot, snapshot_label, snapshot_of_version_id, snapshot_taken_at, snapshot_taken_by
  ) VALUES (
    v_source_version.memo_id,
    v_source_version.label || '_snapshot_' || TO_CHAR(now(), 'YYYYMMDDHH24MISS'),
    v_source_version.id,
    v_source_version.stage,
    v_source_version.status,
    v_source_version.overall_score,
    v_source_version.classification,
    'snapshot',
    p_user_id,
    v_source_version.generated_at,
    NULL,
    true,
    p_label,
    p_version_id,
    now(),
    p_user_id
  )
  RETURNING id INTO v_snapshot_id;

  -- 3) Cloner les memo_sections
  INSERT INTO memo_sections (
    version_id, section_code, title, content_md, content_json,
    source_doc_ids, position, status,
    last_edited_by, last_edited_at,
    created_at, updated_at
  )
  SELECT
    v_snapshot_id,
    section_code,
    title,
    content_md,
    content_json,
    source_doc_ids,
    position,
    status,
    last_edited_by,
    last_edited_at,
    created_at,
    now()
  FROM memo_sections
  WHERE version_id = p_version_id;

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION pe_create_memo_snapshot IS
  'Crée un snapshot figé d''une memo_version : clone la version + ses 12 sections avec is_snapshot=true. Retourne l''id du snapshot. Utilisé avant d''appliquer les findings DD pour conserver le memo "pré-DD".';
