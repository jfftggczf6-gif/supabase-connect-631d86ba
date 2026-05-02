-- Phase E' suite — Typage rapports DD + type finding + source précise
-- Aligne le module DD avec le mockup HTML PE_experience_complete.html (section #dd).

-- 1) Type de rapport DD (sur pe_deal_documents.is_dd_report=true)
DO $$ BEGIN
  CREATE TYPE pe_dd_report_type AS ENUM (
    'financiere',     -- DD financière (cabinet d'audit type KPMG)
    'juridique',      -- DD juridique (cabinet d'avocats)
    'esg',            -- DD ESG / impact
    'fiscale',        -- DD fiscale
    'operationnelle', -- DD opérationnelle / industrielle
    'commerciale',    -- DD commerciale (vendor due diligence côté target)
    'autre'           -- autre type non listé
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE pe_deal_documents
  ADD COLUMN IF NOT EXISTS dd_report_type pe_dd_report_type,
  ADD COLUMN IF NOT EXISTS dd_report_cabinet TEXT,    -- nom du cabinet (ex: "KPMG CI")
  ADD COLUMN IF NOT EXISTS dd_report_pages INTEGER;   -- nb de pages (info)

CREATE INDEX IF NOT EXISTS idx_pe_deal_documents_dd_type
  ON pe_deal_documents(deal_id, dd_report_type)
  WHERE is_dd_report = true;

COMMENT ON COLUMN pe_deal_documents.dd_report_type IS
  'Type de rapport DD (NULL si is_dd_report=false). Permet de regrouper les findings par type de DD dans l''UI.';
COMMENT ON COLUMN pe_deal_documents.dd_report_cabinet IS
  'Nom du cabinet auteur du rapport DD (ex: "KPMG CI", "Cabinet Ouédraogo").';

-- 2) Type de finding (au-delà de la sévérité)
DO $$ BEGIN
  CREATE TYPE pe_dd_finding_type AS ENUM (
    'confirmation', -- la DD CONFIRME une affirmation du memo IC1 → renforce
    'adjustment',   -- la DD AJUSTE un chiffre / fait du memo IC1 → modifie
    'red_flag',     -- la DD identifie un nouveau RED FLAG → ajoute
    'informative'   -- info complémentaire (ni confirmation ni ajustement, observation)
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE pe_dd_findings
  ADD COLUMN IF NOT EXISTS finding_type pe_dd_finding_type NOT NULL DEFAULT 'informative',
  -- 3) Source précise (paragraphe + page)
  ADD COLUMN IF NOT EXISTS source_paragraph TEXT,                                    -- ex: "§4.3.2"
  ADD COLUMN IF NOT EXISTS source_page INTEGER,                                       -- ex: 28
  ADD COLUMN IF NOT EXISTS source_doc_id UUID REFERENCES pe_deal_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pe_dd_findings_type ON pe_dd_findings(deal_id, finding_type);

COMMENT ON COLUMN pe_dd_findings.finding_type IS
  'Type de finding : confirmation (vert) / adjustment (orange) / red_flag (rouge) / informative (gris). Cohérent avec le mockup HTML.';
COMMENT ON COLUMN pe_dd_findings.source_paragraph IS
  'Référence paragraphe précise dans le rapport DD (ex: "§4.3.2"). Format libre, suit la convention du cabinet.';
COMMENT ON COLUMN pe_dd_findings.source_page IS
  'Numéro de page dans le rapport DD source.';

-- 4) Backfill : findings existants avec source = nom du fichier → tenter de mapper sur source_doc_id
-- (best effort, on laisse NULL si pas de match)
UPDATE pe_dd_findings f
SET source_doc_id = d.id
FROM pe_deal_documents d
WHERE d.deal_id = f.deal_id
  AND d.is_dd_report = true
  AND f.source_doc_id IS NULL
  AND (f.body ILIKE '%' || d.filename || '%' OR f.body ILIKE '%' || regexp_replace(d.filename, '\.[^.]+$', '') || '%');
