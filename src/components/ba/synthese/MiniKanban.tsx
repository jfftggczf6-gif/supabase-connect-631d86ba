// src/components/ba/synthese/MiniKanban.tsx
// Brief synthese_partner critère #3 : "Mini Kanban pipeline (même composant que
// pipeline_mandats mais compact)". Version condensée qui affiche les 5 stages BA
// avec leur count + les 3 derniers deals par stage. Lien "Voir le pipeline complet".

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Mandat } from '@/types/ba';

interface Props {
  mandats: Mandat[];
}

const STAGES: { code: string; label: string; cls: string }[] = [
  { code: 'recus',    label: 'Reçus',    cls: 'bg-violet-50 border-violet-200' },
  { code: 'im',       label: 'IM',       cls: 'bg-blue-50 border-blue-200' },
  { code: 'interets', label: 'Intérêts', cls: 'bg-amber-50 border-amber-200' },
  { code: 'nego',     label: 'Négo',     cls: 'bg-orange-50 border-orange-200' },
  { code: 'close',    label: 'Close',    cls: 'bg-emerald-50 border-emerald-200' },
];

function MandatChip({ mandat, onClick }: { mandat: Mandat; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-1.5 rounded border bg-background hover:bg-muted/30 transition-colors"
    >
      <div className="text-[11px] font-semibold truncate">
        {mandat.enterprise_name || mandat.deal_ref}
      </div>
      {mandat.ticket_demande && (
        <div className="text-[9px] text-muted-foreground mt-0.5">
          {mandat.ticket_demande >= 1_000_000
            ? `${(mandat.ticket_demande / 1_000_000).toFixed(1)} M ${mandat.currency || 'USD'}`
            : `${mandat.ticket_demande} ${mandat.currency || 'USD'}`}
        </div>
      )}
    </button>
  );
}

export default function MiniKanban({ mandats }: Props) {
  const navigate = useNavigate();
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline (aperçu)
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/ba/pipeline')}
        >
          Pipeline complet <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {STAGES.map(stage => {
          const deals = mandats.filter(m => m.stage === stage.code).slice(0, 3);
          const totalCount = mandats.filter(m => m.stage === stage.code).length;
          return (
            <Card key={stage.code} className={`p-2 ${stage.cls} border`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide">{stage.label}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-white/80">
                  {totalCount}
                </Badge>
              </div>
              <div className="space-y-1">
                {deals.length === 0 ? (
                  <div className="text-[9px] text-muted-foreground italic py-2 text-center">
                    Aucun
                  </div>
                ) : (
                  deals.map(d => (
                    <MandatChip key={d.id} mandat={d} onClick={() => navigate(`/ba/deals/${d.id}`)} />
                  ))
                )}
              </div>
              {totalCount > 3 && (
                <div className="text-[9px] text-muted-foreground mt-1 text-center">
                  +{totalCount - 3} autres
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
