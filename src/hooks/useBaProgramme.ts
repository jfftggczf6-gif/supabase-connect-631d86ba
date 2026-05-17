// src/hooks/useBaProgramme.ts
// Charge le programme BA actif de l'org (1 seul par org en V1, brief hors scope multi-appels).
// Si aucun n'existe : retourne null. La page propose alors un bouton "Créer l'appel"
// qui appellera manage-programme action=create avec type='banque_affaires'.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BaProgramme, FormField } from '@/types/candidature-ba';

interface State {
  programme: BaProgramme | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBaProgramme(organizationId: string | undefined): State {
  const [programme, setProgramme] = useState<BaProgramme | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('programmes')
        .select('id, organization_id, name, description, form_slug, form_fields, start_date, end_date, status, type')
        .eq('organization_id', organizationId)
        .eq('type', 'banque_affaires')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (qErr) throw qErr;

      if (!data) {
        setProgramme(null);
        return;
      }
      setProgramme({
        id: (data as any).id,
        organization_id: (data as any).organization_id,
        name: (data as any).name,
        description: (data as any).description ?? null,
        form_slug: (data as any).form_slug,
        form_fields: ((data as any).form_fields ?? []) as FormField[],
        start_date: (data as any).start_date ?? null,
        end_date: (data as any).end_date ?? null,
        status: (data as any).status ?? 'draft',
        type: 'banque_affaires',
      });
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement programme BA');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  return { programme, loading, error, reload: load };
}
