// src/hooks/useBaBenchmarks.ts
// Charge le benchmark knowledge_benchmarks pertinent pour un mandat
// (filtré par secteur du deal, fallback par zone si pays pas trouvé).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SectorBenchmark } from '@/types/benchmarks-ba';

interface State {
  benchmark: SectorBenchmark | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBaBenchmarks(
  dealId: string | undefined,
): State {
  const [benchmark, setBenchmark] = useState<SectorBenchmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Récup secteur + pays du deal
      const { data: deal, error: dErr } = await supabase
        .from('pe_deals')
        .select('enterprise_id')
        .eq('id', dealId)
        .maybeSingle();
      if (dErr) throw dErr;
      const entId = (deal as any)?.enterprise_id;
      if (!entId) {
        setBenchmark(null);
        return;
      }

      const { data: ent, error: eErr } = await supabase
        .from('enterprises')
        .select('sector, country')
        .eq('id', entId)
        .maybeSingle();
      if (eErr) throw eErr;
      const secteur = (ent as any)?.sector as string | null;
      const pays = (ent as any)?.country as string | null;

      if (!secteur) {
        setBenchmark(null);
        return;
      }

      // 2. Match secteur + pays exact
      let { data: rows } = await supabase
        .from('knowledge_benchmarks')
        .select('*')
        .ilike('secteur', secteur)
        .eq('pays', pays);

      // 3. Fallback : match secteur + zone UEMOA
      if (!rows?.length) {
        const { data: zoneRows } = await supabase
          .from('knowledge_benchmarks')
          .select('*')
          .ilike('secteur', secteur)
          .eq('zone', 'UEMOA');
        rows = zoneRows;
      }

      // 4. Fallback : match secteur seul (premier match)
      if (!rows?.length) {
        const { data: anyRow } = await supabase
          .from('knowledge_benchmarks')
          .select('*')
          .ilike('secteur', secteur)
          .limit(1);
        rows = anyRow;
      }

      setBenchmark(rows?.[0] ? (rows[0] as any as SectorBenchmark) : null);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement benchmarks');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  return { benchmark, loading, error, reload: load };
}
