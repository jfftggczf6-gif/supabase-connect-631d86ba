# Phase 1A — Checklist de validation

## Ordre d'application

```
1. 20260417100001_create_organizations.sql
2. 20260417100002_create_organization_members.sql
3. 20260417100003_create_organization_invitations.sql
4. 20260417100004_extend_app_role_enum.sql         ← HORS TRANSACTION (ALTER TYPE ADD VALUE)
5. 20260417100005_create_enterprise_coaches.sql
6. 20260417100006_add_organization_id_columns.sql
7. 20260417100007_migrate_legacy_data.sql          ← CRITIQUE : vérifier les RAISE NOTICE
8. 20260417100008_set_organization_id_not_null.sql ← DERNIÈRE, uniquement si 7 OK
```

## Requêtes de validation après chaque étape

### Après migration 1-3 (nouvelles tables)
```sql
SELECT count(*) FROM public.organizations;        -- doit être 0
SELECT count(*) FROM public.organization_members;  -- doit être 0
SELECT count(*) FROM public.organization_invitations; -- doit être 0
```

### Après migration 4 (enum)
```sql
SELECT unnest(enum_range(null::app_role));
-- Doit contenir : coach, entrepreneur, super_admin, chef_programme, analyste, investment_manager, managing_director
```

### Après migration 5 (enterprise_coaches)
```sql
SELECT count(*) FROM public.enterprise_coaches;    -- doit être 0 (pas encore migré)
```

### Après migration 6 (colonnes organization_id)
```sql
SELECT table_name FROM information_schema.columns
WHERE column_name = 'organization_id' AND table_schema = 'public'
ORDER BY table_name;
-- Doit lister 23 tables (22 existantes + enterprise_coaches)
```

### Après migration 7 (migration données) — CRITIQUE
```sql
-- Org créée
SELECT id, name, slug, type FROM public.organizations WHERE slug = 'esono-legacy';

-- Tous les users rattachés
SELECT count(*) FROM public.organization_members;  -- doit être >= nombre de users

-- Toutes les entreprises ont une org
SELECT count(*) FROM public.enterprises WHERE organization_id IS NULL; -- doit être 0

-- Coaches migrés
SELECT count(*) FROM public.enterprise_coaches;  -- doit être = nombre d'entreprises avec coach_id
SELECT ec.enterprise_id, ec.coach_id, e.coach_id as old_coach_id
FROM public.enterprise_coaches ec
JOIN public.enterprises e ON e.id = ec.enterprise_id
WHERE ec.is_active = true;
-- coach_id de enterprise_coaches doit matcher le old coach_id

-- Vérifier qu'aucune table n'a de NULL
SELECT 'enterprises' as tbl, count(*) as nulls FROM enterprises WHERE organization_id IS NULL
UNION ALL SELECT 'deliverables', count(*) FROM deliverables WHERE organization_id IS NULL
UNION ALL SELECT 'programmes', count(*) FROM programmes WHERE organization_id IS NULL
UNION ALL SELECT 'candidatures', count(*) FROM candidatures WHERE organization_id IS NULL
UNION ALL SELECT 'activity_log', count(*) FROM activity_log WHERE organization_id IS NULL;
-- Tous doivent être 0
```

### Après migration 8 (NOT NULL)
```sql
-- Vérifier que les contraintes sont en place
SELECT table_name, is_nullable FROM information_schema.columns
WHERE column_name = 'organization_id' AND table_schema = 'public'
AND table_name NOT IN ('funding_programs')
ORDER BY table_name;
-- Tous doivent être 'NO' sauf funding_programs qui reste 'YES'
```

## Test UI obligatoire avant Prompt 1B

1. Se connecter à l'app avec admin@esono.app
2. Vérifier que le dashboard SuperAdmin affiche toujours les 26 entreprises
3. Ouvrir une entreprise et vérifier que les livrables sont visibles
4. Se connecter avec un compte coach et vérifier l'accès à ses entreprises
5. Vérifier que le formulaire public de candidature fonctionne toujours

## Procédure de rollback

```sql
-- ROLLBACK COMPLET Phase 1A (dans l'ordre inverse)
-- ⚠️ DESTRUCTIF — supprime les nouvelles tables et colonnes

-- 8. Remettre NULLABLE (si appliqué)
-- ALTER TABLE public.enterprises ALTER COLUMN organization_id DROP NOT NULL;
-- (répéter pour chaque table)

-- 7. Supprimer les données migrées
-- DELETE FROM public.enterprise_coaches;
-- DELETE FROM public.organization_members;
-- DELETE FROM public.organizations WHERE slug = 'esono-legacy';

-- 6. Supprimer les colonnes organization_id
-- ALTER TABLE public.enterprises DROP COLUMN IF EXISTS organization_id;
-- (répéter pour chaque table)

-- 5. Supprimer enterprise_coaches
-- DROP TABLE IF EXISTS public.enterprise_coaches;

-- 4. Les valeurs enum ne peuvent PAS être supprimées sans recréer le type
-- (pas de rollback possible pour ALTER TYPE ADD VALUE)

-- 3. DROP TABLE IF EXISTS public.organization_invitations;
-- 2. DROP TABLE IF EXISTS public.organization_members;
-- 1. DROP TABLE IF EXISTS public.organizations;
```
