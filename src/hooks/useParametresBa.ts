// src/hooks/useParametresBa.ts
// Load + save de la config parametres_ba pour l'org courante.
// Stockage : organization_presets.templates_custom jsonb (+ devise + langue
// au top-level pour cohérence avec useOrgPreset existant).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_PARAMETRES_BA,
  type ParametresBa, type FundIdentity, type DeviseFormats,
  type InvestmentCriteria, type InvestmentThesis,
} from '@/types/parametres-ba';

type SectionKey = keyof ParametresBa;

interface State {
  data: ParametresBa;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Sauvegarde 1 section seule (brief #7 : 'Sauvegarder par section'). */
  saveSection: <K extends SectionKey>(key: K, value: ParametresBa[K]) => Promise<boolean>;
  reload: () => Promise<void>;
}

/** Reconstruit ParametresBa depuis row organization_presets DB. */
function presetRowToParametres(row: any | null): ParametresBa {
  if (!row) return DEFAULT_PARAMETRES_BA;
  const custom = (row.templates_custom ?? {}) as any;
  return {
    fund_identity: { ...DEFAULT_PARAMETRES_BA.fund_identity, ...(custom.fund_identity ?? {}) },
    devise_formats: {
      devise: row.devise ?? DEFAULT_PARAMETRES_BA.devise_formats.devise,
      langue: row.langue ?? DEFAULT_PARAMETRES_BA.devise_formats.langue,
      date_format: custom.devise_formats?.date_format ?? DEFAULT_PARAMETRES_BA.devise_formats.date_format,
      number_format: custom.devise_formats?.number_format ?? DEFAULT_PARAMETRES_BA.devise_formats.number_format,
    },
    investment_criteria: { ...DEFAULT_PARAMETRES_BA.investment_criteria, ...(custom.investment_criteria ?? {}) },
    investment_thesis: { ...DEFAULT_PARAMETRES_BA.investment_thesis, ...(custom.investment_thesis ?? {}) },
  };
}

export function useParametresBa(organizationId: string | undefined): State {
  const [data, setData] = useState<ParametresBa>(DEFAULT_PARAMETRES_BA);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: row, error: qErr } = await supabase
        .from('organization_presets')
        .select('organization_id, devise, langue, templates_custom')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (qErr) throw qErr;
      setData(presetRowToParametres(row));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement paramètres');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const saveSection: State['saveSection'] = useCallback(async (key, value) => {
    if (!organizationId) return false;
    setSaving(true);
    setError(null);
    try {
      // Récupère le row existant pour merger templates_custom proprement.
      const { data: existing, error: gErr } = await supabase
        .from('organization_presets')
        .select('templates_custom')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (gErr) throw gErr;

      const currentCustom = (existing?.templates_custom ?? {}) as any;
      const nextCustom = { ...currentCustom };

      // SECTION devise_formats : split — devise/langue go top-level, le reste dans custom
      let topLevelUpdates: Record<string, any> = {};
      if (key === 'devise_formats') {
        const v = value as DeviseFormats;
        topLevelUpdates = { devise: v.devise, langue: v.langue };
        nextCustom.devise_formats = { date_format: v.date_format, number_format: v.number_format };
      } else {
        nextCustom[key] = value;
      }

      const { error: upErr } = await supabase
        .from('organization_presets')
        .upsert({
          organization_id: organizationId,
          templates_custom: nextCustom,
          ...topLevelUpdates,
        }, { onConflict: 'organization_id' });
      if (upErr) throw upErr;

      // Mise à jour optimiste du state
      setData(d => ({ ...d, [key]: value }));
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Erreur sauvegarde');
      return false;
    } finally {
      setSaving(false);
    }
  }, [organizationId]);

  return { data, loading, saving, error, saveSection, reload: load };
}

export { presetRowToParametres };
