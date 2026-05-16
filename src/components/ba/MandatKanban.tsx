// src/components/ba/MandatKanban.tsx
// Kanban BA — 5 colonnes lues depuis le preset (resolveStagesForRole).
// PAS de drag & drop (hors scope brief). Click sur card → detail.
// Analyste : ses mandats actifs + autres grisés (opacity 0.4).
import type { Mandat } from '@/types/ba';
import type { StageDef } from '@/lib/pe-stage-config';
import MandatCard from './MandatCard';

interface Props {
  mandats: Mandat[];
  stages: StageDef[];
  role: string | null | undefined;
  myUserId?: string | null;
  onMandatClick?: (m: Mandat) => void;
}

export default function MandatKanban({ mandats, stages, role, myUserId, onMandatClick }: Props) {
  const isAnalyst = role === 'analyst' || role === 'analyste';

  const mandatsByStage = (code: string) => mandats.filter(m => m.stage === code);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map(s => {
        const items = mandatsByStage(s.code);
        return (
          <div
            key={s.code}
            className="flex flex-col min-w-[220px] max-w-[260px] bg-muted/30 rounded-lg p-2"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-medium">{s.label}</span>
              <span className="text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
              {items.map(m => {
                const isMine = !isAnalyst || m.lead_analyst_id === myUserId;
                return (
                  <MandatCard
                    key={m.id}
                    mandat={m}
                    active={isMine}
                    onClick={isMine ? () => onMandatClick?.(m) : undefined}
                  />
                );
              })}
              {items.length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-4 italic">
                  Vide
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
