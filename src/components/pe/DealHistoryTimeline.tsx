import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props { dealId: string; }

interface Version {
  id: string;
  label: string;
  stage: string;
  status: string;
  overall_score: number | null;
  classification: string | null;
  generated_by_agent: string | null;
  generated_at: string | null;
  created_at: string;
  parent_version_id: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  generating: 'var(--pe-info)',
  ready:      'var(--pe-ok)',
  validated:  'var(--pe-ok)',
  rejected:   'var(--pe-danger)',
};

export default function DealHistoryTimeline({ dealId }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);

  useEffect(() => {
    (async () => {
      const { data: memo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (!memo) return;
      const { data } = await supabase
        .from('memo_versions')
        .select('*')
        .eq('memo_id', memo.id)
        .order('created_at', { ascending: false });
      setVersions((data ?? []) as Version[]);
    })();
  }, [dealId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Historique des versions ({versions.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune version générée. Drop des documents sur la carte du deal pour générer le pré-screening.
          </p>
        ) : (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex justify-between items-start border-l-2 border-border pl-3 py-1.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{v.label}</span>
                    <Badge variant="outline" style={{ borderColor: STATUS_COLOR[v.status], color: STATUS_COLOR[v.status] }}>
                      {v.status}
                    </Badge>
                    {v.overall_score != null && <span className="text-xs">Score : <strong>{v.overall_score}</strong></span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Stage : <strong>{v.stage}</strong>
                    {v.generated_by_agent && <> · {v.generated_by_agent}</>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {v.generated_at
                    ? new Date(v.generated_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
