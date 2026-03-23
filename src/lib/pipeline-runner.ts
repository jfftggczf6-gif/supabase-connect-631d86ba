import { supabase } from '@/integrations/supabase/client';
import { PIPELINE } from '@/lib/dashboard-config';

export interface PipelineProgress {
  current: number;
  total: number;
  name: string;
}

export interface PipelineResult {
  completedCount: number;
  executedCount: number;
  skippedCount: number;
  results: { step: string; success: boolean; score?: number; skipped?: boolean; error?: string }[];
  creditError: boolean;
}

/** Bump this when business logic changes to force regeneration of stale data */
export const CALC_VERSION = 2;

/**
 * Determines the pipeline generation state by comparing source dates with deliverable dates.
 * Returns 'generate' if modules are missing, 'update' if sources changed, 'up_to_date' if all current.
 */
export type PipelineState = 'generate' | 'update' | 'up_to_date';

export async function getPipelineState(enterpriseId: string): Promise<PipelineState> {
  const [{ data: ent }, { data: existing }] = await Promise.all([
    supabase.from('enterprises').select('updated_at').eq('id', enterpriseId).single(),
    supabase.from('deliverables').select('type, updated_at, data').eq('enterprise_id', enterpriseId),
  ]);

  if (!existing || existing.length === 0) return 'generate';

  const sourceDate = new Date(ent?.updated_at || 0).getTime();

  const toNumber = (v: any) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const isRich = (d: any): boolean => {
    if (!d.data || typeof d.data !== 'object') return false;
    if (d.type === 'inputs_data') return d.data.compte_resultat && toNumber(d.data.compte_resultat.chiffre_affaires) > 0;
    if (d.type === 'odd_analysis') {
      const hasV2 = d.data.metadata?.target_matrix_version === 'v2_template_aligned';
      return hasV2 && (d.data.evaluation_cibles_odd || d.data.synthese);
    }
    if (d.type === 'plan_ovo') {
      if (!d.data.scenarios) return false;
      // Force regeneration if calculation_version is outdated
      const ver = d.data.metadata?.calculation_version ?? 0;
      if (ver < CALC_VERSION) return false;
      return true;
    }
    return d.data.canvas || d.data.theorie_changement || d.data.compte_resultat || d.data.ratios || d.data.diagnostic_par_dimension || d.data.scenarios || d.data.checklist;
  };

  // Check all pipeline types (excluding always-run steps)
  const pipelineTypes = new Set(PIPELINE.filter(s => s.fn !== 'reconcile-plan-ovo' && s.fn !== 'generate-ovo-plan').map(s => s.type));
  const delivMap = new Map(existing.map((d: any) => [d.type, d]));

  let hasMissing = false;
  let hasStale = false;

  for (const type of pipelineTypes) {
    const d = delivMap.get(type);
    if (!d || !isRich(d)) {
      hasMissing = true;
      continue;
    }
    const delivDate = new Date(d.updated_at).getTime();
    if (delivDate < sourceDate) {
      hasStale = true;
    }
  }

  if (hasMissing) return 'generate';
  if (hasStale) return 'update';
  return 'up_to_date';
}

/**
 * Runs the generation pipeline from the client, calling each edge function
 * one by one. Uses date comparison to skip only truly up-to-date modules.
 */
export async function runPipelineFromClient(
  enterpriseId: string,
  initialToken: string,
  options: {
    force?: boolean;
    signal?: AbortSignal;
    onProgress?: (progress: PipelineProgress) => void;
    onStepComplete?: () => void;
  } = {},
): Promise<PipelineResult> {
  const { force = false, signal, onProgress, onStepComplete } = options;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  /** Always use a fresh token to avoid mid-pipeline expiry */
  const getFreshToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed?.access_token) return refreshed.access_token;
    return initialToken; // fallback
  };

  // Fetch enterprise updated_at and existing deliverables
  const [{ data: ent }, { data: existing }] = await Promise.all([
    supabase.from('enterprises').select('updated_at').eq('id', enterpriseId).single(),
    supabase.from('deliverables').select('type, data, updated_at').eq('enterprise_id', enterpriseId),
  ]);

  const sourceDate = new Date(ent?.updated_at || 0).getTime();

  const toNumber = (v: any) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : Number(v);
    return isNaN(n) ? 0 : n;
  };

  // Build a map of type -> { isRich, isUpToDate }
  const delivStatus = new Map<string, { rich: boolean; upToDate: boolean }>();
  if (!force && existing) {
    for (const d of existing as any[]) {
      let rich = false;
      if (d.data && typeof d.data === 'object') {
        if (d.type === 'inputs_data') rich = d.data.compte_resultat && toNumber(d.data.compte_resultat.chiffre_affaires) > 0;
        else if (d.type === 'odd_analysis') {
          const hasV2 = d.data.metadata?.target_matrix_version === 'v2_template_aligned';
          rich = hasV2 && (d.data.evaluation_cibles_odd || d.data.synthese);
        }
        else if (d.type === 'plan_ovo') {
          rich = !!d.data.scenarios;
          // Force regeneration if calculation_version is outdated
          const ver = d.data.metadata?.calculation_version ?? 0;
          if (ver < CALC_VERSION) rich = false;
        }
        else rich = d.data.canvas || d.data.theorie_changement || d.data.compte_resultat || d.data.ratios || d.data.diagnostic_par_dimension || d.data.scenarios || d.data.checklist;
      }
      const delivDate = new Date(d.updated_at).getTime();
      delivStatus.set(d.type, { rich: !!rich, upToDate: delivDate >= sourceDate });
    }
  }

  const results: PipelineResult['results'] = [];
  let completedCount = 0;
  let creditError = false;
  let inputsScoreZero = false;

  // Financial steps that require real inputs data
  const FINANCIAL_STEPS = new Set(['generate-framework', 'generate-plan-ovo']);

  for (let i = 0; i < PIPELINE.length; i++) {
    // Check if cancelled by user
    if (signal?.aborted) {
      results.push({ step: 'Pipeline', success: false, error: 'Interrompu par l\'utilisateur' });
      break;
    }

    const step = PIPELINE[i];

    // Skip financial steps if inputs has no real financial data
    if (inputsScoreZero && FINANCIAL_STEPS.has(step.fn)) {
      results.push({ step: step.name, success: true, skipped: true, error: 'Pas de données financières — module ignoré' });
      completedCount++;
      onProgress?.({ current: i + 1, total: PIPELINE.length, name: `${step.name} (ignoré)` });
      continue;
    }

    // Never skip reconcile-plan-ovo or generate-ovo-plan — they must always run to sync data
    const isAlwaysRun = step.fn === 'reconcile-plan-ovo' || step.fn === 'generate-ovo-plan';

    // Skip only if rich data exists AND it's more recent than source changes
    if (!force && !isAlwaysRun) {
      const status = delivStatus.get(step.type);
      if (status?.rich && status.upToDate) {
        results.push({ step: step.name, success: true, skipped: true });
        completedCount++;
        onProgress?.({ current: i + 1, total: PIPELINE.length, name: `${step.name} (à jour)` });
        continue;
      }
    }

    onProgress?.({ current: i, total: PIPELINE.length, name: `${step.name}…` });

    try {
      const controller = new AbortController();
      const veryLongSteps = new Set(['generate-investment-memo']);
      const longSteps = new Set(['generate-business-plan', 'generate-pitch-deck', 'generate-pre-screening']);
      const timeoutMs = veryLongSteps.has(step.fn) ? 360000 : longSteps.has(step.fn) ? 180000 : 120000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Abort fetch if user cancels
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });

      const currentToken = await getFreshToken();
      const response = await fetch(`${supabaseUrl}/functions/v1/${step.fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ enterprise_id: enterpriseId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);

      if (response.ok) {
        let result = await response.json();

        // Investment memo 2-pass: if pass 1 returned processing, auto-chain pass 2
        if (result.processing === true && step.fn === 'generate-investment-memo') {
          console.log('[pipeline] Investment Memo pass 1 done, chaining pass 2…');
          await new Promise(r => setTimeout(r, 1000));
          const token2 = await getFreshToken();
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 360000);
          const response2 = await fetch(`${supabaseUrl}/functions/v1/${step.fn}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
            body: JSON.stringify({ enterprise_id: enterpriseId }),
            signal: controller2.signal,
          });
          clearTimeout(timeoutId2);
          if (response2.ok) {
            result = await response2.json();
          } else {
            const err2 = await response2.json().catch(() => ({ error: 'Pass 2 failed' }));
            results.push({ step: step.name, success: false, error: err2.error });
            continue;
          }
        }

        results.push({ step: step.name, success: true, score: result.score });
        completedCount++;
        onStepComplete?.();
        // Detect empty inputs (no financial data) to skip downstream financial steps
        if (step.fn === 'generate-inputs' && (result.score === 0 || !result.score)) {
          inputsScoreZero = true;
        }
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

  const skippedCount = results.filter(r => r.skipped).length;
  const executedCount = results.filter(r => r.success && !r.skipped).length;

  return { completedCount, executedCount, skippedCount, results, creditError };
}
