// useActiveAiJobs — Hook global de suivi des générations IA en cours pour
// l'utilisateur courant. S'abonne en Realtime à la table ai_jobs filtrée par
// user_id, expose la liste des jobs en cours avec progression basée sur le
// temps écoulé (vs durée estimée par agent).
//
// Couvre tous les agents PE (9) — pas seulement les memo / valuation.
// Permet de monter UN seul toast global au niveau App, visible partout.

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Durées attendues par agent (millisecondes) — ajustées à partir des runs
// historiques. Si l'agent prend plus longtemps que prévu, la barre plafonne à
// 95% jusqu'à completion (comme dans le module programme).
const EXPECTED_DURATION_MS: Record<string, number> = {
  'test-claude': 2_000,
  'analyze-pe-deal-note': 20_000,
  'generate-pe-pre-screening': 90_000,
  'regenerate-pe-section': 90_000,
  'generate-ic1-memo': 360_000,
  'generate-pe-valuation': 120_000,
  'generate-dd-report': 150_000,
  'apply-dd-findings-to-memo': 90_000,
  'generate-pe-slide-payload': 60_000,
  'screen-candidatures': 300_000,
};

const DEFAULT_EXPECTED_MS = 90_000;
const POST_FINISH_LINGER_MS = 4_000;

export interface AiJob {
  id: string;
  agentName: string;
  status: 'pending' | 'running' | 'ready' | 'error';
  dealId: string | null;
  candidatureId: string | null;
  memoId: string | null;
  programmeId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  /** Date de référence pour calculer l'elapsed (start si défini, sinon created). */
  referenceMs: number;
  expectedMs: number;
  /** True si on doit afficher ce job dans le toast (running OU vient de terminer). */
  visible: boolean;
}

interface RawJob {
  id: string;
  agent_name: string;
  status: string;
  deal_id: string | null;
  candidature_id: string | null;
  memo_id: string | null;
  programme_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

function normalizeJob(row: RawJob, now: number): AiJob {
  const reference = row.started_at ?? row.created_at;
  const referenceMs = new Date(reference).getTime();
  const expectedMs = EXPECTED_DURATION_MS[row.agent_name] ?? DEFAULT_EXPECTED_MS;
  const isLive = row.status === 'pending' || row.status === 'running';
  const finishedRecently =
    !!row.finished_at && now - new Date(row.finished_at).getTime() < POST_FINISH_LINGER_MS;
  return {
    id: row.id,
    agentName: row.agent_name,
    status: row.status as AiJob['status'],
    dealId: row.deal_id,
    candidatureId: row.candidature_id,
    memoId: row.memo_id,
    programmeId: row.programme_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    referenceMs,
    expectedMs,
    visible: isLive || finishedRecently,
  };
}

export function useActiveAiJobs(userId: string | null) {
  const [jobs, setJobs] = useState<Record<string, AiJob>>({});
  const [, forceTick] = useState(0);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const fetchActive = useCallback(async () => {
    if (!userId) return;
    const sinceIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('ai_jobs')
      .select('id, agent_name, status, deal_id, candidature_id, memo_id, programme_id, created_at, started_at, finished_at, duration_ms, error_message')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!data) return;
    const now = Date.now();
    const next: Record<string, AiJob> = {};
    for (const row of data as RawJob[]) {
      const job = normalizeJob(row, now);
      if (job.visible) next[job.id] = job;
    }
    setJobs(next);
  }, [userId]);

  // Initial fetch + Realtime subscription
  useEffect(() => {
    if (!userId) return;
    fetchActive();
    const channel = supabase
      .channel(`ai-jobs-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_jobs', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as RawJob | undefined;
          if (!row) return;
          const now = Date.now();
          const job = normalizeJob(row, now);
          setJobs((prev) => {
            if (!job.visible && !prev[row.id]) return prev;
            return { ...prev, [row.id]: job };
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchActive]);

  // Tick toutes les 500ms pour mettre à jour les barres de progression
  // (uniquement si au moins 1 job est en cours)
  useEffect(() => {
    const hasLive = Object.values(jobs).some((j) => j.status === 'pending' || j.status === 'running');
    if (!hasLive) return;
    const interval = setInterval(() => forceTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, [jobs]);

  // Auto-cleanup des jobs terminés après le linger
  useEffect(() => {
    const hasFinished = Object.values(jobs).some(
      (j) => (j.status === 'ready' || j.status === 'error') && j.visible
    );
    if (!hasFinished) return;
    const timer = setTimeout(() => {
      setJobs((prev) => {
        const now = Date.now();
        const next: Record<string, AiJob> = {};
        for (const [id, j] of Object.entries(prev)) {
          if (j.status === 'pending' || j.status === 'running') {
            next[id] = j;
          } else if (j.finishedAt && now - new Date(j.finishedAt).getTime() < POST_FINISH_LINGER_MS) {
            next[id] = j;
          }
        }
        return next;
      });
    }, POST_FINISH_LINGER_MS + 200);
    return () => clearTimeout(timer);
  }, [jobs]);

  const dismiss = useCallback((jobId: string) => {
    setJobs((prev) => {
      if (!prev[jobId]) return prev;
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }, []);

  const visibleJobs = Object.values(jobs).filter((j) => j.visible);

  return { jobs: visibleJobs, dismiss, refresh: fetchActive };
}
