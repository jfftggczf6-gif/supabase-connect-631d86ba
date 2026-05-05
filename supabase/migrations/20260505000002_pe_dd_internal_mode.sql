-- ============================================================================
-- Phase F — DD interne (mode amorçage)
-- ============================================================================
-- Avant : generate-dd-report assume un PDF cabinet externe (Mazars, KPMG…)
-- Maintenant : un finding peut être créé en mode interne (analyste rédige
-- directement sans upload de rapport externe). Cas typique : fonds amorçage
-- comme Comoé qui font leur DD en interne.
-- ============================================================================

CREATE TYPE pe_dd_source_type AS ENUM ('external_report', 'internal_analysis');

ALTER TABLE pe_dd_findings
  ADD COLUMN IF NOT EXISTS source_type pe_dd_source_type NOT NULL DEFAULT 'external_report';

COMMENT ON COLUMN pe_dd_findings.source_type IS
  'external_report : extrait d''un rapport DD cabinet externe (avec source_doc_id + page).
   internal_analysis : finding rédigé directement par un analyste interne (fonds amorçage).';

-- Idem côté checklist
ALTER TABLE pe_dd_checklist
  ADD COLUMN IF NOT EXISTS source_type pe_dd_source_type NOT NULL DEFAULT 'external_report';
