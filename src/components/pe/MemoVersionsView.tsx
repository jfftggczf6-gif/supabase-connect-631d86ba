// MemoVersionsView — Liste les versions du memo (live + snapshots) d'un deal.
// Permet de :
//   - Voir une version (live ou snapshot read-only)
//   - Comparer 2 versions côte à côte (typiquement : pré-DD vs post-DD)

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Camera, Eye, GitCompareArrows, ChevronRight,
  CheckCircle2, Clock, FileText,
} from 'lucide-react';
import MemoComparisonView from './MemoComparisonView';
import MemoSectionsViewer from './MemoSectionsViewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  dealId: string;
}

interface MemoVersion {
  id: string;
  label: string;
  stage: string;
  status: 'generating' | 'ready' | 'validated' | 'rejected';
  is_snapshot: boolean;
  snapshot_label: string | null;
  snapshot_taken_at: string | null;
  generated_at: string | null;
  generated_by_agent: string | null;
  overall_score: number | null;
  classification: string | null;
  created_at: string;
}

const STAGE_LABEL: Record<string, string> = {
  pre_screening:   'Pré-screening',
  note_ic1:        'IC1',
  note_ic_finale:  'IC finale',
};

export default function MemoVersionsView({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<MemoVersion[]>([]);
  const [selectedToCompare, setSelectedToCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState<{ a: string; b: string } | null>(null);
  const [viewing, setViewing] = useState<MemoVersion | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: memo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (!memo) { setLoading(false); return; }

      const { data: vers } = await supabase
        .from('memo_versions')
        .select('id, label, stage, status, is_snapshot, snapshot_label, snapshot_taken_at, generated_at, generated_by_agent, overall_score, classification, created_at')
        .eq('memo_id', memo.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      setVersions((vers ?? []) as MemoVersion[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  const toggleSelect = (id: string) => {
    setSelectedToCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const startCompare = () => {
    if (selectedToCompare.length !== 2) {
      toast.error('Sélectionne exactement 2 versions à comparer');
      return;
    }
    setComparing({ a: selectedToCompare[0], b: selectedToCompare[1] });
  };

  const liveVersion = versions.find(v => !v.is_snapshot && v.status === 'ready');
  const snapshots = versions.filter(v => v.is_snapshot);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des versions...</div>;
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p>Aucun memo généré pour le moment.</p>
          <p className="text-[11px] mt-1">Upload des pièces puis génère le pré-screening pour initialiser.</p>
        </CardContent>
      </Card>
    );
  }

  const renderRow = (v: MemoVersion, isLive: boolean) => {
    const isSelected = selectedToCompare.includes(v.id);
    return (
      <div
        key={v.id}
        className={`flex items-start gap-3 p-3 rounded-md border transition-colors cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}
        onClick={() => toggleSelect(v.id)}
      >
        <div className="shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(v.id)}
            onClick={e => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isLive ? (
              <Badge variant="outline" style={{ background: 'var(--pe-bg-ok)', color: 'var(--pe-ok)', borderColor: 'var(--pe-ok)' }}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Live
              </Badge>
            ) : (
              <Badge variant="outline" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)', borderColor: 'var(--pe-purple)' }}>
                <Camera className="h-3 w-3 mr-1" /> Snapshot
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {STAGE_LABEL[v.stage] ?? v.stage}
            </Badge>
            {v.classification && (
              <Badge variant="outline" className="text-[10px]">{v.classification.replace('_', ' ')}</Badge>
            )}
            {v.overall_score != null && (
              <Badge variant="outline" className="text-[10px]">Score {v.overall_score}</Badge>
            )}
          </div>
          <div className="text-sm font-medium">
            {v.snapshot_label ?? v.label}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
            <Clock className="h-3 w-3" />
            {v.is_snapshot && v.snapshot_taken_at
              ? `Figé le ${new Date(v.snapshot_taken_at).toLocaleDateString('fr-FR')} ${new Date(v.snapshot_taken_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              : v.generated_at
                ? `Généré le ${new Date(v.generated_at).toLocaleDateString('fr-FR')} ${new Date(v.generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : `Créé le ${new Date(v.created_at).toLocaleDateString('fr-FR')}`}
            {v.generated_by_agent && <span>· {v.generated_by_agent}</span>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1"
          onClick={e => { e.stopPropagation(); setViewing(v); }}
          title="Voir cette version"
        >
          <Eye className="h-3.5 w-3.5" /> Voir
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Versions du memo · {versions.length}</span>
            <Button
              size="sm"
              onClick={startCompare}
              disabled={selectedToCompare.length !== 2}
              className="gap-1.5"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Comparer ({selectedToCompare.length}/2)
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Sélectionne 2 versions (typiquement : pré-DD vs post-DD) pour les comparer côte à côte.
          </p>

          {liveVersion && (
            <div className="space-y-2 mb-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Version live (en cours)</div>
              {renderRow(liveVersion, true)}
            </div>
          )}

          {snapshots.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Snapshots figés</div>
              {snapshots.map(s => renderRow(s, false))}
            </div>
          )}

          {snapshots.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Aucun snapshot. Un snapshot pré-DD sera créé automatiquement quand tu appliqueras les findings DD au memo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog comparaison */}
      <Dialog open={!!comparing} onOpenChange={open => !open && setComparing(null)}>
        <DialogContent className="max-w-7xl w-[95vw] h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Comparaison de versions</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {comparing && <MemoComparisonView versionAId={comparing.a} versionBId={comparing.b} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog voir une version */}
      <Dialog open={!!viewing} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {viewing?.is_snapshot ? `Snapshot : ${viewing?.snapshot_label}` : `Version live · ${STAGE_LABEL[viewing?.stage ?? ''] ?? viewing?.stage}`}
              {viewing?.is_snapshot && (
                <Badge variant="outline" className="ml-2 text-[10px]" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)' }}>
                  Read-only
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {viewing && <MemoSectionsViewer dealId={dealId} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
