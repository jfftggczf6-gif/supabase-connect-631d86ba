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
    supabase.from('enterprises').select('updated_at, data_changed_at').eq('id', enterpriseId).single(),
    supabase.from('deliverables').select('type, updated_at, data').eq('enterprise_id', enterpriseId),
  ]);

  if (!existing || existing.length === 0) return 'generate';

  // Use data_changed_at (pipeline-impactful changes only), fallback to updated_at
  const sourceDate = new Date(ent?.data_changed_at || ent?.updated_at || 0).getTime();

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
  const pipelineTypes = new Set(PIPELINE.map(s => s.type));
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

  // Fetch enterprise data_changed_at and existing deliverables + corrections
  const [{ data: ent }, { data: existing }, { data: corrections }] = await Promise.all([
    supabase.from('enterprises').select('updated_at, data_changed_at').eq('id', enterpriseId).single(),
    supabase.from('deliverables').select('id, type, data, score, version, updated_at').eq('enterprise_id', enterpriseId),
    supabase.from('deliverable_corrections').select('deliverable_id, field_path, corrected_value').eq('enterprise_id', enterpriseId),
  ]);

  // Use data_changed_at (pipeline-impactful changes only), fallback to updated_at
  const sourceDate = new Date(ent?.data_changed_at || ent?.updated_at || 0).getTime();

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
  const FINANCIAL_STEPS = new Set(['generate-framework', 'generate-plan-financier']);

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

    // Skip only if rich data exists AND it's more recent than source changes
    if (!force) {
      const status = delivStatus.get(step.type);
      if (status?.rich && status.upToDate) {
        results.push({ step: step.name, success: true, skipped: true });
        completedCount++;
        onProgress?.({ current: i + 1, total: PIPELINE.length, name: `${step.name} (à jour)` });
        continue;
      }
    }

    const eta = (step as any).eta ? ` (${(step as any).eta})` : '';
    onProgress?.({ current: i, total: PIPELINE.length, name: `${step.name}…${eta}` });

    // P2: Snapshot current deliverable before regeneration (protect coach corrections)
    const existingDeliv = existing?.find((d: any) => d.type === step.type);
    if (existingDeliv?.data) {
      try {
        const { error } = await supabase.from('deliverable_versions').insert({
          enterprise_id: enterpriseId,
          deliverable_id: existingDeliv.id,
          type: step.type,
          data: existingDeliv.data,
          version: existingDeliv.version || 1,
          score: existingDeliv.score || null,
          trigger_reason: force ? 'force_regeneration' : 'pipeline_update',
          generated_by: 'pipeline_snapshot',
        });

        if (error) {
          console.warn('deliverable_versions snapshot failed', {
            enterpriseId,
            deliverableId: existingDeliv.id,
            type: step.type,
            error,
          });
        }
      } catch (error) {
        console.warn('deliverable_versions snapshot crashed', {
          enterpriseId,
          deliverableId: existingDeliv.id,
          type: step.type,
          error,
        });
      }
    }

    // Collect corrections for this deliverable type to re-apply after generation
    const delivCorrections = (corrections || []).filter(
      (c: any) => existingDeliv && c.deliverable_id === existingDeliv.id
    );

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

      if (response.ok || response.status === 202) {
        let result = await response.json();
        const isAsync = response.status === 202 || result.accepted;

        if (isAsync) {
          // Async mode — wait via Realtime (instant) with polling fallback
          console.log(`[pipeline] ${step.name} accepted async (202), waiting via Realtime…`);

          const asyncResult = await new Promise<{ success: boolean; score?: number; error?: string }>((resolve) => {
            let settled = false;
            const settle = (res: { success: boolean; score?: number; error?: string }) => {
              if (settled) return;
              settled = true;
              supabase.removeChannel(channel);
              resolve(res);
            };

            // Track if memo pass 2 already triggered (avoid duplicates)
            let memoPass2Triggered = false;

            // 1. Realtime listener — instant detection on deliverables + enterprise_modules
            const channel = supabase
              .channel(`pipeline-wait-${step.type}-${Date.now()}`)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'deliverables',
                filter: `enterprise_id=eq.${enterpriseId}`,
              }, (payload) => {
                const newData = (payload.new as any)?.data;
                const newType = (payload.new as any)?.type;
                if (newType !== step.type || !newData) return;

                if (newData.status === 'error') {
                  settle({ success: false, error: newData.error || 'Erreur' });
                } else if (newData.status !== 'processing' && typeof newData === 'object' && Object.keys(newData).length >= 5) {
                  settle({ success: true, score: newData.score });
                }
              })
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'enterprise_modules',
                filter: `enterprise_id=eq.${enterpriseId}`,
              }, async (payload) => {
                // Detect memo checkpoint or completion via Realtime
                if (step.fn !== 'generate-investment-memo') return;
                const modData = (payload.new as any)?.data;
                if (!modData || typeof modData !== 'object') return;

                if (modData.phase === 'part1_completed' && !memoPass2Triggered) {
                  memoPass2Triggered = true;
                  console.log('[pipeline] Memo checkpoint detected via Realtime, triggering pass 2...');
                  onProgress?.({ current: i, total: PIPELINE.length, name: `${step.name} — passe 2…` });
                  const token2 = await getFreshToken();
                  fetch(`${supabaseUrl}/functions/v1/${step.fn}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
                    body: JSON.stringify({ enterprise_id: enterpriseId }),
                  }).catch(() => {});
                } else if (modData.phase === 'completed') {
                  settle({ success: true, score: modData.score });
                } else if (modData.phase === 'failed') {
                  settle({ success: false, error: modData.error || 'Memo failed' });
                }
              })
              .subscribe();

            // 2. Polling fallback — check every 10s in case Realtime misses it
            let pollCount = 0;
            const pollInterval = setInterval(async () => {
              pollCount++;
              onProgress?.({ current: i, total: PIPELINE.length, name: `${step.name}… (${Math.min(95, pollCount * 5)}%)` });
              try {
                // Check deliverables table
                const { data: deliv } = await supabase
                  .from('deliverables')
                  .select('data')
                  .eq('enterprise_id', enterpriseId)
                  .eq('type', step.type)
                  .single();
                if (deliv?.data) {
                  const dd = deliv.data as Record<string, any>;
                  if (dd.status === 'error') {
                    clearInterval(pollInterval);
                    settle({ success: false, error: dd.error || 'Erreur' });
                    return;
                  } else if (dd.status !== 'processing' && Object.keys(dd).length >= 5) {
                    clearInterval(pollInterval);
                    settle({ success: true, score: dd.score });
                    return;
                  }
                }

                // For investment_memo: also check enterprise_modules for checkpoint
                if (step.fn === 'generate-investment-memo') {
                  const { data: modRow } = await supabase
                    .from('enterprise_modules')
                    .select('data, status')
                    .eq('enterprise_id', enterpriseId)
                    .eq('module', 'investment_memo')
                    .single();
                  const modData = modRow?.data as Record<string, any> | null;
                  if (modData?.phase === 'part1_completed' && modData?.part1) {
                    // Checkpoint ready — trigger pass 2
                    console.log('[pipeline] Memo checkpoint detected, triggering pass 2...');
                    onProgress?.({ current: i, total: PIPELINE.length, name: `${step.name} — passe 2…` });
                    const token2 = await getFreshToken();
                    fetch(`${supabaseUrl}/functions/v1/${step.fn}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
                      body: JSON.stringify({ enterprise_id: enterpriseId }),
                    }).catch(() => {});
                    // Don't settle yet — wait for deliverable to appear
                  } else if (modData?.phase === 'completed') {
                    clearInterval(pollInterval);
                    settle({ success: true, score: modData.score });
                    return;
                  } else if (modData?.phase === 'failed') {
                    clearInterval(pollInterval);
                    settle({ success: false, error: modData.error || 'Memo failed' });
                    return;
                  }
                }
              } catch (_) { /* non-blocking */ }
            }, 10000);

            // 3. Timeout — 10 min for memo (2 passes), 6 min for others
            const timeoutMs = step.fn === 'generate-investment-memo' ? 600000 : 360000;
            setTimeout(() => {
              clearInterval(pollInterval);
              settle({ success: false, error: `Timeout (${timeoutMs / 60000} min)` });
            }, timeoutMs);

            // 4. Abort support
            if (signal) {
              signal.addEventListener('abort', () => {
                clearInterval(pollInterval);
                settle({ success: false, error: 'Interrompu' });
              }, { once: true });
            }
          });

          if (asyncResult.success) {
            results.push({ step: step.name, success: true, score: asyncResult.score });
            completedCount++;
          } else {
            results.push({ step: step.name, success: false, error: asyncResult.error });
          }

          // Detect empty inputs
          if (step.fn === 'generate-inputs') {
            const { data: chk } = await supabase.from('deliverables').select('data').eq('enterprise_id', enterpriseId).eq('type', 'inputs_data').single();
            const score = (chk?.data as any)?.score;
            if (score === 0 || !score) inputsScoreZero = true;
          }
        } else {
          // Sync mode — original logic

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

          // P2: Re-apply coach corrections on the newly generated deliverable
          if (delivCorrections.length > 0) {
            const { data: freshDeliv } = await supabase
              .from('deliverables')
              .select('id, data')
              .eq('enterprise_id', enterpriseId)
              .eq('type', step.type)
              .order('version', { ascending: false })
              .limit(1)
              .single();

            if (freshDeliv?.data && typeof freshDeliv.data === 'object') {
              const mergedData = { ...(freshDeliv.data as any) };
              for (const corr of delivCorrections) {
                const parts = corr.field_path.split('.');
                let ref = mergedData;
                for (let p = 0; p < parts.length - 1; p++) {
                  if (!ref[parts[p]] || typeof ref[parts[p]] !== 'object') ref[parts[p]] = {};
                  ref = ref[parts[p]];
                }
                ref[parts[parts.length - 1]] = corr.corrected_value;
              }
              await supabase.from('deliverables')
                .update({ data: mergedData })
                .eq('id', freshDeliv.id)
                .catch(() => {});
            }
          }

          results.push({ step: step.name, success: true, score: result.score });
          completedCount++;
          onStepComplete?.();
          // Detect empty inputs (no financial data) to skip downstream financial steps
          if (step.fn === 'generate-inputs' && (result.score === 0 || !result.score)) {
            inputsScoreZero = true;
          }
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
