import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Le badge reflète l'état GLOBAL du programme :
//   - draft      → "Brouillon"           (pas démarré, pas obligatoirement de formulaire)
//   - open/closed (legacy) → "Brouillon" (anciens status, traités comme draft)
//   - in_progress → "Programme en cours"
//   - completed  → "Terminé"
// L'état du formulaire (candidatures ouvertes/fermées) est affiché en sous-badge
// séparé via le prop candidaturesOpen.
const STATUS_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  draft:        { label: 'Brouillon',          emoji: '✏️', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  open:         { label: 'Brouillon',          emoji: '✏️', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  closed:       { label: 'Brouillon',          emoji: '✏️', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  in_progress:  { label: 'Programme en cours', emoji: '🚀', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed:    { label: 'Terminé',            emoji: '✅', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

interface Props {
  status: string;
  /** Si true, affiche un sous-badge "Candidatures ouvertes" (vert) à côté. */
  candidaturesOpen?: boolean;
}

export default function ProgrammeStatusBadge({ status, candidaturesOpen }: Props) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <Badge variant="outline" className={cn('gap-1 font-medium', cfg.className)}>
        <span>{cfg.emoji}</span> {cfg.label}
      </Badge>
      {candidaturesOpen && (
        <Badge variant="outline" className="gap-1 font-medium bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
          <span>🟢</span> Candidatures ouvertes
        </Badge>
      )}
    </span>
  );
}
