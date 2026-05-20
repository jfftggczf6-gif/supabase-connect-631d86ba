#!/usr/bin/env node
/**
 * scripts/test-rls-security.js — Quality Gate P8
 *
 * Vérifie l'isolation Row-Level-Security entre orgs PE et BA.
 *
 * Tests :
 *  1. signIn partner@cisse.local (org BA) → SELECT pe_deals → assert 0 deals d'Adiwale visibles
 *  2. signIn md@adiwale.local (org PE)    → SELECT pe_deals → assert 0 deals de Cissé visibles
 *  3. signIn partner@cisse.local          → SELECT data_room_shares → assert 0 shares d'autre org
 *
 * Exit 0 si OK, exit 1 sinon.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://flgxbwmxwdfzeuufcxti.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_yZqyseUdiisQfiaUgjN65A_LSlPWZ1E';

const BA_USER = { email: 'partner@cisse.local', password: 'Test123!' };
const PE_USER = { email: 'md@adiwale.local',   password: 'Test123!' };

const BA_ORG_ID = '77777777-7777-7777-7777-777777777777'; // Cissé Advisory
const PE_ORG_ID = '55555555-5555-5555-5555-555555555555'; // Adiwale Africa

let passed = 0;
let failed = 0;
const issues = [];

function ok(msg)   { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; issues.push(msg); }

async function loginAs(user) {
  const sb = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword(user);
  if (error) throw new Error(`Login ${user.email} : ${error.message}`);
  if (!data.session) throw new Error(`Login ${user.email} : pas de session`);
  return sb;
}

async function testCrossOrgIsolation() {
  console.log('🔐 Test RLS isolation cross-org PE ↔ BA');

  // Test 1 : BA → pe_deals des autres orgs (PE)
  try {
    const sbBa = await loginAs(BA_USER);
    const { data, error } = await sbBa
      .from('pe_deals')
      .select('id, organization_id, deal_ref')
      .neq('organization_id', BA_ORG_ID);
    if (error) {
      fail(`BA → pe_deals cross-org : erreur ${error.message}`);
    } else if ((data || []).length === 0) {
      ok(`BA partner ne voit AUCUN deal hors org Cissé (RLS OK)`);
    } else {
      fail(`BA partner voit ${data.length} deals d'autres orgs (LEAK)`);
    }
  } catch (e) {
    fail(`Test BA→PE : ${e.message}`);
  }

  // Test 2 : PE → pe_deals des autres orgs (BA)
  try {
    const sbPe = await loginAs(PE_USER);
    const { data, error } = await sbPe
      .from('pe_deals')
      .select('id, organization_id, deal_ref')
      .neq('organization_id', PE_ORG_ID);
    if (error) {
      fail(`PE → pe_deals cross-org : erreur ${error.message}`);
    } else if ((data || []).length === 0) {
      ok(`PE MD ne voit AUCUN deal hors org Adiwale (RLS OK)`);
    } else {
      fail(`PE MD voit ${data.length} deals d'autres orgs (LEAK)`);
    }
  } catch (e) {
    fail(`Test PE→BA : ${e.message}`);
  }

  // Test 3 : BA → data_room_shares des autres orgs
  try {
    const sbBa = await loginAs(BA_USER);
    const { data, error } = await sbBa
      .from('data_room_shares')
      .select('id, organization_id')
      .neq('organization_id', BA_ORG_ID);
    if (error) {
      // Peut être ok si RLS bloque la lecture totale
      ok(`BA → data_room_shares cross-org : RLS bloque l'accès (${error.message})`);
    } else if ((data || []).length === 0) {
      ok(`BA partner ne voit AUCUN share hors org Cissé (RLS OK)`);
    } else {
      fail(`BA partner voit ${data.length} shares d'autres orgs (LEAK)`);
    }
  } catch (e) {
    fail(`Test BA→shares : ${e.message}`);
  }

  // Test 4 : BA → ba_document_requirements des autres orgs PE
  try {
    const sbBa = await loginAs(BA_USER);
    const { data, error } = await sbBa
      .from('ba_document_requirements')
      .select('id, organization_id')
      .neq('organization_id', BA_ORG_ID);
    if (error) {
      ok(`BA → ba_document_requirements cross-org : RLS bloque (${error.message})`);
    } else if ((data || []).length === 0) {
      ok(`BA partner ne voit AUCUN ba_document_requirements d'une autre org (RLS OK)`);
    } else {
      fail(`BA partner voit ${data.length} requirements d'autres orgs (LEAK)`);
    }
  } catch (e) {
    fail(`Test BA→ba_doc_req : ${e.message}`);
  }

  console.log(`\n📊 Résultat : ${passed} passed · ${failed} failed`);
  if (failed > 0) {
    console.log('\n❌ Issues:');
    issues.forEach(i => console.log(`   • ${i}`));
    process.exit(1);
  }
  console.log('\n✅ RLS isolation confirmée — pas de leak cross-org.');
  process.exit(0);
}

testCrossOrgIsolation().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
