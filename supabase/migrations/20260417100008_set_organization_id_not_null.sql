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
  -- Tables qui doivent être NOT NULL
  FOREACH tbl IN ARRAY ARRAY[
    'enterprises', 'enterprise_modules', 'deliverables', 'deliverable_versions',
    'deliverable_corrections', 'programmes', 'programme_criteria', 'programme_kpis',
    'programme_kpi_history', 'candidatures', 'coaching_notes', 'coach_uploads',
    'inputs_history', 'score_history', 'activity_log', 'ai_cost_log',
    'funding_matches', 'data_room_documents', 'data_room_shares',
    'aggregated_benchmarks', 'workspace_knowledge', 'enterprise_coaches'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE organization_id IS NULL', tbl) INTO null_count;
    IF null_count > 0 THEN
      RAISE EXCEPTION 'Table % a % lignes avec organization_id NULL — migration 7 incomplète', tbl, null_count;
    END IF;
  END LOOP;
  RAISE NOTICE 'Vérification OK : aucune ligne NULL sur les 22 tables';
END $$;

-- Appliquer NOT NULL
ALTER TABLE public.enterprises ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.enterprise_modules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deliverables ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deliverable_versions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deliverable_corrections ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.programmes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.programme_criteria ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.programme_kpis ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.programme_kpi_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.candidatures ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.coaching_notes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.coach_uploads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.inputs_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.score_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.activity_log ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.ai_cost_log ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.funding_matches ALTER COLUMN organization_id SET NOT NULL;
-- funding_programs : reste NULLABLE (données globales par design)
ALTER TABLE public.data_room_documents ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.data_room_shares ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.aggregated_benchmarks ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.workspace_knowledge ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.enterprise_coaches ALTER COLUMN organization_id SET NOT NULL;
