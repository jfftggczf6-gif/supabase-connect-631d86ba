// src/hooks/useInfoAnalysteBa.ts
// Charge enterprise via deal_id + permet save par section + appel IA prefill.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_INFO_ANALYSTE_BA, snapshotToInfo,
  type InfoAnalysteBa, type EnterpriseSnapshot,
} from '@/types/info-analyste-ba';

type SectionKey = keyof InfoAnalysteBa;

interface State {
  info: InfoAnalysteBa;
  snapshot: EnterpriseSnapshot | null;
  loading: boolean;
  saving: boolean;
  aiLoading: boolean;
  error: string | null;
  saveSection: <K extends SectionKey>(key: K, value: InfoAnalysteBa[K]) => Promise<boolean>;
  runAiPrefill: () => Promise<boolean>;
  reload: () => Promise<void>;
}

export function useInfoAnalysteBa(dealId: string | undefined): State {
  const [info, setInfo] = useState<InfoAnalysteBa>(DEFAULT_INFO_ANALYSTE_BA);
  const [snapshot, setSnapshot] = useState<EnterpriseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: deal, error: dErr } = await supabase
        .from('pe_deals')
        .select('enterprise_id, organization_id')
        .eq('id', dealId)
        .maybeSingle();
      if (dErr) throw dErr;
      const entId = (deal as any)?.enterprise_id;
      if (!entId) {
        setError('Deal sans enterprise rattachée');
        setSnapshot(null);
        return;
      }

      const { data: ent, error: eErr } = await supabase
        .from('enterprises')
        .select('id, organization_id, name, sector, country, legal_form, creation_date, description, document_content, document_files_count, ba_info_metadata, ba_info_ai_filled, ba_info_updated_at')
        .eq('id', entId)
        .maybeSingle();
      if (eErr) throw eErr;
      if (!ent) {
        setError('Enterprise introuvable');
        setSnapshot(null);
        return;
      }

      const snap = ent as any as EnterpriseSnapshot;
      setSnapshot(snap);
      setInfo(snapshotToInfo(snap));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const saveSection: State['saveSection'] = useCallback(async (key, value) => {
    if (!snapshot) return false;
    setSaving(true);
    setError(null);
    try {
      const nextMeta = { ...(snapshot.ba_info_metadata ?? {}), [key]: value };

      // Patch top-level colonnes pour rétro-compat avec le reste de l'app
      const topLevel: Record<string, any> = {
        ba_info_metadata: nextMeta,
        ba_info_updated_at: new Date().toISOString(),
      };
      if (key === 'identity') {
        const id = value as InfoAnalysteBa['identity'];
        if (id.legal_form) topLevel.legal_form = id.legal_form;
        if (id.date_creation_iso) topLevel.creation_date = id.date_creation_iso;
      }
      if (key === 'activity') {
        const act = value as InfoAnalysteBa['activity'];
        if (act.description) topLevel.description = act.description;
      }

      const { error: upErr } = await supabase
        .from('enterprises')
        .update(topLevel)
        .eq('id', snapshot.id);
      if (upErr) throw upErr;

      setInfo(d => ({ ...d, [key]: value }));
      setSnapshot(s => s ? { ...s, ba_info_metadata: nextMeta, ba_info_updated_at: topLevel.ba_info_updated_at } : s);
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Erreur sauvegarde');
      return false;
    } finally {
      setSaving(false);
    }
  }, [snapshot]);

  const runAiPrefill: State['runAiPrefill'] = useCallback(async () => {
    if (!snapshot) return false;
    setAiLoading(true);
    setError(null);
    try {
      const { data, error: efErr } = await supabase.functions.invoke('extract-ba-info', {
        body: { enterprise_id: snapshot.id, deal_id: dealId },
      });
      if (efErr || (data as any)?.error) {
        throw new Error((data as any)?.error || efErr?.message || 'Pré-remplissage échoué');
      }
      await load();
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Erreur IA');
      return false;
    } finally {
      setAiLoading(false);
    }
  }, [snapshot, dealId, load]);

  return { info, snapshot, loading, saving, aiLoading, error, saveSection, runAiPrefill, reload: load };
}
