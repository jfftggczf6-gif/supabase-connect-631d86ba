import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, FileText, Loader2 } from 'lucide-react';
import ScoreCircle from '@/components/dashboard/viewers/atoms/pe/ScoreCircle';
import ClassificationTag from '@/components/dashboard/viewers/atoms/pe/ClassificationTag';

interface Props {
  dealId: string;
  deal: any;
  onSelectItem: (item: string) => void;
}

interface PhaseStat {
  stage: string;
  label: string;
  versionLabel: string | null;
  status: string | null;
  filledCount: number;
  totalCount: number;
  score: number | null;
  classification: string | null;
}

const PHASES = [
  { stage: 'pre_screening',  label: 'Pré-screening' },
  { stage: 'note_ic1',       label: 'Memo IC1' },
  { stage: 'note_ic_finale', label: 'Memo IC finale' },
];

export default function PeOverviewHub({ dealId, deal, onSelectItem }: Props) {
  const [stats, setStats] = useState<PhaseStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: memo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();

      const phaseStats: PhaseStat[] = PHASES.map(p => ({
        stage: p.stage,
        label: p.label,
        versionLabel: null,
        status: null,
        filledCount: 0,
        totalCount: 12,
        score: null,
        classification: null,
      }));

      if (memo) {
        const { data: vers } = await supabase
          .from('memo_versions')
          .select('id, label, stage, status, overall_score, classification, memo_sections(content_md, content_json)')
          .eq('memo_id', memo.id)
          .order('created_at', { ascending: false });

        const seen = new Set<string>();
        (vers ?? []).forEach((v: any) => {
          if (seen.has(v.stage)) return;
          seen.add(v.stage);
          const idx = phaseStats.findIndex(p => p.stage === v.stage);
          if (idx === -1) return;
          const filled = (v.memo_sections ?? []).filter(
            (s: any) => s.content_md || (s.content_json && Object.keys(s.content_json).length > 0)
          ).length;
          phaseStats[idx] = {
            ...phaseStats[idx],
            versionLabel: v.label,
            status: v.status,
            filledCount: filled,
            score: v.overall_score,
            classification: v.classification,
          };
        });
      }

      const { count } = await supabase
        .from('pe_deal_documents')
        .select('id', { count: 'exact', head: true })
        .eq('deal_id', dealId);

      if (cancelled) return;
      setStats(phaseStats);
      setDocCount(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>;

  const enterpriseName = (deal?.enterprises as any)?.name ?? deal?.deal_ref ?? '—';
  const sector = (deal?.enterprises as any)?.sector;
  const country = (deal?.enterprises as any)?.country;

  // Prochaine étape : 1ère phase non complète
  const nextPhase = stats.find(s => s.filledCount < s.totalCount);

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Identité du deal */}
      <Card>
        <CardContent className="p-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Deal · {deal?.stage}</span>
              {stats[0]?.classification && <ClassificationTag classification={stats[0].classification} />}
            </div>
            <div className="text-xl font-semibold">{enterpriseName}</div>
            <div className="text-sm text-muted-foreground">
              {sector ?? '—'} · {country ?? '—'} · Deal ref. {deal?.deal_ref}
            </div>
            {deal?.ticket_demande && (
              <div className="text-sm mt-2">
                Ticket demandé : <strong>{(deal.ticket_demande / 1_000_000).toFixed(1)}M {deal.currency || 'EUR'}</strong>
              </div>
            )}
          </div>
          {stats[0]?.score != null && <ScoreCircle score={Number(stats[0].score)} />}
        </CardContent>
      </Card>

      {/* Progression par phase */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Progression du dossier</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stats.map(s => {
            const pct = Math.round((s.filledCount / s.totalCount) * 100);
            const completed = s.filledCount === s.totalCount;
            return (
              <button
                key={s.stage}
                onClick={() => onSelectItem(s.stage)}
                className="w-full text-left p-3 rounded-md border hover:bg-muted/50 transition-colors group"
                disabled={!s.versionLabel && s.stage !== 'pre_screening'}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.label}</span>
                    {s.versionLabel && <Badge variant="outline" className="text-[10px]">{s.versionLabel}</Badge>}
                    {s.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-info" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{s.filledCount}/{s.totalCount} sections</span>
                    {s.score != null && <span style={{ color: 'var(--pe-ok)', fontWeight: 500 }}>· score {s.score}</span>}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: completed ? 'var(--pe-ok)' : pct > 0 ? 'var(--pe-info)' : 'transparent',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Prochaine action */}
      {nextPhase && (
        <Card style={{ borderColor: 'var(--pe-info)', borderWidth: 1 }}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Prochaine étape</div>
              <div className="font-medium text-sm">
                Compléter <strong>{nextPhase.label}</strong>
                {' '}· {nextPhase.totalCount - nextPhase.filledCount} section{nextPhase.totalCount - nextPhase.filledCount > 1 ? 's' : ''} restante{nextPhase.totalCount - nextPhase.filledCount > 1 ? 's' : ''}
              </div>
            </div>
            <Button onClick={() => onSelectItem(nextPhase.stage)} size="sm" className="gap-1.5">
              Ouvrir <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onSelectItem('documents')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Upload document</div>
              <div className="text-xs text-muted-foreground">{docCount} {docCount > 1 ? 'pièces' : 'pièce'} · upload + parsing</div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onSelectItem('history')}>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Historique</div>
              <div className="text-xs text-muted-foreground">Versions et modifications</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
