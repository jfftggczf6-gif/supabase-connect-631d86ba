// src/hooks/useMandatDetail.ts
// Charge un mandat BA (pe_deals where source='mandat_ba') + enterprise + compteurs.
// Sert le MandatShell : SubHeader (nom/secteur/pays/ticket/stage) + Sidebar (captions).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Mandat } from '@/types/ba';
import type { MandatDetailBundle, MandatStats, SectionStatus } from '@/types/ba-shell';
import { EXPECTED_DOCUMENTS_V1 } from '@/types/ba-shell';

interface State {
  bundle: MandatDetailBundle | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const EMPTY_STATS: MandatStats = {
  docs_received: 0,
  docs_expected: EXPECTED_DOCUMENTS_V1.length,
  sections_validated: 0,
  sections_total: 12,
  sections_draft: 0,
  sections_submitted: 0,
  sections_correction: 0,
  pre_screening_status: 'not_started',
  valuation_status: 'not_started',
  teaser_status: 'not_started',
  funds_contacted: 0,
};

/** Dérive un SectionStatus depuis la présence d'une row dans une table standalone.
 *  not_started si pas de row · empty si row vide · draft si en cours · validated sinon. */
function deriveStatusFromRow(row: { status?: string | null; created_at?: string | null } | null): SectionStatus {
  if (!row) return 'not_started';
  const s = row.status;
  if (!s) return 'draft';
  if (s === 'validated' || s === 'approved' || s === 'completed') return 'validated';
  if (s === 'submitted' || s === 'in_review') return 'submitted';
  if (s === 'correction' || s === 'rejected') return 'correction';
  if (s === 'empty') return 'empty';
  return 'draft';
}

export function useMandatDetail(
  dealId: string | undefined,
  organizationId: string | undefined,
): State {
  const [bundle, setBundle] = useState<MandatDetailBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dealId || !organizationId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Deal + enterprise jointure
      const { data: deal, error: dealErr } = await supabase
        .from('pe_deals')
        .select('id, deal_ref, enterprise_id, stage, ticket_demande, currency, lead_analyst_id, lead_im_id, score_360, source, source_detail, created_at, updated_at')
        .eq('id', dealId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (dealErr) throw dealErr;
      if (!deal) {
        setBundle(null);
        setError('Mandat introuvable');
        return;
      }

      let enterprise: MandatDetailBundle['enterprise'] = null;
      if ((deal as any).enterprise_id) {
        const { data: ent } = await supabase
          .from('enterprises')
          .select('id, name, sector, country')
          .eq('id', (deal as any).enterprise_id)
          .maybeSingle();
        if (ent) enterprise = { id: (ent as any).id, name: (ent as any).name, sector: (ent as any).sector ?? null, country: (ent as any).country ?? null };
      }

      // 2. Compteurs en parallèle (best effort — toute requête qui échoue → fallback empty)
      const [docsRes, memoVersionRes, valuationRes, fundsRes] = await Promise.all([
        supabase.from('pe_deal_documents').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
        // Memo : 1 deal = 1 investment_memo (potentiellement) → on récupère le memo_id puis les sections
        supabase.from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle(),
        supabase.from('pe_valuation').select('id, created_at').eq('deal_id', dealId).maybeSingle(),
        supabase.from('pe_deal_history').select('id', { count: 'exact', head: true }).eq('deal_id', dealId).in('to_stage', ['interets', 'nego']),
      ]);

      let sections_validated = 0, sections_draft = 0, sections_submitted = 0, sections_correction = 0, sections_total = 12;
      const memoId = (memoVersionRes.data as any)?.id;
      if (memoId) {
        // Récupérer la version active (max version_number ou is_current=true)
        const { data: ver } = await supabase
          .from('memo_versions')
          .select('id')
          .eq('memo_id', memoId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const verId = (ver as any)?.id;
        if (verId) {
          const { data: sections } = await supabase
            .from('memo_sections')
            .select('status')
            .eq('version_id', verId);
          const arr = (sections || []) as any[];
          if (arr.length) sections_total = arr.length;
          for (const s of arr) {
            if (s.status === 'validated') sections_validated++;
            else if (s.status === 'submitted') sections_submitted++;
            else if (s.status === 'correction') sections_correction++;
            else if (s.status === 'draft') sections_draft++;
          }
        }
      }

      // pre_screening : on vérifie deliverables ou pe_deal_history pour 'pre_screening'
      // Fallback simple : on regarde si pe_deal_history a transitionné par pre_screening
      const { data: psHistory } = await supabase
        .from('pe_deal_history')
        .select('id, to_stage, created_at')
        .eq('deal_id', dealId)
        .eq('to_stage', 'pre_screening')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const stats: MandatStats = {
        docs_received: docsRes.count ?? 0,
        docs_expected: EXPECTED_DOCUMENTS_V1.length,
        sections_validated, sections_total, sections_draft, sections_submitted, sections_correction,
        pre_screening_status: psHistory ? 'draft' : 'not_started',
        valuation_status: deriveStatusFromRow(valuationRes.data as any),
        teaser_status: 'not_started', // Feature pas encore buildée
        funds_contacted: fundsRes.count ?? 0,
      };

      // Map deal → Mandat
      const mandat: Mandat = {
        id: (deal as any).id,
        deal_ref: (deal as any).deal_ref,
        enterprise_id: (deal as any).enterprise_id ?? null,
        enterprise_name: enterprise?.name ?? null,
        sector: enterprise?.sector ?? null,
        country: enterprise?.country ?? null,
        stage: (deal as any).stage,
        ticket_demande: (deal as any).ticket_demande ?? null,
        currency: (deal as any).currency ?? null,
        lead_analyst_id: (deal as any).lead_analyst_id ?? null,
        lead_im_id: (deal as any).lead_im_id ?? null,
        score_360: (deal as any).score_360 ?? null,
        progress_pct: sections_total > 0 ? Math.round((sections_validated / sections_total) * 100) : 0,
        sections_in_review: sections_submitted,
        created_at: (deal as any).created_at,
        updated_at: (deal as any).updated_at,
      };

      setBundle({ mandat, enterprise, stats });
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement mandat');
    } finally {
      setLoading(false);
    }
  }, [dealId, organizationId]);

  useEffect(() => { load(); }, [load]);

  return { bundle, loading, error, reload: load };
}

export { EMPTY_STATS };
