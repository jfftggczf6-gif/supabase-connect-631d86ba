-- ===========================================================================
-- Seed local complet : admin + banque + PE
-- ===========================================================================
-- Objectif : populer le Supabase local avec des comptes test pour tester
-- les 3 segments (programme, banque, PE) sur localhost dev.
--
-- Reset les mots de passe à 'Test123!' et confirme tous les emails.
-- IDEMPOTENT : peut être rejoué autant de fois que nécessaire.
-- ===========================================================================

-- Tous les comptes utilisent ce mot de passe : Test123!
-- (bcrypt généré une seule fois pour économiser le hash)

DO $$
DECLARE
  bf_pwd text := crypt('Test123!', gen_salt('bf'));

  -- IDs admin / programme
  v_admin_id uuid := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  v_admin_org uuid := '11111111-1111-1111-1111-111111111111';

  -- IDs PE
  v_pe_org uuid := '55555555-5555-5555-5555-555555555555';
  v_md_id uuid := 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa';
  v_im_id uuid := 'aaaaaaaa-3333-3333-3333-aaaaaaaaaaaa';
  v_im2_id uuid := 'aaaaaaaa-3333-3333-3333-bbbbbbbbbbbb';
  v_analyst1_id uuid := 'aaaaaaaa-4444-4444-4444-aaaaaaaaaaaa';
  v_analyst2_id uuid := 'aaaaaaaa-4444-4444-4444-bbbbbbbbbbbb';
  v_analyst3_id uuid := 'aaaaaaaa-4444-4444-4444-cccccccccccc';

  -- IDs déjà créés banque (existants)
  v_banque_org uuid := '66666666-6666-6666-6666-666666666666';

  -- IDs entreprises de test
  v_ent_pharmaci uuid := 'eeeeeeee-1111-1111-1111-aaaaaaaaaaaa';
  v_ent_logici uuid := 'eeeeeeee-2222-2222-2222-aaaaaaaaaaaa';
  v_ent_cleanwater uuid := 'eeeeeeee-3333-3333-3333-aaaaaaaaaaaa';
  v_ent_aquaculture uuid := 'eeeeeeee-4444-4444-4444-aaaaaaaaaaaa';

BEGIN
  -- ════════════════════════════════════════════════════════════════════════
  -- 1) RESET les mots de passe + confirmation email pour TOUS les users
  -- ════════════════════════════════════════════════════════════════════════
  UPDATE auth.users
  SET
    encrypted_password = bf_pwd,
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE email IN (
    'conseiller@nsia.local', 'conseiller2@nsia.local',
    'analyste@nsia.local', 'directeur@nsia.local',
    'test@esono.local'
  );
  RAISE NOTICE 'Reset password Test123! pour les 5 users existants';

  -- ════════════════════════════════════════════════════════════════════════
  -- 2) ADMIN local : admin@esono.local en super_admin
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    aud, role, created_at, updated_at
  ) VALUES (
    v_admin_id, '00000000-0000-0000-0000-000000000000',
    'admin@esono.local', bf_pwd,
    now(),
    jsonb_build_object('full_name', 'ESONO Admin Local', 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated', 'authenticated', now(), now()
  )
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  VALUES (v_admin_id, 'email', v_admin_id::text,
    jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@esono.local', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO profiles (user_id, full_name, email)
  VALUES (v_admin_id, 'ESONO Admin Local', 'admin@esono.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

  INSERT INTO user_roles (user_id, role) VALUES (v_admin_id, 'super_admin')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Admin local créé : admin@esono.local / Test123! (super_admin)';

  -- ════════════════════════════════════════════════════════════════════════
  -- 3) PE — Org "Adiwale Test" code=ADW + 6 users + team + deals
  -- ════════════════════════════════════════════════════════════════════════

  INSERT INTO organizations (id, name, slug, type, code, country, is_active)
  VALUES (v_pe_org, 'Adiwale Test', 'adiwale-test', 'pe', 'ADW', 'Côte d''Ivoire', true)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, type = 'pe';

  -- 3.1) Managing Director
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
  VALUES (v_md_id, '00000000-0000-0000-0000-000000000000', 'md@adiwale.local', bf_pwd, now(),
    jsonb_build_object('full_name', 'K. N''Guessan', 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
  INSERT INTO auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  VALUES (v_md_id, 'email', v_md_id::text,
    jsonb_build_object('sub', v_md_id::text, 'email', 'md@adiwale.local', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;
  INSERT INTO profiles (user_id, full_name, email) VALUES (v_md_id, 'K. N''Guessan', 'md@adiwale.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  VALUES (v_pe_org, v_md_id, 'managing_director', true)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'managing_director', is_active = true;

  -- 3.2) Investment Manager 1 (A. Diallo)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
  VALUES (v_im_id, '00000000-0000-0000-0000-000000000000', 'im1@adiwale.local', bf_pwd, now(),
    jsonb_build_object('full_name', 'A. Diallo', 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
  INSERT INTO auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  VALUES (v_im_id, 'email', v_im_id::text,
    jsonb_build_object('sub', v_im_id::text, 'email', 'im1@adiwale.local', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;
  INSERT INTO profiles (user_id, full_name, email) VALUES (v_im_id, 'A. Diallo', 'im1@adiwale.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  VALUES (v_pe_org, v_im_id, 'investment_manager', true)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'investment_manager', is_active = true;

  -- 3.3) Investment Manager 2 (B. Senghor)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
  VALUES (v_im2_id, '00000000-0000-0000-0000-000000000000', 'im2@adiwale.local', bf_pwd, now(),
    jsonb_build_object('full_name', 'B. Senghor', 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
  INSERT INTO auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  VALUES (v_im2_id, 'email', v_im2_id::text,
    jsonb_build_object('sub', v_im2_id::text, 'email', 'im2@adiwale.local', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;
  INSERT INTO profiles (user_id, full_name, email) VALUES (v_im2_id, 'B. Senghor', 'im2@adiwale.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  VALUES (v_pe_org, v_im2_id, 'investment_manager', true)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'investment_manager', is_active = true;

  -- 3.4) Analyst 1 (S. Koné — sous A. Diallo)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
  VALUES (v_analyst1_id, '00000000-0000-0000-0000-000000000000', 'analyst1@adiwale.local', bf_pwd, now(),
    jsonb_build_object('full_name', 'S. Koné', 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
  INSERT INTO auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  VALUES (v_analyst1_id, 'email', v_analyst1_id::text,
    jsonb_build_object('sub', v_analyst1_id::text, 'email', 'analyst1@adiwale.local', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;
  INSERT INTO profiles (user_id, full_name, email) VALUES (v_analyst1_id, 'S. Koné', 'analyst1@adiwale.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  VALUES (v_pe_org, v_analyst1_id, 'analyst', true)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'analyst', is_active = true;

  -- 3.5) Analyst 2 (A. Touré — sous A. Diallo)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
  VALUES (v_analyst2_id, '00000000-0000-0000-0000-000000000000', 'analyst2@adiwale.local', bf_pwd, now(),
    jsonb_build_object('full_name', 'A. Touré', 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
  INSERT INTO auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  VALUES (v_analyst2_id, 'email', v_analyst2_id::text,
    jsonb_build_object('sub', v_analyst2_id::text, 'email', 'analyst2@adiwale.local', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;
  INSERT INTO profiles (user_id, full_name, email) VALUES (v_analyst2_id, 'A. Touré', 'analyst2@adiwale.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  VALUES (v_pe_org, v_analyst2_id, 'analyst', true)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'analyst', is_active = true;

  -- 3.6) Analyst 3 (M. Diop — sous B. Senghor)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
  VALUES (v_analyst3_id, '00000000-0000-0000-0000-000000000000', 'analyst3@adiwale.local', bf_pwd, now(),
    jsonb_build_object('full_name', 'M. Diop', 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
  INSERT INTO auth.identities (user_id, provider, provider_id, identity_data, created_at, updated_at)
  VALUES (v_analyst3_id, 'email', v_analyst3_id::text,
    jsonb_build_object('sub', v_analyst3_id::text, 'email', 'analyst3@adiwale.local', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;
  INSERT INTO profiles (user_id, full_name, email) VALUES (v_analyst3_id, 'M. Diop', 'analyst3@adiwale.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  VALUES (v_pe_org, v_analyst3_id, 'analyst', true)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'analyst', is_active = true;

  RAISE NOTICE 'Org PE Adiwale Test + 6 users créés (md@/im1@/im2@/analyst1@/analyst2@/analyst3@adiwale.local)';

  -- ════════════════════════════════════════════════════════════════════════
  -- 4) PE TEAM ASSIGNMENTS : A. Diallo supervise S. Koné + A. Touré
  --                          B. Senghor supervise M. Diop
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO pe_team_assignments (organization_id, im_user_id, analyst_user_id, is_active, assigned_by)
  VALUES
    (v_pe_org, v_im_id, v_analyst1_id, true, v_md_id),
    (v_pe_org, v_im_id, v_analyst2_id, true, v_md_id),
    (v_pe_org, v_im2_id, v_analyst3_id, true, v_md_id)
  ON CONFLICT (organization_id, im_user_id, analyst_user_id) DO UPDATE SET is_active = true;

  RAISE NOTICE 'Team assignments PE : A. Diallo→[S.Koné,A.Touré], B. Senghor→[M.Diop]';

  -- ════════════════════════════════════════════════════════════════════════
  -- 5) ENTREPRISES PE de test
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO enterprises (id, organization_id, name, sector, country, contact_email, user_id, phase)
  VALUES
    (v_ent_pharmaci, v_pe_org, 'PharmaCi Industries SA', 'Pharma', 'Côte d''Ivoire', 'contact@pharmaci.ci', v_analyst1_id, 'identite'),
    (v_ent_logici, v_pe_org, 'LogiCi Express', 'Logistique', 'Côte d''Ivoire', 'ceo@logici.ci', v_analyst1_id, 'identite'),
    (v_ent_cleanwater, v_pe_org, 'CleanWater Ouaga', 'Eau & assainissement', 'Burkina Faso', 'dg@cleanwater.bf', v_analyst3_id, 'identite'),
    (v_ent_aquaculture, v_pe_org, 'AquaCulture Plus', 'Agro/aquaculture', 'Sénégal', 'dg@aquaculture.sn', v_analyst1_id, 'identite')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- ════════════════════════════════════════════════════════════════════════
  -- 6) PE DEALS : 6 deals dans différents stages
  -- ════════════════════════════════════════════════════════════════════════
  -- Le trigger génère deal_ref auto. On force des refs explicites pour idempotence.
  INSERT INTO pe_deals (organization_id, enterprise_id, deal_ref, stage, lead_analyst_id, ticket_demande, currency, source, score_360, created_by)
  VALUES
    (v_pe_org, v_ent_pharmaci,    'ADW-2026-001', 'pre_screening', v_analyst1_id, 4200000, 'EUR', 'reseau_pe', 74, v_analyst1_id),
    (v_pe_org, v_ent_logici,      'ADW-2026-002', 'pre_screening', v_analyst1_id, 3200000, 'EUR', 'inbound', 72, v_analyst1_id),
    (v_pe_org, NULL,              'ADW-2026-003', 'sourcing',      v_analyst2_id, 2500000, 'EUR', 'conference', NULL, v_analyst2_id),
    (v_pe_org, v_ent_cleanwater,  'ADW-2026-004', 'dd',            v_analyst3_id, 6000000, 'EUR', 'dfi', 68, v_analyst3_id),
    (v_pe_org, NULL,              'ADW-2026-005', 'sourcing',      v_analyst2_id, 1800000, 'EUR', 'reseau_pe', NULL, v_analyst2_id),
    (v_pe_org, v_ent_aquaculture, 'ADW-2026-006', 'analyse',       v_analyst1_id, 4800000, 'EUR', 'banque', NULL, v_analyst1_id)
  ON CONFLICT (organization_id, deal_ref) DO UPDATE
    SET stage = EXCLUDED.stage,
        ticket_demande = EXCLUDED.ticket_demande,
        lead_analyst_id = EXCLUDED.lead_analyst_id;

  RAISE NOTICE 'Org PE Adiwale Test : 6 deals créés (ADW-2026-001 à 006)';

  -- ════════════════════════════════════════════════════════════════════════
  -- 7) Add admin@esono.local en super_admin de toutes les orgs (pour navigation)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO organization_members (organization_id, user_id, role, is_active)
  SELECT id, v_admin_id, 'owner', true FROM organizations WHERE is_active = true
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner', is_active = true;

  RAISE NOTICE 'admin@esono.local ajouté comme owner de toutes les orgs';

END $$;

-- Récap final
SELECT 'admin' as kind, email, 'Test123!' as pwd FROM auth.users WHERE email = 'admin@esono.local'
UNION ALL
SELECT 'banque', email, 'Test123!' FROM auth.users WHERE email LIKE '%@nsia.local'
UNION ALL
SELECT 'pe', email, 'Test123!' FROM auth.users WHERE email LIKE '%@adiwale.local'
ORDER BY kind, email;
