// src/hooks/useBaProgrammes.ts
// Liste tous les programmes BA (= appels à candidatures) de l'org, triés par
// created_at desc. Remplace l'ancien useBaProgramme singleton.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BaProgramme, FormField } from '@/types/candidature-ba';

interface State {
  programmes: BaProgramme[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBaProgrammes(organizationId: string | undefined): State {
  const [programmes, setProgrammes] = useState<BaProgramme[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('programmes')
        .select('id, organization_id, name, description, form_slug, form_fields, start_date, end_date, status, type, country_filter, sector_filter, created_at')
        .eq('organization_id', organizationId)
        .eq('type', 'banque_affaires')
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;

      setProgrammes((data || []).map((row: any) => ({
        id: row.id,
        organization_id: row.organization_id,
        name: row.name,
        description: row.description ?? null,
        form_slug: row.form_slug,
        form_fields: (row.form_fields ?? []) as FormField[],
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
        status: row.status ?? 'draft',
        type: 'banque_affaires',
        country_filter: Array.isArray(row.country_filter) ? row.country_filter : [],
        sector_filter: Array.isArray(row.sector_filter) ? row.sector_filter : [],
        created_at: row.created_at,
      })));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement appels BA');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  return { programmes, loading, error, reload: load };
}
