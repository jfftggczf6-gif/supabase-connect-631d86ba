-- Migration : ajoute le tracking handoff BA → PE sur pe_deals
-- Quand un mandat BA est handoff vers un fonds PE, on crée un nouveau pe_deals
-- dans l'org PE acheteur avec :
-- - source_ba_deal_id : référence vers le pe_deals BA original
-- - source_ba_org_id : référence vers l'org BA (Cissé Advisory)
-- Permet de :
-- 1. Tracer la provenance d'un deal côté PE (lead source = mandat BA)
-- 2. Côté BA : marquer le deal handoff_done si LOI signée par un fonds

ALTER TABLE pe_deals ADD COLUMN IF NOT EXISTS source_ba_deal_id uuid REFERENCES pe_deals(id);
ALTER TABLE pe_deals ADD COLUMN IF NOT EXISTS source_ba_org_id uuid REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_pe_deals_source_ba ON pe_deals(source_ba_deal_id);
