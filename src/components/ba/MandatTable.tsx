// src/components/ba/MandatTable.tsx
// Vue table des mandats avec tri par colonne.
import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Mandat } from '@/types/ba';
import { cn } from '@/lib/utils';

interface Props {
  mandats: Mandat[];
  role: string | null | undefined;
  myUserId?: string | null;
  onMandatClick?: (m: Mandat) => void;
}

type SortKey = 'name' | 'sector' | 'ticket' | 'stage' | 'analyst' | 'progress';
type SortDir = 'asc' | 'desc';

const STAGE_COLORS: Record<string, string> = {
  recus: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  im: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  interets: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  nego: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  close: 'bg-green-100 text-green-800 hover:bg-green-100',
};

function formatTicket(value: number | null, currency: string | null): string {
  if (!value) return '—';
  const cur = currency || 'XOF';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${cur}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k ${cur}`;
  return `${value} ${cur}`;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 inline ml-1 text-muted-foreground" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 inline ml-1" />
    : <ArrowDown className="h-3 w-3 inline ml-1" />;
}

export default function MandatTable({ mandats, role, myUserId, onMandatClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const isAnalyst = role === 'analyst' || role === 'analyste';

  const toggle = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    const arr = [...mandats];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'name':     av = a.enterprise_name || a.deal_ref; bv = b.enterprise_name || b.deal_ref; break;
        case 'sector':   av = a.sector ?? ''; bv = b.sector ?? ''; break;
        case 'ticket':   av = a.ticket_demande ?? 0; bv = b.ticket_demande ?? 0; break;
        case 'stage':    av = a.stage; bv = b.stage; break;
        case 'analyst':  av = a.lead_analyst_name ?? ''; bv = b.lead_analyst_name ?? ''; break;
        case 'progress': av = a.progress_pct ?? 0; bv = b.progress_pct ?? 0; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [mandats, sortKey, sortDir]);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer select-none" onClick={() => toggle('name')}>
              Mandat <SortIcon active={sortKey === 'name'} dir={sortDir} />
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggle('sector')}>
              Secteur <SortIcon active={sortKey === 'sector'} dir={sortDir} />
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggle('ticket')}>
              Ticket <SortIcon active={sortKey === 'ticket'} dir={sortDir} />
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggle('stage')}>
              Stage <SortIcon active={sortKey === 'stage'} dir={sortDir} />
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggle('analyst')}>
              Analyste <SortIcon active={sortKey === 'analyst'} dir={sortDir} />
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggle('progress')}>
              Avancement <SortIcon active={sortKey === 'progress'} dir={sortDir} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground italic py-6">
                Aucun mandat
              </TableCell>
            </TableRow>
          )}
          {sorted.map(m => {
            const isMine = !isAnalyst || m.lead_analyst_id === myUserId;
            return (
              <TableRow
                key={m.id}
                onClick={isMine ? () => onMandatClick?.(m) : undefined}
                className={cn(
                  isMine ? 'cursor-pointer hover:bg-muted/50' : 'opacity-40 pointer-events-none',
                )}
              >
                <TableCell className="font-medium">{m.enterprise_name || m.deal_ref}</TableCell>
                <TableCell className="text-sm">{m.sector || '—'}</TableCell>
                <TableCell className="text-sm">{formatTicket(m.ticket_demande, m.currency)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn('text-xs', STAGE_COLORS[m.stage])}>
                    {m.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{m.lead_analyst_name || '—'}</TableCell>
                <TableCell className="w-32">
                  <Progress value={m.progress_pct ?? 0} className="h-1.5" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
