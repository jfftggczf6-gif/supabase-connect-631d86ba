-- Seed 4 users banque (NSIA) directement en SQL.
-- Password "Test123!" haché avec crypt() (compatible GoTrue).
-- Idempotent : ON CONFLICT update.

DO $$
DECLARE
  uid uuid;
  user_email text;
  user_name text;
  user_role text;
  bf_pwd text := crypt('Test123!', gen_salt('bf'));
  -- IDs fixes pour faciliter les références dans les seeds qui suivent
  conseiller_id  uuid := '11111111-aaaa-aaaa-aaaa-111111111111';
  conseiller2_id uuid := '22222222-aaaa-aaaa-aaaa-222222222222';
  analyste_id    uuid := '33333333-aaaa-aaaa-aaaa-333333333333';
  directeur_id   uuid := '44444444-aaaa-aaaa-aaaa-444444444444';
  nsia_org_id    uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  FOR uid, user_email, user_name, user_role IN VALUES
    (conseiller_id,  'conseiller@nsia.local',  'A. Kone',      'conseiller_pme'),
    (conseiller2_id, 'conseiller2@nsia.local', 'M. Diarra',    'conseiller_pme'),
    (analyste_id,    'analyste@nsia.local',    'M. Traore',    'analyste_credit'),
    (directeur_id,   'directeur@nsia.local',   'S. Coulibaly', 'directeur_pme')
  LOOP
    -- auth.users
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, confirmation_token,
      recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data,
      aud, role,
      created_at, updated_at, last_sign_in_at
    ) VALUES (
      uid,
      '00000000-0000-0000-0000-000000000000',
      user_email,
      bf_pwd,
      NOW(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('sub', uid::text, 'email', user_email, 'full_name', user_name, 'email_verified', true),
      'authenticated',
      'authenticated',
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = EXCLUDED.encrypted_password,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = NOW();

    -- auth.identities (provider email)
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      uid,
      user_email,
      'email',
      jsonb_build_object('sub', uid::text, 'email', user_email, 'email_verified', true),
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();

    -- profiles (best-effort)
    INSERT INTO profiles (user_id, full_name, email)
    VALUES (uid, user_name, user_email)
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

    -- organization_members (rôle banque dans NSIA)
    INSERT INTO organization_members (organization_id, user_id, role, is_active)
    VALUES (nsia_org_id, uid, user_role, true)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
      role = EXCLUDED.role,
      is_active = true;
  END LOOP;
END $$;

-- Vérifications
\echo '=== Users créés ==='
SELECT u.id, u.email, p.full_name, om.role
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = '66666666-6666-6666-6666-666666666666'::uuid
 WHERE u.email LIKE '%@nsia.local'
 ORDER BY u.email;
