#!/usr/bin/env bash
# ===========================================================================
# Load banque seeds (NSIA + Atlantique) into local Supabase.
#
# Approche : on encode les JSON en base64, on les passe comme variable psql,
# et on décode côté SQL — pas de pg_read_file (interdit), pas d'escape shell.
#
# Idempotent — UPSERT sur les presets, REPLACE pour funding_lines.
# ===========================================================================
set -euo pipefail

SEEDS_DIR="$(cd "$(dirname "$0")" && pwd)"
DB="supabase_db_vfmzgsiwynsawwemsawj"

NSIA_ORG_ID="66666666-6666-6666-6666-666666666666"
ATL_ORG_ID="77777777-7777-7777-7777-777777777777"

# macOS base64 outputs without -w; use base64 | tr -d '\n' for portability
NSIA_B64=$(base64 < "$SEEDS_DIR/preset_nsia.json"       | tr -d '\n')
ATL_B64=$(base64  < "$SEEDS_DIR/preset_atlantique.json" | tr -d '\n')

docker exec -i \
  -e PSQL_NSIA_B64="$NSIA_B64" \
  -e PSQL_ATL_B64="$ATL_B64" \
  -e PSQL_NSIA_ID="$NSIA_ORG_ID" \
  -e PSQL_ATL_ID="$ATL_ORG_ID" \
  "$DB" psql -U postgres -d postgres \
    -v nsia_b64="$NSIA_B64" \
    -v atl_b64="$ATL_B64" \
    -v nsia_id="$NSIA_ORG_ID" \
    -v atl_id="$ATL_ORG_ID" \
<<'SQL'
\set ON_ERROR_STOP on

-- Org Atlantique (création si absente)
INSERT INTO organizations (id, name, slug, type, country, created_by, created_at)
VALUES (
  :'atl_id'::uuid,
  'Test Banque Atlantique',
  'test-banque-atlantique',
  'banque',
  'CIV',
  (SELECT id FROM auth.users LIMIT 1),
  NOW()
) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type;

-- Décoder les JSON depuis base64 dans une CTE
WITH src AS (
  SELECT :'nsia_id'::uuid AS org_id,
         convert_from(decode(:'nsia_b64','base64'),'UTF8')::jsonb AS data
  UNION ALL
  SELECT :'atl_id'::uuid,
         convert_from(decode(:'atl_b64','base64'),'UTF8')::jsonb
)
INSERT INTO organization_presets (
  organization_id, devise, langue, horizon_projection,
  criteres_conformite, constats_config, matching_config, templates_custom,
  config_banque
)
SELECT
  org_id,
  data->>'devise',
  data->>'langue',
  (data->>'horizon_projection')::int,
  data->'criteres_conformite',
  data->'constats_config',
  data->'matching_config',
  data->'templates_custom',
  data->'config_banque'
FROM src
ON CONFLICT (organization_id) DO UPDATE SET
  devise              = EXCLUDED.devise,
  langue              = EXCLUDED.langue,
  horizon_projection  = EXCLUDED.horizon_projection,
  criteres_conformite = EXCLUDED.criteres_conformite,
  constats_config     = EXCLUDED.constats_config,
  matching_config     = EXCLUDED.matching_config,
  templates_custom    = EXCLUDED.templates_custom,
  config_banque       = EXCLUDED.config_banque,
  updated_at          = NOW();

-- Funding lines : on remplace tout
DELETE FROM funding_lines WHERE organization_id IN (:'nsia_id'::uuid, :'atl_id'::uuid);

WITH src AS (
  SELECT :'nsia_id'::uuid AS org_id,
         convert_from(decode(:'nsia_b64','base64'),'UTF8')::jsonb AS data
  UNION ALL
  SELECT :'atl_id'::uuid,
         convert_from(decode(:'atl_b64','base64'),'UTF8')::jsonb
), lines AS (
  SELECT org_id, jsonb_array_elements(data->'funding_lines_seed') AS line FROM src
)
INSERT INTO funding_lines (
  organization_id, code, label, type, bailleur, devise,
  capacite_totale, kpi_a_reporter, taux_partage_risque, taux_preferentiel
)
SELECT
  org_id,
  line->>'code',
  line->>'label',
  line->>'type',
  line->>'bailleur',
  line->>'devise',
  (line->>'capacite_totale')::numeric,
  ARRAY(SELECT jsonb_array_elements_text(line->'kpi_a_reporter')),
  NULLIF(line->>'taux_partage_risque','')::numeric,
  NULLIF(line->>'taux_preferentiel','')::numeric
FROM lines;

-- Vérifications
\echo '---  presets  ---'
SELECT organization_id, jsonb_typeof(config_banque) AS cb_type,
       jsonb_array_length(criteres_conformite) AS nb_criteres,
       jsonb_array_length(config_banque->'produits') AS nb_produits,
       jsonb_array_length(config_banque->'canaux_acquisition') AS nb_canaux
  FROM organization_presets
 WHERE organization_id IN (:'nsia_id'::uuid, :'atl_id'::uuid)
 ORDER BY organization_id;

\echo '---  funding_lines  ---'
SELECT organization_id, code, label, devise, capacite_totale
  FROM funding_lines
 ORDER BY organization_id, code;
SQL

echo "✓ Done"
