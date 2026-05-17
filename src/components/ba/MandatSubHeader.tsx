// src/components/ba/MandatSubHeader.tsx
// SubHeader du MandatShell : back button + nom deal + secteur + pays + ticket + stage tag.
// Brief mandat_detail_layout critère #2.

import { ArrowLeft, Building2, MapPin, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import type { Mandat } from '@/types/ba';

interface Props {
  mandat: Mandat;
}

const STAGE_LABELS: Record<string, { label: string; cls: string }> = {
  recus:     { label: 'Reçus',       cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  im:        { label: 'IM',          cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  interets:  { label: 'Intérêts',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  nego:      { label: 'Négociation', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  close:     { label: 'Close',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  lost:      { label: 'Perdu',       cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function formatTicket(ticket: number | null, currency: string | null): string {
  if (!ticket) return '—';
  const cur = currency || 'USD';
  if (ticket >= 1_000_000) return `${(ticket / 1_000_000).toFixed(1)} M ${cur}`;
  if (ticket >= 1_000) return `${(ticket / 1_000).toFixed(0)} K ${cur}`;
  return `${ticket} ${cur}`;
}

export default function MandatSubHeader({ mandat }: Props) {
  const navigate = useNavigate();
  const stage = STAGE_LABELS[mandat.stage] || { label: mandat.stage, cls: 'bg-muted text-muted-foreground' };

  return (
    <div className="border-b bg-card">
      <div className="flex items-start gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => navigate('/ba')}
          aria-label="Retour au pipeline"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold truncate">
              {mandat.enterprise_name || mandat.deal_ref}
            </h1>
            <Badge variant="outline" className="text-[10px] font-mono">
              {mandat.deal_ref}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${stage.cls}`}>
              {stage.label}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
            {mandat.sector && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {mandat.sector}
              </span>
            )}
            {mandat.country && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {mandat.country}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Coins className="h-3 w-3" /> {formatTicket(mandat.ticket_demande, mandat.currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
