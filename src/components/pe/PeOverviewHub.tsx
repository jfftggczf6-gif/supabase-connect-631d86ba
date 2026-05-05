import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, FileText, Loader2, Search, FileEdit, ShieldCheck, FileSignature, Activity, DoorOpen } from 'lucide-react';
import ScoreCircle from '@/components/dashboard/viewers/atoms/pe/ScoreCircle';
import ClassificationTag from '@/components/dashboard/viewers/atoms/pe/ClassificationTag';
import PeDealStatusBadge from '@/components/pe/PeDealStatusBadge';

interface Props {
  dealId: string;
  deal: any;
  onSelectItem: (item: string) => void;
}

interface MemoSnapshot {
  versionLabel: string | null;
  stage: string | null;
  status: string | null;
  filledCount: number;
  validatedCount: number;
  pendingValidationCount: number;
  totalCount: number;
  score: number | null;
  classification: string | null;
}

const STAGE_BADGE_LABELS: Record<string, string> = {
  pre_screening: 'Pré-screening',
  note_ic1: 'IC1',
  note_ic_finale: 'IC finale',
  dd: 'DD',
  closing: 'Closing',
  portfolio: 'Portfolio',
};

export default function PeOverviewHub({ dealId, deal, onSelectItem }: Props) {
  const [memo, setMemo] = useState<MemoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: investmentMemo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();

      if (investmentMemo) {
        // Living document : on prend la dernière version 'ready' (toute stage confondu)
        const { data: vers } = await supabase
          .from('memo_versions')
          .select('id, label, stage, status, overall_score, classification, memo_sections(content_md, content_json, status)')
          .eq('memo_id', investmentMemo.id)
          .order('created_at', { ascending: false })
          .limit(1);
        const latest = vers?.[0];

        if (latest) {
          const sections = (latest.memo_sections ?? []) as any[];
          const filled = sections.filter(
            s => s.content_md || (s.content_json && Object.keys(s.content_json).length > 0)
          ).length;
          const validated = sections.filter(s => s.status === 'validated').length;
          const pending = sections.filter(s => s.status === 'pending_validation').length;

          if (!cancelled) {
            setMemo({
              versionLabel: latest.label,
              stage: latest.stage,
              status: latest.status,
              filledCount: filled,
              validatedCount: validated,
              pendingValidationCount: pending,
              totalCount: 12,
              score: latest.overall_score,
              classification: latest.classification,
            });
          }
        }
      }

      const { count } = await supabase
        .from('pe_deal_documents')
        .select('id', { count: 'exact', head: true })
        .eq('deal_id', dealId);

      if (cancelled) return;
      setDocCount(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>;

  const enterpriseName = (deal?.enterprises as any)?.name ?? deal?.deal_ref ?? '—';
  const sector = (deal?.enterprises as any)?.sector;
  const country = (deal?.enterprises as any)?.country;

  const memoStageLabel = memo?.stage ? (STAGE_BADGE_LABELS[memo.stage] ?? memo.stage) : null;
  const filledPct = memo ? Math.round((memo.filledCount / memo.totalCount) * 100) : 0;
  const validatedPct = memo ? Math.round((memo.validatedCount / memo.totalCount) * 100) : 0;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Identité du deal */}
      <Card>
        <CardContent className="p-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Deal</span>
              {deal?.stage && <PeDealStatusBadge stage={deal.stage} />}
              {memo?.classification && <ClassificationTag classification={memo.classification} />}
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
          {memo?.score != null && <ScoreCircle score={Number(memo.score)} />}
        </CardContent>
      </Card>

      {/* Memo d'investissement — living document avec stage actuel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Memo d'investissement
            {memoStageLabel && (
              <Badge variant="outline" className="text-[10px]" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)', borderColor: 'var(--pe-purple)' }}>
                {memoStageLabel}
              </Badge>
            )}
            {memo?.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-info" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!memo ? (
            <p className="text-sm text-muted-foreground">
              Pas encore de memo. Upload des pièces puis génère le pré-screening 360° pour initialiser le dossier.
            </p>
          ) : (
            <>
              {/* Progression : sections remplies + sections validées */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Sections remplies</span>
                  <span className="font-medium">{memo.filledCount}/{memo.totalCount}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${filledPct}%`,
                      background: filledPct === 100 ? 'var(--pe-info)' : 'var(--pe-info)',
                      opacity: 0.6,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Sections validées (IM/MD)</span>
                  <span className="font-medium" style={{ color: validatedPct === 100 ? 'var(--pe-ok)' : undefined }}>
                    {memo.validatedCount}/{memo.totalCount}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${validatedPct}%`,
                      background: validatedPct === 100 ? 'var(--pe-ok)' : 'var(--pe-ok)',
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>

              {memo.pendingValidationCount > 0 && (
                <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--pe-info)' }}>
                  <span style={{ background: 'var(--pe-bg-info)' }} className="px-1.5 py-0.5 rounded font-medium">
                    {memo.pendingValidationCount} ⏳ en attente de validation
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button onClick={() => onSelectItem('memo')} size="sm" variant="outline" className="gap-1.5">
                  Ouvrir le memo <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button onClick={() => onSelectItem('pre_screening')} size="sm" variant="ghost" className="gap-1.5">
                  Vue 360° compacte
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* === Progression par phase === */}
      {(() => {
        const stage = deal?.stage ?? 'sourcing';
        // Mapping stages → 3 grandes phases (analyse / décision / portefeuille)
        const phases = [
          {
            id: 'analyse',
            label: 'Analyse',
            stages: ['sourcing', 'pre_screening', 'note_ic1'],
            color: 'bg-violet-500',
          },
          {
            id: 'decision',
            label: 'Décision',
            stages: ['dd', 'note_ic_finale', 'closing'],
            color: 'bg-blue-500',
          },
          {
            id: 'portefeuille',
            label: 'Portefeuille',
            stages: ['portfolio', 'exit_prep', 'exited'],
            color: 'bg-emerald-500',
          },
        ];
        const stageOrder = [
          'sourcing', 'pre_screening', 'note_ic1', 'dd', 'note_ic_finale',
          'closing', 'portfolio', 'exit_prep', 'exited',
        ];
        const currentIdx = stageOrder.indexOf(stage);
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Progression par phase</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {phases.map(phase => {
                const phaseStartIdx = stageOrder.indexOf(phase.stages[0]);
                const phaseEndIdx = stageOrder.indexOf(phase.stages[phase.stages.length - 1]);
                const stagesInPhase = phase.stages.length;
                let stagesDone = 0;
                if (currentIdx < phaseStartIdx) stagesDone = 0;
                else if (currentIdx >= phaseEndIdx) stagesDone = stagesInPhase;
                else stagesDone = currentIdx - phaseStartIdx + 1;
                const pct = Math.round((stagesDone / stagesInPhase) * 100);
                return (
                  <div key={phase.id} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-24 truncate">{phase.label}</span>
                    <div className="flex-1 relative">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${phase.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{stagesDone}/{stagesInPhase}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* === Prochaine étape recommandée === */}
      {(() => {
        const stage = deal?.stage ?? 'sourcing';
        const nextStepConfig: Record<string, { icon: any; label: string; phase: string; selectItem: string }> = {
          sourcing: { icon: Search, label: 'Lancer le pré-screening 360°', phase: 'Analyse', selectItem: 'pre_screening' },
          pre_screening: { icon: FileEdit, label: 'Continuer la rédaction du memo IC1', phase: 'Analyse', selectItem: 'memo' },
          note_ic1: { icon: ShieldCheck, label: 'Lancer la Due Diligence', phase: 'Décision', selectItem: 'dd' },
          dd: { icon: FileEdit, label: 'Préparer la note IC finale', phase: 'Décision', selectItem: 'memo' },
          note_ic_finale: { icon: FileSignature, label: 'Préparer le closing', phase: 'Décision', selectItem: 'closing' },
          closing: { icon: Activity, label: 'Démarrer le suivi monitoring', phase: 'Portefeuille', selectItem: 'monitoring' },
          portfolio: { icon: Activity, label: 'Saisir le rapport trimestriel', phase: 'Portefeuille', selectItem: 'monitoring' },
          exit_prep: { icon: DoorOpen, label: 'Finaliser le dossier de sortie', phase: 'Portefeuille', selectItem: 'exit_prep' },
        };
        const next = nextStepConfig[stage];
        if (!next) return null;
        const Icon = next.icon;
        return (
          <Card
            className="border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => onSelectItem(next.selectItem)}
          >
            <CardContent className="flex items-center gap-3 py-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Prochaine étape recommandée</p>
                <p className="text-sm font-semibold">{next.label}</p>
                <p className="text-[10px] text-muted-foreground">{next.phase}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary" />
            </CardContent>
          </Card>
        );
      })()}

      {/* === Quick actions : Upload + Historique === */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onSelectItem('documents')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Upload className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Upload document</div>
              <div className="text-xs text-muted-foreground">{docCount} {docCount > 1 ? 'pièces' : 'pièce'} · upload + parsing</div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onSelectItem('history')}>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
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
