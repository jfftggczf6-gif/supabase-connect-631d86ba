// src/components/ba/synthese/SyntheseKpis.tsx
// Brief synthese_partner critère #2 : 4 KPIs (actifs / structuration / diffusion / closé).

import { Card } from '@/components/ui/card';
import { Briefcase, Layers, Send, CheckCircle2 } from 'lucide-react';
import type { SyntheseKpis } from '@/types/synthese-ba';

interface Props {
  kpis: SyntheseKpis;
}

const ITEMS = [
  { key: 'actifs',        label: 'Mandats actifs',  Icon: Briefcase,    color: 'text-violet-600',  bg: 'bg-violet-100' },
  { key: 'structuration', label: 'En structuration', Icon: Layers,       color: 'text-blue-600',    bg: 'bg-blue-100' },
  { key: 'diffusion',     label: 'En diffusion',     Icon: Send,         color: 'text-amber-600',   bg: 'bg-amber-100' },
  { key: 'close_ytd',     label: 'Closés YTD',       Icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
] as const;

export default function SyntheseKpisView({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {ITEMS.map(item => {
        const value = kpis[item.key];
        const Icon = item.Icon;
        return (
          <Card key={item.key} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  {item.label}
                </div>
                <div className={`text-3xl font-bold mt-1 ${item.color}`}>{value}</div>
              </div>
              <div className={`h-9 w-9 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
