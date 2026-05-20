#!/usr/bin/env node
/**
 * scripts/test-edge-functions.js — Quality Gate P8
 *
 * Vérifie que chaque EF :
 *  1. Répond 200 (ou CORS-headers) au préflight OPTIONS
 *  2. Refuse l'appel POST sans auth (401 ou 400 attendu, PAS 200/500)
 *
 * Exit 0 si OK, exit 1 sinon.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://flgxbwmxwdfzeuufcxti.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_yZqyseUdiisQfiaUgjN65A_LSlPWZ1E';

const EDGE_FUNCTIONS = [
  'generate-pe-pre-screening',
  'generate-ic1-memo',
  'generate-pe-valuation',
  'generate-teaser-ba',
  'match-deal-funds',
  'send-teaser-to-fund',
  'share-im-after-nda',
  'create-pe-deal-from-ba',
  'render-document',
  'access-data-room',
  'share-pe-data-room',
  'analyze-pe-deal-note',
  'regenerate-pe-section',
  'aggregate-benchmarks',
];

let passed = 0;
let failed = 0;
const issues = [];

function logOk(msg)   { console.log(`  ✅ ${msg}`); passed++; }
function logFail(msg) { console.log(`  ❌ ${msg}`); failed++; issues.push(msg); }

async function testEdgeFunction(fn) {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;

  // 1. CORS preflight
  try {
    const optRes = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8080',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    if (optRes.status === 200 || optRes.status === 204) {
      logOk(`${fn} · CORS preflight ${optRes.status}`);
    } else {
      logFail(`${fn} · CORS preflight HTTP ${optRes.status}`);
    }
  } catch (e) {
    logFail(`${fn} · CORS preflight error : ${e.message}`);
  }

  // 2. POST sans auth (uniquement avec apikey anon, pas de Bearer)
  // - access-data-room est publique (utilise un token applicatif) → on saute le check auth strict
  // - Les autres EF doivent retourner 401/400 (rejette sans Bearer JWT user)
  if (fn === 'access-data-room') {
    // EF publique (appelée depuis DataRoomPublic sans login).
    // Acceptés : 400 (token requis) OU 401 (Supabase verify_jwt strict).
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({}),
      });
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        logOk(`${fn} · POST sans token → ${res.status} (rejet OK)`);
      } else {
        logFail(`${fn} · POST sans token attendu 400/401/403, reçu ${res.status}`);
      }
    } catch (e) {
      logFail(`${fn} · POST sans token error : ${e.message}`);
    }
    return;
  }

  // aggregate-benchmarks : EF cron/public d'aggrégation — verify_jwt=false intentionnel.
  // On vérifie juste que l'EF répond (200 ou 4xx).
  if (fn === 'aggregate-benchmarks') {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({}),
      });
      if (res.status < 500) {
        logOk(`${fn} · POST → ${res.status} (EF cron publique, OK)`);
      } else {
        logFail(`${fn} · POST → ${res.status} (erreur serveur)`);
      }
    } catch (e) {
      logFail(`${fn} · POST error : ${e.message}`);
    }
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({}),
    });
    // 401 = pas authentifié (Supabase verify_jwt=true)
    // 400 = body invalide (mais auth ok via apikey, plus rare)
    // Tout sauf 200/500 est OK pour "auth requise"
    if (res.status === 401 || res.status === 403) {
      logOk(`${fn} · POST sans Bearer → ${res.status} (sécurisé)`);
    } else if (res.status === 400) {
      logOk(`${fn} · POST sans Bearer → 400 (body invalide accepté)`);
    } else if (res.status === 200) {
      logFail(`${fn} · POST sans Bearer → 200 (FAILLE : EF publique !)`);
    } else {
      logFail(`${fn} · POST sans Bearer → ${res.status} (statut inattendu)`);
    }
  } catch (e) {
    logFail(`${fn} · POST sans Bearer error : ${e.message}`);
  }
}

async function main() {
  console.log(`🔌 Test Edge Functions sur ${SUPABASE_URL}`);
  console.log(`   ${EDGE_FUNCTIONS.length} EFs × 2 checks = ${EDGE_FUNCTIONS.length * 2} assertions\n`);

  for (const fn of EDGE_FUNCTIONS) {
    await testEdgeFunction(fn);
  }

  console.log(`\n📊 Résultat : ${passed} passed · ${failed} failed`);
  if (failed > 0) {
    console.log('\n❌ Issues:');
    issues.forEach(i => console.log(`   • ${i}`));
    process.exit(1);
  }
  console.log('\n✅ Toutes les EFs sont actives et sécurisées.');
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
