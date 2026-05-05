// PeDealStatusBadge — aligné sur ProgrammeStatusBadge (mêmes patterns visuels)
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STAGE_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  sourcing:        { label: 'Sourcing',       emoji: '🔵', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  pre_screening:   { label: 'Pré-screening',  emoji: '🟣', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  note_ic1:        { label: 'Note IC1',       emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  dd:              { label: 'Due Diligence',  emoji: '🟠', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  note_ic_finale:  { label: 'Note IC finale', emoji: '🟢', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  closing:         { label: 'Closing',        emoji: '✍️', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  portfolio:       { label: 'Portefeuille',   emoji: '🚀', className: 'bg-violet-100 text-violet-800 border-violet-200' },
  exit_prep:       { label: 'Préparation sortie', emoji: '🚪', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  exited:          { label: 'Sortie réalisée',emoji: '✅', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  lost:            { label: 'Perdu',          emoji: '❌', className: 'bg-red-100 text-red-800 border-red-200' },
  // Legacy
  analyse:         { label: 'Analyse',        emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export default function PeDealStatusBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.sourcing;
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', cfg.className)}>
      <span>{cfg.emoji}</span> {cfg.label}
    </Badge>
  );
}
