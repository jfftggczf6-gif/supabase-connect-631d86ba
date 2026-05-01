-- Phase C' itération 2 — Édition + régénération section par section
-- Audit minimal : qui a édité quoi et quand.

-- 1) Ajouter colonnes last_edited_by + last_edited_at sur memo_sections
ALTER TABLE memo_sections
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- 2) Policy UPDATE sur memo_sections — autorise les users qui peuvent voir le deal
--    à éditer une section. Restrictions par rôle (analyste/IM/MD) gérées côté UI
--    pour l'instant ; on durcira en Phase C' itération 3 (workflow validation).
DROP POLICY IF EXISTS "memo_sections_update" ON memo_sections;
CREATE POLICY "memo_sections_update"
  ON memo_sections FOR UPDATE
  USING (
    version_id IN (
      SELECT mv.id FROM memo_versions mv
      JOIN investment_memos im ON im.id = mv.memo_id
      WHERE can_see_pe_deal(im.deal_id, auth.uid())
    )
  )
  WITH CHECK (
    version_id IN (
      SELECT mv.id FROM memo_versions mv
      JOIN investment_memos im ON im.id = mv.memo_id
      WHERE can_see_pe_deal(im.deal_id, auth.uid())
    )
  );

COMMENT ON COLUMN memo_sections.last_edited_by IS 'Dernier user qui a édité cette section (manuellement ou via régénération IA)';
COMMENT ON COLUMN memo_sections.last_edited_at IS 'Timestamp de la dernière édition (différent de updated_at qui peut être bumpé par d''autres mécanismes)';
