// src/components/ba/MandatCard.tsx
// Carte mandat dans le kanban BA.
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import type { Mandat } from '@/types/ba';
import { cn } from '@/lib/utils';

interface Props {
  mandat: Mandat;
  /** Si false, la carte est grisée (analyste qui ne voit pas le mandat). */
  active?: boolean;
  onClick?: () => void;
}

function formatTicket(value: number | null, currency: string | null): string {
  if (!value) return '—';
  const cur = currency || 'XOF';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${cur}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k ${cur}`;
  return `${value} ${cur}`;
}

export default function MandatCard({ mandat, active = true, onClick }: Props) {
  const reviewCount = mandat.sections_in_review ?? 0;
  return (
    <Card
      className={cn(
        'p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2',
        !active && 'opacity-40 pointer-events-none',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">
            {mandat.enterprise_name || mandat.deal_ref}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            {mandat.sector && <span className="truncate">{mandat.sector}</span>}
            {mandat.sector && mandat.country && <span>·</span>}
            {mandat.country && <span className="truncate">{mandat.country}</span>}
          </div>
        </div>
        {reviewCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
            {reviewCount} review
          </Badge>
        )}
      </div>

      <div className="text-xs font-medium">
        {formatTicket(mandat.ticket_demande, mandat.currency)}
      </div>

      {typeof mandat.progress_pct === 'number' && (
        <Progress value={mandat.progress_pct} className="h-1" />
      )}

      <div className="flex items-center justify-between">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px]">
            {mandat.lead_analyst_initials || '??'}
          </AvatarFallback>
        </Avatar>
        {mandat.score_360 != null && (
          <span className="text-[10px] text-muted-foreground">
            Score {mandat.score_360}
          </span>
        )}
      </div>
    </Card>
  );
}
