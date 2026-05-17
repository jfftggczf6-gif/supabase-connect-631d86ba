// src/components/ba/sections/DealTrackingSection.tsx
// Suivi diffusion BA — feature #16 deal_tracking_ba.
//
// Brief : timeline par fonds (teaser → NDA → IM → Management meeting → IOI →
// LOI → Close), bouton "Lever l'anonymat", bouton "Transférer au PE"
// (cross-org handoff).
//
// V1 : timeline globale depuis pe_deal_history (stages BA). Le tracking
// granulaire par fonds nécessite la table deal_fund_contacts (brief future).

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ArrowRight, EyeOff, Eye, CheckCircle2, Circle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  dealId: string;
}

const BA_STAGE_TIMELINE = [
  { code: 'recus',    label: 'Reçus' },
  { code: 'im',       label: 'IM produit' },
  { code: 'interets', label: 'Intérêts fonds' },
  { code: 'nego',     label: 'Négociation' },
  { code: 'close',    label: 'Closed' },
];

interface HistoryEntry {
  id: string;
  to_stage: string;
  created_at: string;
}

export default function DealTrackingSection({ dealId }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const [{ data: deal }, { data: hist }] = await Promise.all([
        supabase.from('pe_deals').select('stage').eq('id', dealId).maybeSingle(),
        supabase.from('pe_deal_history').select('id, to_stage, created_at').eq('deal_id', dealId).order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;
      setCurrentStage((deal as any)?.stage ?? null);
      setHistory(((hist || []) as any[]).map(h => ({
        id: h.id,
        to_stage: h.to_stage,
        created_at: h.created_at,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const reachedStages = new Set(history.map(h => h.to_stage));
  if (currentStage) reachedStages.add(currentStage);

  const stageDate = (code: string): string | null => {
    const entry = history.find(h => h.to_stage === code);
    return entry?.created_at ?? null;
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <header>
        <h2 className="text-base font-semibold">Suivi diffusion</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Timeline d'avancement du mandat et actions de diffusion vers les fonds.
        </p>
      </header>

      {/* Timeline stages */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Timeline du mandat</h3>
        <ol className="relative border-l-2 border-muted ml-3 space-y-5">
          {BA_STAGE_TIMELINE.map((s, i) => {
            const reached = reachedStages.has(s.code);
            const current = currentStage === s.code;
            const date = stageDate(s.code);
            return (
              <li key={s.code} className="ml-5">
                <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background ${
                  current ? 'bg-violet-600' : reached ? 'bg-emerald-500' : 'bg-muted'
                }`}>
                  {reached ? <CheckCircle2 className="h-2.5 w-2.5 text-white" /> : <Circle className="h-2.5 w-2.5 text-white" />}
                </span>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${current ? 'text-violet-700' : reached ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                  {current && <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">Stage actuel</Badge>}
                </div>
                {date && (
                  <p className="text-[10px] text-muted-foreground">
                    Atteint le {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Actions</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={() => toast.info('Levée d\'anonymat — workflow à intégrer avec deal_fund_contacts')}
          >
            <EyeOff className="h-4 w-4" /> Lever l'anonymat
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={() => toast.info('Handoff BA → PE — workflow à intégrer (cross-organization)')}
          >
            <ArrowRight className="h-4 w-4" /> Transférer au PE
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Le tracking granulaire par fonds (timeline individuelle, taux de conversion par fonds)
          nécessite la table <code className="bg-muted/50 px-1 py-0.5 rounded">deal_fund_contacts</code> et
          sera intégré dans une session future avec la migration fund_matching V2.
        </p>
      </Card>
    </div>
  );
}
