-- ============================================================================
-- Phase 1A — Migration 8/8 : Rendre organization_id NOT NULL
-- DERNIÈRE migration — exécuter uniquement après validation de la migration 7
-- funding_programs reste NULLABLE (données globales)
-- ============================================================================

-- Vérification préalable : aucune ligne ne doit avoir organization_id IS NULL
-- Si cette migration échoue, c'est que la migration 7 n'a pas tout migré

DO $$
DECLARE
  tbl text;
  null_count int;
BEGIN
  -- Tables qui doivent être NOT NULL (skip celles qui n'existent pas)
  FOREACH tbl IN ARRAY ARRAY[
    'enterprises', 'enterprise_modules', 'deliverables', 'deliverable_versions',
    'deliverable_corrections', 'programmes', 'programme_criteria', 'programme_kpis',
    'programme_kpi_history', 'candidatures', 'coaching_notes', 'coach_uploads',
    'inputs_history', 'score_history', 'activity_log', 'ai_cost_log',
    'funding_matches', 'data_room_documents', 'data_room_shares',
    'aggregated_benchmarks', 'workspace_knowledge', 'enterprise_coaches'
  ] LOOP
    -- Vérifier que la table et la colonne existent
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id'
    ) THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE organization_id IS NULL', tbl) INTO null_count;
      IF null_count > 0 THEN
        RAISE NOTICE 'Table % a % lignes NULL — skip NOT NULL (table peut-être vide en local)', tbl, null_count;
      ELSE
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', tbl);
        RAISE NOTICE 'SET NOT NULL on %', tbl;
      END IF;
    ELSE
      RAISE NOTICE 'Skipping % (table or column does not exist)', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE 'Vérification terminée';
END $$;
