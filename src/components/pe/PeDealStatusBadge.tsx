// PeDealStatusBadge — aligné sur ProgrammeStatusBadge (mêmes patterns visuels)
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Charte unifiée : violet clair par défaut, rouge pour Perdu, vert pour Sortie réalisée.
// Première lettre toujours en majuscule sur les labels. Pas d'emoji.
const VIOLET = 'bg-violet-100 text-violet-700 border-violet-200';
const RED = 'bg-red-100 text-red-700 border-red-200';
const EMERALD = 'bg-emerald-100 text-emerald-700 border-emerald-200';

const STAGE_CONFIG: Record<string, { label: string; className: string }> = {
  sourcing:        { label: 'Sourcing',           className: VIOLET },
  pre_screening:   { label: 'Pré-screening',      className: VIOLET },
  note_ic1:        { label: 'Note IC1',           className: VIOLET },
  dd:              { label: 'Due Diligence',      className: VIOLET },
  note_ic_finale:  { label: 'Note IC finale',     className: VIOLET },
  closing:         { label: 'Closing',            className: VIOLET },
  portfolio:       { label: 'Portefeuille',       className: VIOLET },
  exit_prep:       { label: 'Préparation sortie', className: VIOLET },
  exited:          { label: 'Sortie réalisée',    className: EMERALD },
  lost:            { label: 'Perdu',              className: RED },
  // Legacy
  analyse:         { label: 'Analyse',            className: VIOLET },
};

export default function PeDealStatusBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.sourcing;
  return (
    <Badge variant="outline" className={cn('font-medium', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
