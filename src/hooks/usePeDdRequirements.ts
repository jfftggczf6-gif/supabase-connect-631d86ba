// src/hooks/usePeDdRequirements.ts
// Charge la checklist Due Diligence configurable par fonds PE (brief #36).
// Pattern aligné sur useBaDocumentRequirements.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PeDdRequirementRow {
  id: string;
  organization_id: string;
  code: string;
  label: string;
  category: string;
  required: boolean;
  hint: string | null;
  filename_patterns: string[] | null;
  display_order: number;
}

interface State {
  rows: PeDdRequirementRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function usePeDdRequirements(organizationId: string | undefined): State {
  const [rows, setRows] = useState<PeDdRequirementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('pe_dd_requirements' as any)
        .select('id, organization_id, code, label, category, required, hint, filename_patterns, display_order')
        .eq('organization_id', organizationId)
        .order('display_order', { ascending: true });
      if (qErr) throw qErr;
      setRows((data || []) as PeDdRequirementRow[]);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement requirements DD');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, reload: load };
}

/** Seed la table avec les 10 docs DD par défaut pour une org (idempotent). */
export async function seedPeDdRequirementsForOrg(organizationId: string) {
  const { error } = await supabase.rpc('seed_pe_dd_requirements' as any, { p_org_id: organizationId });
  if (error) throw new Error(error.message);
}
