import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';

interface Deal {
  id: string;
  deal_ref: string;
  enterprise_name?: string | null;
  ticket_demande: number | null;
  currency: string | null;
  lead_analyst_initials?: string;
  score_360: number | null;
}

export default function PeDealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };

  const fmtTicket = deal.ticket_demande
    ? `${(deal.ticket_demande / 1_000_000).toFixed(1)}M ${deal.currency || ''}`
    : '—';

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={onClick}
      className="bg-white rounded-md border p-3 cursor-pointer hover:shadow-md space-y-1 select-none">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{deal.deal_ref}</span>
        {deal.score_360 != null && (
          <Badge variant="outline" className="text-[10px]">{deal.score_360}/100</Badge>
        )}
      </div>
      <p className="font-medium text-sm truncate">
        {deal.enterprise_name || <span className="italic text-muted-foreground">—</span>}
      </p>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{fmtTicket}</span>
        {deal.lead_analyst_initials && (
          <span className="bg-muted rounded-full px-1.5 py-0.5 font-mono">{deal.lead_analyst_initials}</span>
        )}
      </div>
    </div>
  );
}
