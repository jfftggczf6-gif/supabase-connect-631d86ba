// PeGenerationToast — Toast persistant en bas à droite qui affiche la
// progression LIVE des générations IA d'un deal PE (memo, pré-screening,
// valuation). Apparaît seulement quand isGenerating === true.
//
// Disparaît automatiquement après ~3s à la fin de la génération.

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PeGenerationStatus, GenerationStep } from '@/hooks/usePeGenerationStatus';

const STEP_LABELS: Record<GenerationStep, string> = {
  pre_screening: 'Pré-screening 360°',
  memo_ic1: "Memo d'investissement IC1",
  memo_ic_finale: "Memo d'investissement IC final",
  valuation: 'Valuation (DCF · Multiples · ANCC)',
  idle: '',
};

const STEP_ICONS: Record<GenerationStep, string> = {
  pre_screening: '🎯',
  memo_ic1: '📋',
  memo_ic_finale: '📋',
  valuation: '💰',
  idle: '',
};

interface Props {
  status: PeGenerationStatus;
  /** Si fourni, permet à l'utilisateur d'aller voir le résultat en cliquant. */
  onOpen?: () => void;
}

export default function PeGenerationToast({ status, onOpen }: Props) {
  const [visible, setVisible] = useState(false);
  const [recentlyCompleted, setRecentlyCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Affiche dès qu'une génération commence ; reste visible 3s après la fin
  useEffect(() => {
    if (status.isGenerating) {
      setVisible(true);
      setRecentlyCompleted(false);
      setDismissed(false);
    } else if (visible && !recentlyCompleted) {
      // Génération vient de finir → on garde visible 3s puis disparaît
      setRecentlyCompleted(true);
      const t = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(t);
    }
  }, [status.isGenerating, visible, recentlyCompleted]);

  if (!visible || dismissed) return null;

  const hasError = !!status.errorMessage;
  const isMemo = status.currentStep === 'pre_screening' || status.currentStep === 'memo_ic1' || status.currentStep === 'memo_ic_finale';
  const isValuation = status.currentStep === 'valuation';
  const stepLabel = STEP_LABELS[status.currentStep];
  const stepIcon = STEP_ICONS[status.currentStep];

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div
        className={cn(
          'rounded-lg border-2 shadow-xl bg-white overflow-hidden',
          status.isGenerating && 'border-violet-200 shadow-violet-100',
          recentlyCompleted && !hasError && 'border-emerald-200 shadow-emerald-100',
          hasError && 'border-red-200 shadow-red-100',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-4 py-2.5 border-b',
            status.isGenerating && 'bg-violet-50 border-violet-100',
            recentlyCompleted && !hasError && 'bg-emerald-50 border-emerald-100',
            hasError && 'bg-red-50 border-red-100',
          )}
        >
          <div className="flex items-center gap-2">
            {status.isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
            ) : hasError ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            <span
              className={cn(
                'text-xs font-semibold uppercase tracking-wider',
                status.isGenerating && 'text-violet-700',
                recentlyCompleted && !hasError && 'text-emerald-700',
                hasError && 'text-red-700',
              )}
            >
              {status.isGenerating ? 'Génération en cours' : hasError ? 'Génération échouée' : 'Génération terminée'}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2.5">
          {/* Étape en cours */}
          {(stepLabel || recentlyCompleted) && (
            <div className="flex items-center gap-2">
              <span className="text-base">{stepIcon}</span>
              <p className="text-sm font-medium text-slate-900">
                {stepLabel || 'Memo / Valuation'}
              </p>
            </div>
          )}

          {/* Progress memo IC */}
          {status.isGenerating && isMemo && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Sections rédigées
                </span>
                <span className="tabular-nums font-semibold text-violet-700">
                  {status.sectionsFilled.size}/{status.sectionsTotal}
                </span>
              </div>
              <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-600 transition-all duration-500 ease-out"
                  style={{ width: `${status.progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Les 12 sections sont générées en parallèle (~30-90s).
              </p>
            </>
          )}

          {/* Progress valuation */}
          {status.isGenerating && isValuation && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="h-3 w-3 text-violet-600 animate-pulse" />
                <span className="text-muted-foreground">
                  DCF · Multiples · ANCC + synthèse pondérée
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Calcul en cours (~20-60s).
              </p>
            </>
          )}

          {/* Erreur */}
          {hasError && (
            <p className="text-xs text-red-700 bg-red-50 rounded p-2 border border-red-100">
              {status.errorMessage}
            </p>
          )}

          {/* Succès */}
          {recentlyCompleted && !hasError && (
            <>
              <p className="text-xs text-emerald-700">
                {isMemo
                  ? `${status.sectionsFilled.size} sections rédigées · prêt à consulter`
                  : 'Calcul terminé · résultats disponibles'}
              </p>
              {onOpen && (
                <button
                  onClick={onOpen}
                  className="w-full mt-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded py-1.5 transition-colors"
                >
                  Voir le résultat →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
