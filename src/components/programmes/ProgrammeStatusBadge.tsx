import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  draft: { label: 'Brouillon', emoji: '🔵', className: 'bg-violet-100 text-violet-600 border-violet-200' },
  open: { label: 'Ouvert', emoji: '🟢', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  closed: { label: 'Clôturé', emoji: '🔴', className: 'bg-red-100 text-red-800 border-red-200' },
  in_progress: { label: 'En cours', emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  completed: { label: 'Terminé', emoji: '✅', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export default function ProgrammeStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', cfg.className)}>
      <span>{cfg.emoji}</span> {cfg.label}
    </Badge>
  );
}
