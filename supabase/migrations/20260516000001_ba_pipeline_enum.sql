-- BA pipeline (mandats) — enum + preset alignment
--
-- 1. Ajoute les 5 stages BA à l'enum pe_deal_stage (irréversible).
--    Naming aligné brief + wireframe + CLAUDE.md : 'im' (label "IM vendeur").
-- 2. Migre le preset Cissé Advisory : im_vendeur -> im dans workflow_overrides.

ALTER TYPE pe_deal_stage ADD VALUE IF NOT EXISTS 'recus';
ALTER TYPE pe_deal_stage ADD VALUE IF NOT EXISTS 'im';
ALTER TYPE pe_deal_stage ADD VALUE IF NOT EXISTS 'interets';
ALTER TYPE pe_deal_stage ADD VALUE IF NOT EXISTS 'nego';
ALTER TYPE pe_deal_stage ADD VALUE IF NOT EXISTS 'close';

UPDATE organization_presets
SET workflow_overrides = REPLACE(workflow_overrides::text, 'im_vendeur', 'im')::jsonb
WHERE workflow_overrides::text LIKE '%im_vendeur%';
