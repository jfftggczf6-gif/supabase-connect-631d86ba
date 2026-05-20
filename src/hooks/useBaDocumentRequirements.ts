// src/hooks/useBaDocumentRequirements.ts
// Charge la checklist documents configurable par org (brief P7 #27).
// Remplace la constante EXPECTED_DOCUMENTS_V1 hardcodée.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DocumentCategory } from '@/lib/document-parser';
import type { ExpectedDocument } from '@/types/upload-documents-ba';

export interface BaDocumentRequirementRow {
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
  requirements: ExpectedDocument[];
  rows: BaDocumentRequirementRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function toExpected(row: BaDocumentRequirementRow): ExpectedDocument {
  return {
    code: row.code,
    label: row.label,
    expectedCategory: row.category as DocumentCategory,
    required: row.required,
    hint: row.hint ?? undefined,
    filenamePatterns: row.filename_patterns?.length
      ? row.filename_patterns.map(p => new RegExp(p, 'i'))
      : undefined,
  };
}

export function useBaDocumentRequirements(organizationId: string | undefined): State {
  const [rows, setRows] = useState<BaDocumentRequirementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('ba_document_requirements')
        .select('id, organization_id, code, label, category, required, hint, filename_patterns, display_order')
        .eq('organization_id', organizationId)
        .order('display_order', { ascending: true });
      if (qErr) throw qErr;
      setRows((data || []) as BaDocumentRequirementRow[]);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement requirements');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  return {
    rows,
    requirements: rows.map(toExpected),
    loading,
    error,
    reload: load,
  };
}

/** Seed la table avec les 7 docs par défaut pour une org (idempotent). */
export async function seedBaRequirementsForOrg(organizationId: string) {
  const { error } = await supabase.rpc('seed_ba_document_requirements', { p_org_id: organizationId });
  if (error) throw new Error(error.message);
}
