import { supabase } from '@/integrations/supabase/client';
import { PIPELINE } from '@/lib/dashboard-config';

export interface PipelineProgress {
  current: number;
  total: number;
  name: string;
}

export interface PipelineResult {
  completedCount: number;
  results: { step: string; success: boolean; score?: number; skipped?: boolean; error?: string }[];
  creditError: boolean;
}

/**
 * Runs the generation pipeline from the client, calling each edge function
 * one by one. This avoids the server-side orchestrator timeout.
 */
export async function runPipelineFromClient(
  enterpriseId: string,
  initialToken: string,
  options: {
    force?: boolean;
    onProgress?: (progress: PipelineProgress) => void;
    onStepComplete?: () => void;
  } = {},
): Promise<PipelineResult> {
  const { force = false, onProgress, onStepComplete } = options;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  /** Always use a fresh token to avoid mid-pipeline expiry */
  const getFreshToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed?.access_token) return refreshed.access_token;
    return initialToken; // fallback
  };

  // Fetch existing deliverables to know what to skip
  let richTypes = new Set<string>();
  if (!force) {
    const { data: existing } = await supabase
      .from('deliverables')
      .select('type, data')
      .eq('enterprise_id', enterpriseId);

    const toNumber = (v: any) => {
      const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : Number(v);
      return isNaN(n) ? 0 : n;
    };

    richTypes = new Set(
      (existing || [])
        .filter((d: any) => {
          if (!d.data || typeof d.data !== 'object') return false;
          if (d.type === 'inputs_data') return d.data.compte_resultat && toNumber(d.data.compte_resultat.chiffre_affaires) > 0;
          if (d.type === 'odd_analysis') return d.data.evaluation_cibles_odd || d.data.synthese;
          if (d.type === 'plan_ovo') return !!d.data.scenarios;
          return d.data.canvas || d.data.theorie_changement || d.data.compte_resultat || d.data.ratios || d.data.diagnostic_par_dimension || d.data.scenarios || d.data.checklist;
        })
        .map((d: any) => d.type),
    );
  }

  const results: PipelineResult['results'] = [];
  let completedCount = 0;
  let creditError = false;

  for (let i = 0; i < PIPELINE.length; i++) {
    const step = PIPELINE[i];

    // Skip if rich data exists
    if (!force && richTypes.has(step.type)) {
      results.push({ step: step.name, success: true, skipped: true });
      completedCount++;
      onProgress?.({ current: i + 1, total: PIPELINE.length, name: `${step.name} (existant)` });
      continue;
    }

    onProgress?.({ current: i, total: PIPELINE.length, name: `${step.name}…` });

    try {
      const controller = new AbortController();
      const timeoutMs = step.fn === 'generate-business-plan' ? 180000 : 120000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const currentToken = await getFreshToken();
      const response = await fetch(`${supabaseUrl}/functions/v1/${step.fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ enterprise_id: enterpriseId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        results.push({ step: step.name, success: true, score: result.score });
        completedCount++;
        onStepComplete?.();
      } else {
        const err = await response.json().catch(() => ({ error: 'Unknown' }));

        if (response.status === 402 || err.error?.includes('Crédits') || err.error?.includes('insuffisants')) {
          creditError = true;
          results.push({ step: step.name, success: false, error: err.error });
          break;
        }
        if (response.status === 429) {
          results.push({ step: step.name, success: false, error: 'Limite de requêtes atteinte, réessayez plus tard.' });
          break;
        }

        results.push({ step: step.name, success: false, error: err.error });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        results.push({ step: step.name, success: false, error: 'Timeout — réessayez ce module individuellement.' });
      } else {
        results.push({ step: step.name, success: false, error: e.message || 'Unknown' });
      }
    }

    // Small delay between calls
    if (i < PIPELINE.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  onProgress?.({ current: PIPELINE.length, total: PIPELINE.length, name: 'Terminé' });

  return { completedCount, results, creditError };
}
