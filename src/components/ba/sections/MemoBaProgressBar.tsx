// src/components/ba/sections/MemoBaProgressBar.tsx
// progress_tracker (brief #12.7) + auto_update_suggestions (brief #12.6).
//
// Affiché au-dessus de MemoSectionsViewer dans MemoBaSection.
// - Progress : N/12 sections validées avec barre de progression colorée.
// - Suggestions : banner si docs/notes ajoutés depuis dernière génération memo.

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, CheckCircle2, FileText, NotebookPen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  dealId: string;
}

interface ProgressData {
  total: number;
  validated: number;
  submitted: number;
  draft: number;
  correction: number;
  empty: number;
  latest_memo_generated_at: string | null;
  new_docs_since: number;
  new_notes_since: number;
}

export default function MemoBaProgressBar({ dealId }: Props) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: deal } = await supabase
      .from('pe_deals')
      .select('id')
      .eq('id', dealId)
      .maybeSingle();
    if (!deal) { setLoading(false); return; }

    const { data: memo } = await supabase
      .from('investment_memos')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle();
    const memoId = (memo as any)?.id;
    if (!memoId) {
      setData({ total: 12, validated: 0, submitted: 0, draft: 0, correction: 0, empty: 12,
        latest_memo_generated_at: null, new_docs_since: 0, new_notes_since: 0 });
      setLoading(false);
      return;
    }

    const { data: version } = await supabase
      .from('memo_versions')
      .select('id, generated_at')
      .eq('memo_id', memoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const versionId = (version as any)?.id;
    const generatedAt = (version as any)?.generated_at ?? null;

    const [{ data: sections }, { count: newDocs }, { count: newNotes }] = await Promise.all([
      versionId
        ? supabase.from('memo_sections').select('status').eq('version_id', versionId)
        : Promise.resolve({ data: [] as any[] }),
      generatedAt
        ? supabase.from('pe_deal_documents')
            .select('id', { count: 'exact', head: true })
            .eq('deal_id', dealId)
            .gt('created_at', generatedAt)
        : Promise.resolve({ count: 0 }),
      generatedAt
        ? supabase.from('pe_deal_notes')
            .select('id', { count: 'exact', head: true })
            .eq('deal_id', dealId)
            .gt('created_at', generatedAt)
        : Promise.resolve({ count: 0 }),
    ]);

    const counts = { validated: 0, submitted: 0, correction: 0, draft: 0, empty: 0 };
    ((sections || []) as any[]).forEach(s => {
      const st = s.status as keyof typeof counts;
      if (counts[st] !== undefined) counts[st]++;
    });
    const totalRecorded = counts.validated + counts.submitted + counts.correction + counts.draft;
    const empty = Math.max(0, 12 - totalRecorded);

    setData({
      total: 12,
      validated: counts.validated,
      submitted: counts.submitted,
      draft: counts.draft,
      correction: counts.correction,
      empty,
      latest_memo_generated_at: generatedAt,
      new_docs_since: newDocs ?? 0,
      new_notes_since: newNotes ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [dealId]);

  if (loading || !data) return null;

  const pct = Math.round((data.validated / data.total) * 100);
  const hasNewInputs = data.new_docs_since > 0 || data.new_notes_since > 0;

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-ic1-memo', {
        body: { deal_id: dealId, tone: 'ba' },
      });
      if (error || (result as any)?.error) {
        throw new Error((result as any)?.error || error?.message || 'Régénération échouée');
      }
      toast.success('IM régénéré — sections rafraîchies');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3 mb-4">
      {/* progress_tracker */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Progression du Memo IM</h3>
            <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
              {data.validated}/{data.total} sections validées
            </Badge>
          </div>
          <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
        </div>
        {/* Stacked bar : validated | submitted | correction | draft | empty */}
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
          {data.validated > 0  && <div className="h-full bg-emerald-500"  style={{ width: `${(data.validated / data.total) * 100}%`  }} />}
          {data.submitted > 0  && <div className="h-full bg-violet-500"   style={{ width: `${(data.submitted / data.total) * 100}%`  }} />}
          {data.correction > 0 && <div className="h-full bg-amber-500"    style={{ width: `${(data.correction / data.total) * 100}%` }} />}
          {data.draft > 0      && <div className="h-full bg-blue-300"      style={{ width: `${(data.draft / data.total) * 100}%`      }} />}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <Legend color="bg-emerald-500" label={`${data.validated} validées`} />
          <Legend color="bg-violet-500"  label={`${data.submitted} soumises`} />
          <Legend color="bg-amber-500"   label={`${data.correction} en correction`} />
          <Legend color="bg-blue-300"     label={`${data.draft} brouillons`} />
          <Legend color="bg-muted"        label={`${data.empty} vides`} />
        </div>
        {data.validated === data.total && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded">
            <CheckCircle2 className="h-3.5 w-3.5" /> Toutes les sections sont validées — IM prêt pour diffusion teaser
          </div>
        )}
      </Card>

      {/* auto_update_suggestions */}
      {hasNewInputs && (
        <Card className="p-3.5 bg-amber-50/60 border-amber-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-900">Nouvelles données détectées depuis la dernière génération</span>
              </div>
              <div className="text-[11px] text-amber-800 space-y-0.5">
                {data.new_docs_since > 0 && (
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {data.new_docs_since} nouveau{data.new_docs_since > 1 ? 'x' : ''} document{data.new_docs_since > 1 ? 's' : ''} uploadé{data.new_docs_since > 1 ? 's' : ''}
                  </div>
                )}
                {data.new_notes_since > 0 && (
                  <div className="flex items-center gap-1">
                    <NotebookPen className="h-3 w-3" />
                    {data.new_notes_since} nouvelle{data.new_notes_since > 1 ? 's' : ''} note{data.new_notes_since > 1 ? 's' : ''} RDV
                  </div>
                )}
              </div>
              <p className="text-[10px] text-amber-700 mt-1">
                Les sections concernées peuvent être enrichies par régénération IA (ton vendeur BA).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 shrink-0 bg-white"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating
                ? <><RefreshCw className="h-3 w-3 animate-spin" /> Régénération…</>
                : <><RefreshCw className="h-3 w-3" /> Régénérer le Memo</>}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
