// src/hooks/useSyntheseBa.ts
// Charge tous les mandats BA de l'org + calcule KPIs + business synthèse.
// Brief synthese_partner critère #6 : données depuis pe_deals + pe_deal_history.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Mandat } from '@/types/ba';
import {
  ACTIVE_STAGES, STRUCTURATION_STAGES, DIFFUSION_STAGES, DEFAULT_SUCCESS_FEE_PCT,
  type SyntheseBundle, type SyntheseKpis, type BusinessSynthese,
} from '@/types/synthese-ba';

interface State {
  bundle: SyntheseBundle;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const EMPTY: SyntheseBundle = {
  mandats: [],
  kpis: { actifs: 0, structuration: 0, diffusion: 0, close_ytd: 0 },
  business: {
    pipeline_value_usd: 0,
    success_fees_potential_usd: 0,
    deals_closed_ytd: 0,
    win_rate_ytd: null,
    success_fee_pct: DEFAULT_SUCCESS_FEE_PCT,
  },
};

/** Calcule les 4 KPIs depuis la liste des mandats. */
function computeKpis(mandats: Mandat[]): SyntheseKpis {
  const currentYear = new Date().getFullYear();
  let actifs = 0, structuration = 0, diffusion = 0, close_ytd = 0;
  for (const m of mandats) {
    if (ACTIVE_STAGES.has(m.stage)) actifs++;
    if (STRUCTURATION_STAGES.has(m.stage)) structuration++;
    if (DIFFUSION_STAGES.has(m.stage)) diffusion++;
    if (m.stage === 'close' && m.updated_at) {
      const y = new Date(m.updated_at).getFullYear();
      if (y === currentYear) close_ytd++;
    }
  }
  return { actifs, structuration, diffusion, close_ytd };
}

/** Calcule la synthèse business. */
function computeBusiness(mandats: Mandat[], successFeePct: number): BusinessSynthese {
  const currentYear = new Date().getFullYear();
  let pipeline_value_usd = 0;
  let deals_closed_ytd = 0;
  let deals_lost_ytd = 0;
  for (const m of mandats) {
    if (ACTIVE_STAGES.has(m.stage) && m.ticket_demande) {
      pipeline_value_usd += m.ticket_demande;
    }
    if (m.updated_at && new Date(m.updated_at).getFullYear() === currentYear) {
      if (m.stage === 'close') deals_closed_ytd++;
      if (m.stage === 'lost') deals_lost_ytd++;
    }
  }
  const success_fees_potential_usd = pipeline_value_usd * successFeePct;
  const totalDecided = deals_closed_ytd + deals_lost_ytd;
  const win_rate_ytd = totalDecided > 0 ? deals_closed_ytd / totalDecided : null;
  return {
    pipeline_value_usd,
    success_fees_potential_usd,
    deals_closed_ytd,
    win_rate_ytd,
    success_fee_pct: successFeePct,
  };
}

export function useSyntheseBa(organizationId: string | undefined): State {
  const [bundle, setBundle] = useState<SyntheseBundle>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Lire le success_fee_pct depuis organization_presets (parametres_ba)
      const { data: preset } = await supabase
        .from('organization_presets')
        .select('templates_custom')
        .eq('organization_id', organizationId)
        .maybeSingle();
      const customCriteria = (preset?.templates_custom as any)?.investment_criteria;
      const successFeePct = typeof customCriteria?.success_fee_pct === 'number'
        ? customCriteria.success_fee_pct / 100  // si stocké en % (3 → 0.03)
        : DEFAULT_SUCCESS_FEE_PCT;

      // 2. Charger tous les mandats BA (incl. lost/close pour le YTD)
      const { data: deals, error: dErr } = await supabase
        .from('pe_deals')
        .select('id, deal_ref, enterprise_id, stage, ticket_demande, currency, lead_analyst_id, lead_im_id, score_360, source, created_at, updated_at')
        .eq('organization_id', organizationId)
        .eq('source', 'mandat_ba')
        .order('updated_at', { ascending: false });
      if (dErr) throw dErr;

      const entIds = [...new Set(((deals || []) as any[]).map(d => d.enterprise_id).filter(Boolean))] as string[];
      const userIds = [...new Set(((deals || []) as any[]).flatMap(d => [d.lead_analyst_id, d.lead_im_id]).filter(Boolean))] as string[];

      const [{ data: ents }, { data: profs }] = await Promise.all([
        entIds.length ? supabase.from('enterprises').select('id, name, sector, country').in('id', entIds) : Promise.resolve({ data: [] as any[] }),
        userIds.length ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const entMap = new Map((ents || []).map((e: any) => [e.id, e]));
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

      const mandats: Mandat[] = ((deals || []) as any[]).map(d => {
        const ent = d.enterprise_id ? entMap.get(d.enterprise_id) : null;
        return {
          id: d.id,
          deal_ref: d.deal_ref,
          enterprise_id: d.enterprise_id ?? null,
          enterprise_name: ent?.name ?? null,
          sector: ent?.sector ?? null,
          country: ent?.country ?? null,
          stage: d.stage,
          ticket_demande: d.ticket_demande ?? null,
          currency: d.currency ?? null,
          lead_analyst_id: d.lead_analyst_id ?? null,
          lead_analyst_name: d.lead_analyst_id ? profMap.get(d.lead_analyst_id) ?? null : null,
          lead_im_id: d.lead_im_id ?? null,
          lead_im_name: d.lead_im_id ? profMap.get(d.lead_im_id) ?? null : null,
          score_360: d.score_360 ?? null,
          created_at: d.created_at,
          updated_at: d.updated_at,
        };
      });

      const kpis = computeKpis(mandats);
      const business = computeBusiness(mandats, successFeePct);
      setBundle({ mandats, kpis, business });
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement synthèse');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  return { bundle, loading, error, reload: load };
}

export { computeKpis, computeBusiness };
