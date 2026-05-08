// useFxRates — Lit les taux de change globaux depuis fx_rates_cache.
// Si la dernière mise à jour a plus de STALE_HOURS heures (ou n'a jamais
// eu lieu), déclenche automatiquement l'edge fn `fetch-fx-rates` pour
// rafraîchir, puis relit la table.
//
// Retourne aussi un `refresh()` manuel (bouton dans Paramètres).

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FxRates } from '@/lib/currency-conversion';

const STALE_HOURS = 24;

export interface FxRatesState {
  rates: FxRates;
  lastFetchedAt: string | null;
  source: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

let inflightAutoRefresh: Promise<void> | null = null;

export function useFxRates(): FxRatesState {
  const [rates, setRates] = useState<FxRates>({});
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggeredAutoRef = useRef(false);

  const read = useCallback(async () => {
    const { data, error } = await supabase
      .from('fx_rates_cache' as any)
      .select('rates, last_fetched_at, source')
      .eq('id', 'eur_base')
      .maybeSingle();
    if (error) {
      setError(error.message);
      return null;
    }
    if (data) {
      setRates(((data as any).rates ?? {}) as FxRates);
      setLastFetchedAt((data as any).last_fetched_at ?? null);
      setSource((data as any).source ?? null);
    }
    return data;
  }, []);

  const triggerFetch = useCallback(async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('fetch-fx-rates', { body: {} });
      if (error) throw error;
      await read();
    } catch (e: any) {
      setError(e?.message ?? 'fetch-fx-rates failed');
    } finally {
      setRefreshing(false);
    }
  }, [read]);

  // Lecture initiale + déclenchement auto si stale
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const row = await read();
      setLoading(false);
      if (cancelled || triggeredAutoRef.current) return;

      const fetchedAt = (row as any)?.last_fetched_at;
      const stale =
        !fetchedAt ||
        Date.now() - new Date(fetchedAt).getTime() > STALE_HOURS * 3600 * 1000;
      if (stale) {
        triggeredAutoRef.current = true;
        // Déduplique entre instances simultanées du hook
        if (!inflightAutoRefresh) {
          inflightAutoRefresh = triggerFetch().finally(() => {
            inflightAutoRefresh = null;
          });
        }
        await inflightAutoRefresh;
      }
    })();
    return () => { cancelled = true; };
  }, [read, triggerFetch]);

  return {
    rates,
    lastFetchedAt,
    source,
    loading,
    refreshing,
    error,
    refresh: triggerFetch,
  };
}
