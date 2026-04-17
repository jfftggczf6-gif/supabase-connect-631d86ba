-- ============================================================================
-- Phase 1A — Migration 6/8 : Ajout colonne organization_id sur les tables métier
-- NULLABLE pour l'instant — sera passé NOT NULL après la migration des données
-- Les tables knowledge_* restent GLOBALES (pas d'organization_id)
-- ============================================================================

-- Fonction helper pour ajouter organization_id si pas déjà présent
CREATE OR REPLACE FUNCTION _temp_add_org_id(tbl text) RETURNS void AS $$
BEGIN
  -- Vérifier que la table existe (certaines tables sont créées via le dashboard, pas les migrations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = tbl
  ) THEN
    RAISE NOTICE 'Table % does not exist — skipping', tbl;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE', tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_org_id ON public.%I(organization_id)', tbl, tbl
    );
    EXECUTE format(
      'COMMENT ON COLUMN public.%I.organization_id IS ''Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.''', tbl
    );
    RAISE NOTICE 'Added organization_id to %', tbl;
  ELSE
    RAISE NOTICE 'organization_id already exists on %', tbl;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Tables principales
SELECT _temp_add_org_id('enterprises');
SELECT _temp_add_org_id('enterprise_modules');
SELECT _temp_add_org_id('deliverables');
SELECT _temp_add_org_id('deliverable_versions');
SELECT _temp_add_org_id('deliverable_corrections');
SELECT _temp_add_org_id('programmes');
SELECT _temp_add_org_id('programme_criteria');
SELECT _temp_add_org_id('programme_kpis');
SELECT _temp_add_org_id('programme_kpi_history');
SELECT _temp_add_org_id('candidatures');
SELECT _temp_add_org_id('coaching_notes');
SELECT _temp_add_org_id('coach_uploads');
SELECT _temp_add_org_id('inputs_history');
SELECT _temp_add_org_id('score_history');
SELECT _temp_add_org_id('activity_log');
SELECT _temp_add_org_id('ai_cost_log');
SELECT _temp_add_org_id('funding_matches');
SELECT _temp_add_org_id('funding_programs');
SELECT _temp_add_org_id('data_room_documents');
SELECT _temp_add_org_id('data_room_shares');
SELECT _temp_add_org_id('aggregated_benchmarks');
SELECT _temp_add_org_id('workspace_knowledge');
SELECT _temp_add_org_id('enterprise_coaches');

-- Nettoyage de la fonction temporaire
DROP FUNCTION IF EXISTS _temp_add_org_id(text);
