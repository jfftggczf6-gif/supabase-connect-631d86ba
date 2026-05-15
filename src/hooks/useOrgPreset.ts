// ===========================================================================
// src/hooks/useOrgPreset.ts
// Hook React qui charge la config preset de l'organisation courante depuis
// `organization_presets`. Permet aux pipelines (PE, BA) de lire leur config
// depuis la DB (pipeline_statuts, roles_labels, pipeline_views_per_role,
// livrables actifs, devise, etc.) au lieu de hardcoder dans le code.
//
// Usage :
//   const { preset, workflow, loading } = useOrgPreset();
//   if (workflow?.pipeline_statuts) {
//     // utiliser les stages custom de l'org
//   } else {
//     // fallback sur les defaults hardcodés du segment
//   }
//
// Si pas d'org courante ou pas de preset en DB → preset = null (fallback
// systématique côté consommateur).
// ===========================================================================

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface PipelineStatut {
  code: string;
  label: string;
  order: number;
}

export interface PresetWorkflow {
  pipeline_statuts?: PipelineStatut[];
  roles_labels?: Record<string, string>;
  pipeline_views_per_role?: Record<string, string[]>;
}

export interface PresetBranding {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string | null;
}

export interface OrgPreset {
  organization_id: string;
  fund_segment: string | null;
  devise: string | null;
  langue: string;
  horizon_projection: number | null;
  livrables_actifs: string[] | null;
  workflow_overrides: PresetWorkflow | null;
  templates_custom: { branding?: PresetBranding } | null;
  scoring_weights: Record<string, any> | null;
  matching_config: Record<string, any> | null;
}

export interface UseOrgPresetReturn {
  preset: OrgPreset | null;
  workflow: PresetWorkflow | null;
  branding: PresetBranding | null;
  loading: boolean;
  error: string | null;
}

export function useOrgPreset(): UseOrgPresetReturn {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? null;

  const [preset, setPreset] = useState<OrgPreset | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!orgId) {
      setPreset(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('organization_presets')
        .select('organization_id, fund_segment, devise, langue, horizon_projection, livrables_actifs, workflow_overrides, templates_custom, scoring_weights, matching_config')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchErr) {
        setError(fetchErr.message);
        setPreset(null);
      } else if (data) {
        setPreset(data as OrgPreset);
      } else {
        setPreset(null);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [orgId]);

  return useMemo(() => ({
    preset,
    workflow: (preset?.workflow_overrides as PresetWorkflow | null) ?? null,
    branding: preset?.templates_custom?.branding ?? null,
    loading,
    error,
  }), [preset, loading, error]);
}
