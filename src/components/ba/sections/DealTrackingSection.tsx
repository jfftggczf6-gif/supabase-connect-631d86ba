// src/components/ba/sections/DealTrackingSection.tsx
// Suivi diffusion BA — feature deal_tracking (ordre 16).
//
// Vue MANDAT (transversale, agrège l'activité tous fonds confondus) :
//   - Timeline du mandat (BA stages : recus → im → interets → nego → close)
//   - KPIs résumés (fonds contactés / IOI / délai moyen)
//   - Activité récente (dernières interactions par fonds — depuis pe_fund_outreach)
//   - Actions de diffusion (Levée d'anonymat, Handoff BA → PE)
//
// Complémentaire à FundMatchingSection (qui est la vue FONDS).

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ArrowRight, EyeOff, CheckCircle2, Circle, Clock,
  Activity, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { STAGE_ORDER, type OutreachStatus } from '@/types/fund-matching';

interface Props {
  dealId: string;
}

const BA_STAGE_TIMELINE = [
  { code: 'recus',    label: 'Reçus',           caption: 'Mandat signé, dossier ouvert' },
  { code: 'im',       label: 'IM produit',      caption: 'Memo d\'investissement validé' },
  { code: 'interets', label: 'Intérêts fonds',  caption: 'Teaser envoyé, réponses positives' },
  { code: 'nego',     label: 'Négociation',     caption: 'IOI / LOI / DD en cours' },
  { code: 'close',    label: 'Closed',          caption: 'Deal finalisé ou hand-off PE' },
];

interface HistoryEntry {
  id: string;
  to_stage: string;
  created_at: string;
  reason: string | null;
}

interface OutreachActivity {
  fund_name: string;
  status: OutreachStatus;
  last_action_label: string | null;
  last_action_at: string | null;
}

function statusBadgeClass(s: OutreachStatus): string {
  if (s === 'declined') return 'bg-muted text-muted-foreground';
  if (s === 'ioi_received' || s === 'loi_signed') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'meeting_held' || s === 'im_shared' || s === 'nda_signed')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'interested') return 'bg-violet-100 text-violet-700 border-violet-200';
  if (s === 'nda_pending' || s === 'teaser_sent') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-muted text-muted-foreground';
}
function statusLabel(s: OutreachStatus): string {
  const map: Record<OutreachStatus, string> = {
    matched: 'Matché', teaser_sent: 'Teaser envoyé', interested: 'Intéressé',
    nda_pending: 'NDA en cours', nda_signed: 'NDA signée', im_shared: 'IM partagé',
    meeting_held: 'Mgmt meeting', ioi_received: 'IOI reçue', loi_signed: 'LOI signée',
    closed: 'Closé', declined: 'Décliné',
  };
  return map[s];
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function DealTrackingSection({ dealId }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [activity, setActivity] = useState<OutreachActivity[]>([]);
  const [kpis, setKpis] = useState({ funds: 0, ioi: 0, avgResponseDays: 0, canHandoff: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const [{ data: deal }, { data: hist }, { data: outreachRaw }] = await Promise.all([
        supabase.from('pe_deals').select('stage').eq('id', dealId).maybeSingle(),
        supabase.from('pe_deal_history').select('id, to_stage, created_at, reason').eq('deal_id', dealId).order('created_at', { ascending: true }),
        supabase.from('pe_fund_outreach').select('status, last_action_label, last_action_at, funding_program_id').eq('deal_id', dealId),
      ]);

      // Hydrate fund names
      const fundIds = ((outreachRaw || []) as any[]).map(o => o.funding_program_id);
      let fundNames = new Map<string, string>();
      if (fundIds.length > 0) {
        const { data: programs } = await supabase
          .from('funding_programs')
          .select('id, name')
          .in('id', fundIds);
        fundNames = new Map(((programs || []) as any[]).map(p => [p.id, p.name]));
      }

      if (cancelled) return;
      setCurrentStage((deal as any)?.stage ?? null);
      setHistory(((hist || []) as any[]).map(h => ({
        id: h.id, to_stage: h.to_stage, created_at: h.created_at, reason: h.reason ?? null,
      })));

      const out = ((outreachRaw || []) as any[])
        .map(o => ({
          fund_name: fundNames.get(o.funding_program_id) ?? 'Fonds',
          status: o.status as OutreachStatus,
          last_action_label: o.last_action_label ?? null,
          last_action_at: o.last_action_at ?? null,
        }))
        .sort((a, b) => {
          const ta = a.last_action_at ? new Date(a.last_action_at).getTime() : 0;
          const tb = b.last_action_at ? new Date(b.last_action_at).getTime() : 0;
          return tb - ta;
        });
      setActivity(out);

      const ioi = out.filter(o => STAGE_ORDER[o.status] >= 6 && o.status !== 'declined').length;
      const responded = out.filter(o => o.status !== 'matched' && o.status !== 'declined');
      const delays = responded
        .map(o => daysSince(o.last_action_at))
        .filter((d): d is number => d !== null);
      const avgResponseDays = delays.length > 0
        ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
        : 0;
      const canHandoff = out.some(o => o.status === 'loi_signed' || o.status === 'closed');
      setKpis({ funds: out.length, ioi, avgResponseDays, canHandoff });

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
    <div className="space-y-4 max-w-6xl mx-auto">
      <header>
        <h2 className="text-base font-semibold">Suivi diffusion — vue mandat</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Timeline d'avancement du mandat + activité tous fonds confondus.
          Pour le détail par contact, voir <strong>Investisseurs cibles</strong>.
        </p>
      </header>

      {/* KPI summary */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Fonds en outreach</div>
          <div className="text-xl font-semibold mt-1">{kpis.funds}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-blue-600" /> IOI reçues</div>
          <div className="text-xl font-semibold mt-1 text-blue-700">{kpis.ioi}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Délai moyen action</div>
          <div className="text-xl font-semibold mt-1">{kpis.avgResponseDays}j</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-600" /> Handoff prêt</div>
          <div className={`text-xl font-semibold mt-1 ${kpis.canHandoff ? 'text-emerald-700' : 'text-muted-foreground'}`}>
            {kpis.canHandoff ? 'Oui' : 'Non'}
          </div>
        </Card>
      </div>

      {/* Timeline stages */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Timeline du mandat</h3>
        <ol className="relative border-l-2 border-muted ml-3 space-y-5">
          {BA_STAGE_TIMELINE.map(s => {
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
                <p className="text-[11px] text-muted-foreground">{s.caption}</p>
                {date && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Atteint le {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Activité récente */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Activité récente — tous fonds</h3>
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Aucun outreach démarré. Va sur <strong>Investisseurs cibles</strong> pour envoyer un teaser.
          </p>
        ) : (
          <div className="space-y-1.5">
            {activity.slice(0, 10).map((a, i) => {
              const d = daysSince(a.last_action_at);
              return (
                <div key={i} className="flex items-center justify-between border-b last:border-b-0 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(a.status)} shrink-0`}>
                      {statusLabel(a.status)}
                    </Badge>
                    <span className="text-xs font-medium truncate">{a.fund_name}</span>
                    {a.last_action_label && (
                      <span className="text-[11px] text-muted-foreground truncate">— {a.last_action_label}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {d !== null ? (d === 0 ? "aujourd'hui" : `il y a ${d}j`) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Actions de diffusion</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={!kpis.canHandoff}
            onClick={() => {
              if (!kpis.canHandoff) return;
              // Navigue vers fund_matching où l'action handoff complète est implémentée
              setSearchParams(prev => { prev.set('section', 'fund_matching'); return prev; });
              toast.info('Levée d\'anonymat : ouvre Investisseurs cibles → contacts en LOI');
            }}
          >
            <EyeOff className="h-4 w-4" /> Lever l'anonymat
          </Button>
          <Button
            className="justify-start gap-2"
            disabled={!kpis.canHandoff}
            onClick={() => {
              if (!kpis.canHandoff) return;
              // Le bouton 'Handoff PE' dans fund_matching ouvre confirm + invoke create-pe-deal-from-ba
              setSearchParams(prev => { prev.set('section', 'fund_matching'); return prev; });
              toast.info('Clique sur le menu "⋯" en haut de Investisseurs cibles puis "Handoff PE"');
            }}
          >
            <ArrowRight className="h-4 w-4" /> Transférer au PE
          </Button>
        </div>
      </Card>
    </div>
  );
}
