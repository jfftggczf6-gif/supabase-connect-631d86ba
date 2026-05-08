// fetch-fx-rates — Récupère les taux de change EUR → USD/XOF/XAF depuis
// Frankfurter (ECB, gratuit, pas de clé requise) et les écrit dans la table
// fx_rates_cache (singleton, id = 'eur_base').
//
// XOF/XAF sont des parités fixes (655.957) — pas besoin de les fetch.
// Seul USD est dynamique. Si l'API échoue, on conserve les valeurs précédentes.
//
// Appelable par tout utilisateur authentifié (lecture seule du résultat).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIXED_RATES = {
  EUR: 1,
  XOF: 655.957,
  XAF: 655.957,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const fxResp = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD');
    if (!fxResp.ok) throw new Error(`Frankfurter API HTTP ${fxResp.status}`);
    const fxData = await fxResp.json();
    const usdRate = fxData?.rates?.USD;
    if (typeof usdRate !== 'number') throw new Error('USD rate manquant dans la réponse API');

    const newRates = { ...FIXED_RATES, USD: usdRate };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase
      .from('fx_rates_cache')
      .upsert({
        id: 'eur_base',
        rates: newRates,
        base: 'EUR',
        source: 'frankfurter (ECB)',
        last_fetched_at: new Date().toISOString(),
      });

    if (error) throw new Error(`DB upsert: ${error.message}`);

    return new Response(
      JSON.stringify({ ok: true, rates: newRates, fetched_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
