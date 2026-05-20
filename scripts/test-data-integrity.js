#!/usr/bin/env node
/**
 * scripts/test-data-integrity.js — Quality Gate P8
 *
 * Vérifie l'intégrité des données :
 *  - memo_versions sans investment_memo → 0
 *  - pe_deals sans enterprise           → 0
 *  - ai_jobs pending > 1h               → 0
 *  - deliverables sans enterprise_id    → 0
 *  - ba_document_requirements count > 0 par org BA
 *  - pe_dd_requirements count > 0 par org PE
 *
 * Utilise le service role key — destiné à tourner en CI/QA avec accès admin.
 * En local sans service key, le script saute le test mais reste passant.
 *
 * Exit 0 si OK, exit 1 sinon.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://flgxbwmxwdfzeuufcxti.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_yZqyseUdiisQfiaUgjN65A_LSlPWZ1E';

let passed = 0;
let failed = 0;
let warned = 0;
const issues = [];

function ok(msg)   { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; issues.push(msg); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warned++; }

async function check(label, fn) {
  try {
    await fn();
  } catch (e) {
    fail(`${label} : ${e.message}`);
  }
}

async function main() {
  console.log('🔍 Test intégrité données (Supabase staging)');
  const useServiceRole = !!SERVICE_KEY;
  if (!useServiceRole) {
    warn('SUPABASE_SERVICE_ROLE_KEY non défini — tests intégrité limités au scope anon/RLS.');
  }
  const sb = createClient(SUPABASE_URL, useServiceRole ? SERVICE_KEY : ANON_KEY);

  // 1. memo_versions sans investment_memo (orphans)
  await check('memo_versions orphelins', async () => {
    const { data: versions } = await sb.from('memo_versions').select('id, memo_id');
    const { data: memos } = await sb.from('investment_memos').select('id');
    const memoIds = new Set((memos || []).map(m => m.id));
    const orphans = (versions || []).filter(v => !memoIds.has(v.memo_id));
    if (orphans.length === 0) ok('Aucun memo_version orphelin');
    else fail(`${orphans.length} memo_versions orphelins`);
  });

  // 2. pe_deals sans enterprise
  await check('pe_deals sans enterprise', async () => {
    const { data, error } = await sb.from('pe_deals').select('id, enterprise_id, deal_ref');
    if (error) throw error;
    const orphans = (data || []).filter(d => !d.enterprise_id);
    if (orphans.length === 0) ok(`${(data || []).length} pe_deals tous attachés à une enterprise`);
    else fail(`${orphans.length} pe_deals sans enterprise_id`);
  });

  // 3. ai_jobs pending depuis > 1h
  await check('ai_jobs pending > 1h', async () => {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data, error } = await sb
      .from('ai_jobs')
      .select('id, status, created_at')
      .in('status', ['pending', 'running'])
      .lt('created_at', oneHourAgo);
    if (error) throw error;
    if ((data || []).length === 0) ok('Aucun ai_job pending depuis > 1h');
    else fail(`${data.length} ai_jobs pending depuis > 1h (zombies)`);
  });

  // 4. deliverables sans enterprise_id
  await check('deliverables sans enterprise', async () => {
    const { data, error } = await sb.from('deliverables').select('id, enterprise_id');
    if (error) throw error;
    const orphans = (data || []).filter(d => !d.enterprise_id);
    if (orphans.length === 0) ok(`${(data || []).length} deliverables tous attachés à une enterprise`);
    else fail(`${orphans.length} deliverables sans enterprise_id`);
  });

  // 5. ba_document_requirements count > 0 par org BA
  await check('ba_document_requirements par org BA', async () => {
    const { data: orgs, error: orgErr } = await sb.from('organizations').select('id, name, type').eq('type', 'banque_affaires');
    if (orgErr) throw orgErr;
    if (!orgs || orgs.length === 0) {
      warn('Aucune org BA trouvée');
      return;
    }
    let allOk = true;
    for (const o of orgs) {
      const { count } = await sb
        .from('ba_document_requirements')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', o.id);
      if ((count ?? 0) > 0) ok(`Org BA "${o.name}" : ${count} ba_document_requirements`);
      else { fail(`Org BA "${o.name}" : 0 ba_document_requirements (non seedée !)`); allOk = false; }
    }
    if (!allOk) return;
  });

  // 6. pe_dd_requirements count > 0 par org PE
  await check('pe_dd_requirements par org PE', async () => {
    const { data: orgs, error: orgErr } = await sb.from('organizations').select('id, name, type').in('type', ['pe', 'mixed']);
    if (orgErr) throw orgErr;
    if (!orgs || orgs.length === 0) {
      warn('Aucune org PE/mixed trouvée');
      return;
    }
    for (const o of orgs) {
      const { count } = await sb
        .from('pe_dd_requirements')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', o.id);
      if ((count ?? 0) > 0) ok(`Org PE "${o.name}" : ${count} pe_dd_requirements`);
      else fail(`Org PE "${o.name}" : 0 pe_dd_requirements (non seedée !)`);
    }
  });

  console.log(`\n📊 Résultat : ${passed} passed · ${failed} failed · ${warned} warned`);
  if (failed > 0) {
    console.log('\n❌ Issues:');
    issues.forEach(i => console.log(`   • ${i}`));
    process.exit(1);
  }
  console.log('\n✅ Données cohérentes — aucune incohérence détectée.');
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
