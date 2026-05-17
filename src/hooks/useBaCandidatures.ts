// src/hooks/useBaCandidatures.ts
// Charge les candidatures d'un programme BA + KPIs + flag "convertie" via
// jointure pe_deals (source='candidature', candidature_id NOT NULL).
//
// Note : le hook query directement la table candidatures plutôt que via
// list-candidatures EF — pour récupérer aussi les form_data et permettre
// la dérivation des champs sector/country/ticket côté UI.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DB_TO_UI_STATUS,
  type CandidatureCounts,
  type CandidatureRow,
  type CandidatureStatusDb,
} from '@/types/candidature-ba';

interface State {
  candidatures: CandidatureRow[];
  counts: CandidatureCounts;
  /** IDs candidatures déjà converties en mandat (pe_deals.source_detail = candidature.id). */
  convertedIds: Set<string>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Extrait sector/country/ticket de form_data en cherchant par label clé. */
function extractDerived(formData: Record<string, unknown>): {
  sector: string | null;
  country: string | null;
  ticket: string | null;
} {
  // Les clés du form_data sont les labels (ou ids) des champs. On scan les
  // patterns connus du DEFAULT_FORM_FIELDS pour extraire les 3 champs critiques.
  const keys = Object.keys(formData);
  const findByPattern = (pattern: RegExp): string | null => {
    const key = keys.find(k => pattern.test(k));
    if (!key) return null;
    const value = formData[key];
    return typeof value === 'string' ? value : value != null ? String(value) : null;
  };
  return {
    sector: findByPattern(/secteur/i),
    country: findByPattern(/pays/i),
    ticket: findByPattern(/ticket/i),
  };
}

export function useBaCandidatures(
  programmeId: string | undefined,
  organizationId: string | undefined,
): State {
  const [candidatures, setCandidatures] = useState<CandidatureRow[]>([]);
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!programmeId || !organizationId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Candidatures du programme
      const { data: rows, error: qErr } = await supabase
        .from('candidatures')
        .select('id, programme_id, organization_id, company_name, contact_name, contact_email, contact_phone, form_data, status, screening_score, screening_data, created_at')
        .eq('programme_id', programmeId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;

      // 2. Jointure pe_deals : quelles candidatures sont déjà converties ?
      // submit-candidature ne crée PAS de pe_deal pour les orgs BA (cond. orgType=='pe').
      // Le bouton "→ Créer le mandat" passe candidature.id dans source_detail,
      // donc on track la conversion via cette colonne.
      const candIds = (rows || []).map((r: any) => r.id);
      let converted = new Set<string>();
      if (candIds.length) {
        const { data: deals } = await supabase
          .from('pe_deals')
          .select('source_detail')
          .eq('organization_id', organizationId)
          .eq('source', 'mandat_ba')
          .in('source_detail', candIds);
        converted = new Set((deals || []).map((d: any) => d.source_detail).filter(Boolean));
      }
      setConvertedIds(converted);

      // 3. Mapping DB → UI + extraction champs dérivés
      setCandidatures((rows || []).map((r: any) => {
        const derived = extractDerived(r.form_data || {});
        return {
          id: r.id,
          programme_id: r.programme_id,
          organization_id: r.organization_id,
          company_name: r.company_name,
          contact_name: r.contact_name ?? null,
          contact_email: r.contact_email,
          contact_phone: r.contact_phone ?? null,
          form_data: r.form_data ?? {},
          status: DB_TO_UI_STATUS[r.status as CandidatureStatusDb] ?? 'new',
          screening_score: r.screening_score ?? null,
          screening_data: r.screening_data ?? null,
          created_at: r.created_at,
          sector: derived.sector,
          country: derived.country,
          ticket: derived.ticket,
        };
      }));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement candidatures');
    } finally {
      setLoading(false);
    }
  }, [programmeId, organizationId]);

  useEffect(() => { load(); }, [load]);

  const counts: CandidatureCounts = {
    new: candidatures.filter(c => c.status === 'new').length,
    reviewing: candidatures.filter(c => c.status === 'reviewing').length,
    accepted: candidatures.filter(c => c.status === 'accepted').length,
    rejected: candidatures.filter(c => c.status === 'rejected').length,
  };

  return { candidatures, counts, convertedIds, loading, error, reload: load };
}
