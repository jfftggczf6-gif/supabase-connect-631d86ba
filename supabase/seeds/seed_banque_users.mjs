// Seed 4 users banque (3 rôles + 1 conseiller bidon) en local.
// Idempotent : si un user existe déjà avec cet email, on le récupère.
//
// Usage : node supabase/seeds/seed_banque_users.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const NSIA_ORG_ID = '66666666-6666-6666-6666-666666666666';

const USERS = [
  { email: 'conseiller@nsia.local',     password: 'Test123!', name: 'A. Kone',       role: 'conseiller_pme'  },
  { email: 'conseiller2@nsia.local',    password: 'Test123!', name: 'M. Diarra',     role: 'conseiller_pme'  },
  { email: 'analyste@nsia.local',       password: 'Test123!', name: 'M. Traore',     role: 'analyste_credit' },
  { email: 'directeur@nsia.local',      password: 'Test123!', name: 'S. Coulibaly',  role: 'directeur_pme'   },
];

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateUser({ email, password, name }) {
  // Try to find existing user
  const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users?.find(u => u.email === email);
  if (found) {
    console.log(`✓ User ${email} déjà existant (${found.id})`);
    return found.id;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  console.log(`✓ Créé ${email} → ${data.user.id}`);
  return data.user.id;
}

async function ensureProfile(userId, fullName) {
  // profiles row (best-effort)
  await sb.from('profiles').upsert({ id: userId, full_name: fullName }, { onConflict: 'id' });
}

async function ensureMembership(userId, role) {
  const { error } = await sb.from('organization_members').upsert(
    { organization_id: NSIA_ORG_ID, user_id: userId, role, is_active: true },
    { onConflict: 'organization_id,user_id' }
  );
  if (error) throw new Error(`membership ${userId}: ${error.message}`);
}

const ids = {};
for (const u of USERS) {
  const id = await getOrCreateUser(u);
  ids[u.email] = id;
  await ensureProfile(id, u.name);
  await ensureMembership(id, u.role);
}

console.log('\n=== IDs ===');
console.log(JSON.stringify(ids, null, 2));
