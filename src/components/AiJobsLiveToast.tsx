// AiJobsLiveToast — Toast global bas-droit listant les générations IA en cours
// pour l'utilisateur courant. Couvre les 9 agents PE + screen-candidatures.
//
// Barre de progression basée sur le temps écoulé (vs durée estimée par agent),
// plafonnée à 95% jusqu'à completion (pattern programme module). Disparaît
// automatiquement 4s après ready/error.

import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useActiveAiJobs, type AiJob } from '@/hooks/useActiveAiJobs';
import { cn } from '@/lib/utils';

const AGENT_LABELS: Record<string, string> = {
  'test-claude': 'Test Claude',
  'analyze-pe-deal-note': 'Analyse de note analyste',
  'generate-pe-pre-screening': 'Pré-screening 360°',
  'regenerate-pe-section': 'Régénération de section',
  'generate-ic1-memo': "Memo d'investissement IC1",
  'generate-pe-valuation': 'Valuation (DCF · Multiples · ANCC)',
  'generate-dd-report': 'Due Diligence',
  'apply-dd-findings-to-memo': 'Application des findings DD',
  'generate-pe-slide-payload': "Slide d'investissement",
  'screen-candidatures': 'Screening candidatures',
};

const AGENT_ICONS: Record<string, string> = {
  'analyze-pe-deal-note': '📝',
  'generate-pe-pre-screening': '🎯',
  'regenerate-pe-section': '🔄',
  'generate-ic1-memo': '📋',
  'generate-pe-valuation': '💰',
  'generate-dd-report': '🔍',
  'apply-dd-findings-to-memo': '✏️',
  'generate-pe-slide-payload': '📊',
  'screen-candidatures': '🤖',
};

function formatSeconds(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m${r}s` : `${m}m`;
}

function computeProgress(job: AiJob, now: number) {
  if (job.status === 'ready') return 100;
  if (job.status === 'error') return 100;
  const elapsed = Math.max(0, now - job.referenceMs);
  return Math.min(95, Math.round((elapsed / job.expectedMs) * 100));
}

interface ToastProps {
  job: AiJob;
  onDismiss: () => void;
  onOpen: () => void;
}

function JobToast({ job, onDismiss, onOpen }: ToastProps) {
  const now = Date.now();
  const elapsed = job.status === 'ready' || job.status === 'error'
    ? (job.durationMs ?? now - job.referenceMs)
    : now - job.referenceMs;
  const progress = computeProgress(job, now);
  const label = AGENT_LABELS[job.agentName] ?? job.agentName;
  const icon = AGENT_ICONS[job.agentName] ?? '🤖';
  const hasError = job.status === 'error';
  const isDone = job.status === 'ready';
  const isLive = job.status === 'pending' || job.status === 'running';

  return (
    <div
      className={cn(
        'pointer-events-auto w-80 rounded-lg border bg-background shadow-lg p-4',
        hasError ? 'border-destructive/40' : isDone ? 'border-emerald-200' : 'border-primary/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-xl leading-none">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium truncate">{label}</div>
            <button
              type="button"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {isLive && <Loader2 className="h-3 w-3 animate-spin" />}
            {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
            {hasError && <AlertTriangle className="h-3 w-3 text-destructive" />}
            <span>
              {isDone && 'Terminé'}
              {hasError && 'Échec'}
              {isLive && (
                <>
                  {formatSeconds(elapsed)} / ~{formatSeconds(job.expectedMs)}
                </>
              )}
            </span>
            {isLive && job.dealId && (
              <button
                type="button"
                onClick={onOpen}
                className="ml-auto text-primary hover:underline"
              >
                Voir
              </button>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-all duration-500 ease-out',
                hasError ? 'bg-destructive' : isDone ? 'bg-emerald-500' : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {hasError && job.errorMessage && (
            <p className="mt-2 text-xs text-destructive line-clamp-2">{job.errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  userId: string | null;
}

export default function AiJobsLiveToast({ userId }: Props) {
  const navigate = useNavigate();
  const { jobs, dismiss } = useActiveAiJobs(userId);
  if (!userId || jobs.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {jobs.map((job) => (
        <JobToast
          key={job.id}
          job={job}
          onDismiss={() => dismiss(job.id)}
          onOpen={() => {
            if (job.dealId) navigate(`/pe/deals/${job.dealId}`);
          }}
        />
      ))}
    </div>
  );
}
