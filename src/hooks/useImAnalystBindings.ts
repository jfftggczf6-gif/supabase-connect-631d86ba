// src/hooks/useImAnalystBindings.ts
// CRUD direct front sur pe_team_assignments (binding IM ↔ Analyst).
// RLS pe_team_modify autorise INSERT/UPDATE pour managing_director / owner.
// Détermine quels mandats le Senior voit via RLS can_see_pe_deal.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ImAnalystBinding } from '@/types/equipe-ba';

interface State {
  bindings: ImAnalystBinding[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createBinding: (imUserId: string, analystUserId: string) => Promise<string | null>;
  toggleBinding: (bindingId: string, nextActive: boolean) => Promise<string | null>;
}

export function useImAnalystBindings(organizationId: string | undefined): State {
  const [bindings, setBindings] = useState<ImAnalystBinding[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: rowsErr } = await supabase
        .from('pe_team_assignments')
        .select('id, im_user_id, analyst_user_id, is_active, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (rowsErr) throw rowsErr;

      const userIds = [
        ...new Set(
          (rows || []).flatMap((r: any) => [r.im_user_id, r.analyst_user_id]).filter(Boolean),
        ),
      ] as string[];

      const { data: profs } = userIds.length
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
        : { data: [] as any[] };
      const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

      setBindings(
        (rows || []).map((r: any) => ({
          id: r.id,
          im_user_id: r.im_user_id,
          im_name: nameMap.get(r.im_user_id) ?? null,
          analyst_user_id: r.analyst_user_id,
          analyst_name: nameMap.get(r.analyst_user_id) ?? null,
          is_active: r.is_active,
          created_at: r.created_at,
        })),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement bindings');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const createBinding = useCallback(
    async (imUserId: string, analystUserId: string): Promise<string | null> => {
      if (!organizationId) return 'organization_id manquant';
      // Vérif idempotence : ne pas créer un doublon actif.
      const existing = bindings.find(
        (b) => b.im_user_id === imUserId && b.analyst_user_id === analystUserId && b.is_active,
      );
      if (existing) return 'Ce binding existe déjà.';

      const { error: insErr } = await supabase.from('pe_team_assignments').insert({
        organization_id: organizationId,
        im_user_id: imUserId,
        analyst_user_id: analystUserId,
        is_active: true,
      });
      if (insErr) return insErr.message;
      await load();
      return null;
    },
    [organizationId, bindings, load],
  );

  const toggleBinding = useCallback(
    async (bindingId: string, nextActive: boolean): Promise<string | null> => {
      const { error: updErr } = await supabase
        .from('pe_team_assignments')
        .update({ is_active: nextActive })
        .eq('id', bindingId);
      if (updErr) return updErr.message;
      await load();
      return null;
    },
    [load],
  );

  return { bindings, loading, error, reload: load, createBinding, toggleBinding };
}
