-- Phase B' Step 1 — Rename PE deal stages to align with architecture v2.5
-- ic1 → note_ic1
-- ic_finale → note_ic_finale
-- analyse → migrer données vers pre_screening (mais l'enum value reste,
--           Postgres ne permet pas DROP VALUE sur un enum)

-- 1) Rename enum values (preserves all existing rows)
ALTER TYPE pe_deal_stage RENAME VALUE 'ic1' TO 'note_ic1';
ALTER TYPE pe_deal_stage RENAME VALUE 'ic_finale' TO 'note_ic_finale';

-- 2) Migrer les rows utilisant 'analyse' vers 'pre_screening'
--    'analyse' reste dans l'enum mais ne sera plus jamais affichée/utilisée.
UPDATE pe_deals SET stage = 'pre_screening' WHERE stage = 'analyse';
UPDATE pe_deal_history SET to_stage = 'pre_screening' WHERE to_stage = 'analyse';
UPDATE pe_deal_history SET from_stage = 'pre_screening' WHERE from_stage = 'analyse';

-- 3) Note de scope
COMMENT ON TYPE pe_deal_stage IS 'PE deal pipeline stages. analyse est legacy (Phase A). Phase B'' utilise: sourcing, pre_screening, note_ic1, dd, note_ic_finale, closing, portfolio, lost.';
