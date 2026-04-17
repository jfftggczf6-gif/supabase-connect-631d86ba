-- ============================================================================
-- Phase 1A — Migration 7/8 : Migration des données existantes
-- Crée l'org "ESONO Legacy", rattache tous les users et données
-- IDEMPOTENTE : peut être relancée sans créer de doublons
-- ============================================================================

DO $$
DECLARE
  legacy_org_id uuid;
  users_migrated int := 0;
  enterprises_migrated int := 0;
  coaches_migrated int := 0;
BEGIN
  -- ═══════════════════════════════════════════════════════
  -- A) Créer l'organisation "ESONO Legacy" si elle n'existe pas
  -- ═══════════════════════════════════════════════════════
  SELECT id INTO legacy_org_id FROM public.organizations WHERE slug = 'esono-legacy';

  IF legacy_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug, type, country, is_active)
    VALUES ('ESONO Legacy', 'esono-legacy', 'mixed', 'CI', true)
    RETURNING id INTO legacy_org_id;
    RAISE NOTICE 'Créé org ESONO Legacy: %', legacy_org_id;
  ELSE
    RAISE NOTICE 'Org ESONO Legacy existe déjà: %', legacy_org_id;
  END IF;

  -- ═══════════════════════════════════════════════════════
  -- B) Rattacher tous les users à cette org via organization_members
  -- Mapping : super_admin→owner, chef_programme→manager, coach→coach, entrepreneur→entrepreneur
  -- ═══════════════════════════════════════════════════════

  -- Users avec rôle dans user_roles
  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  SELECT
    legacy_org_id,
    ur.user_id,
    CASE ur.role::text
      WHEN 'super_admin' THEN 'owner'
      WHEN 'chef_programme' THEN 'manager'
      WHEN 'coach' THEN 'coach'
      WHEN 'entrepreneur' THEN 'entrepreneur'
      ELSE 'entrepreneur'
    END,
    true
  FROM public.user_roles ur
  WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  GET DIAGNOSTICS users_migrated = ROW_COUNT;
  RAISE NOTICE 'Users rattachés à l org: %', users_migrated;

  -- Users sans ligne dans user_roles (cas rare) → entrepreneur par défaut
  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  SELECT legacy_org_id, p.user_id, 'entrepreneur', true
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = p.user_id AND om.organization_id = legacy_org_id
  )
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- ═══════════════════════════════════════════════════════
  -- C) Rattacher TOUTES les données à l'org ESONO Legacy
  -- UPDATE uniquement les lignes qui n'ont pas encore d'organization_id
  -- ═══════════════════════════════════════════════════════

  UPDATE public.enterprises SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  GET DIAGNOSTICS enterprises_migrated = ROW_COUNT;
  RAISE NOTICE 'Entreprises rattachées: %', enterprises_migrated;

  UPDATE public.enterprise_modules SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.deliverables SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.deliverable_versions SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.deliverable_corrections SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.programmes SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.programme_criteria SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.programme_kpis SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.programme_kpi_history SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.candidatures SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.coaching_notes SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.coach_uploads SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.inputs_history SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.score_history SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.activity_log SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.ai_cost_log SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.funding_matches SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  -- funding_programs : laisser NULL (globaux par design)
  UPDATE public.data_room_documents SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.data_room_shares SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.aggregated_benchmarks SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.workspace_knowledge SET organization_id = legacy_org_id WHERE organization_id IS NULL;
  UPDATE public.enterprise_coaches SET organization_id = legacy_org_id WHERE organization_id IS NULL;

  RAISE NOTICE 'Toutes les tables rattachées à ESONO Legacy';

  -- ═══════════════════════════════════════════════════════
  -- D) Migrer enterprises.coach_id → enterprise_coaches
  -- Crée une entrée N-à-N pour chaque entreprise qui a un coach_id
  -- ═══════════════════════════════════════════════════════

  INSERT INTO public.enterprise_coaches (enterprise_id, coach_id, role, assigned_by, assigned_at, is_active, organization_id)
  SELECT
    e.id,
    e.coach_id,
    'principal',
    e.coach_id,
    COALESCE(e.created_at, now()),
    true,
    legacy_org_id
  FROM public.enterprises e
  WHERE e.coach_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.enterprise_coaches ec
      WHERE ec.enterprise_id = e.id AND ec.coach_id = e.coach_id AND ec.is_active = true
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS coaches_migrated = ROW_COUNT;
  RAISE NOTICE 'Coaches migrés vers enterprise_coaches: %', coaches_migrated;

  -- NOTE : on NE droppe PAS enterprises.coach_id ici
  -- Il sera supprimé en Phase 2 après migration de tous les écrans UI

  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'Migration terminée. Org: %, Users: %, Entreprises: %, Coaches: %',
    legacy_org_id, users_migrated, enterprises_migrated, coaches_migrated;
  RAISE NOTICE '════════════════════════════════════════';
END $$;
