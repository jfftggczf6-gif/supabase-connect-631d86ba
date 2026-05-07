-- ============================================================================
-- PE — Slide payload pour export PPT du memo IC
-- ============================================================================
-- Stocke un payload structuré (synthèse par section + KPIs + données graphs)
-- généré par l'agent IA `generate-pe-slide-payload`. Consommé par esono-render
-- pour produire le .pptx programmatiquement (pptxgenjs + charts natifs).
-- ============================================================================

ALTER TABLE public.memo_versions
  ADD COLUMN IF NOT EXISTS slide_payload JSONB,
  ADD COLUMN IF NOT EXISTS slide_payload_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slide_payload_generated_by_agent TEXT;

COMMENT ON COLUMN public.memo_versions.slide_payload IS 'Payload structuré pour génération PPT : KPIs, bullets, données graphs par slide. Produit par generate-pe-slide-payload.';
COMMENT ON COLUMN public.memo_versions.slide_payload_generated_at IS 'Timestamp de la dernière génération du slide_payload (peut être périmé vs sections).';
