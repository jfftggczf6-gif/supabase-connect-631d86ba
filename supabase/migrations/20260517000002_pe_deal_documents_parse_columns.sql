-- 20260517000002_pe_deal_documents_parse_columns.sql
-- Ajoute les colonnes parse_quality / parse_error / chars_extracted / content_extracted
-- sur pe_deal_documents pour persister le résultat du parsing Railway.
--
-- Utilisé par la feature upload_documents BA (et bénéfice gratuit pour PE qui
-- pourra à terme afficher la qualité de parsing dans son uploader aussi).

ALTER TABLE pe_deal_documents
  ADD COLUMN IF NOT EXISTS parse_quality text CHECK (parse_quality IN ('high','medium','low','failed')),
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS chars_extracted integer,
  ADD COLUMN IF NOT EXISTS content_extracted text;

COMMENT ON COLUMN pe_deal_documents.parse_quality IS
  'Qualité du parsing Railway : high/medium/low/failed (NULL si pas encore parsé).';
COMMENT ON COLUMN pe_deal_documents.content_extracted IS
  'Texte extrait par le parser Python (pymupdf/openpyxl/python-docx). Sert d''input RAG/IA.';
