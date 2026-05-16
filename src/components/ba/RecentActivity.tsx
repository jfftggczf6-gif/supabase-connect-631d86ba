// RecentActivity — Activité récente sur les mandats BA de l'org.
// V1 : lit pe_deal_history (transitions de stage) filtré sur les deals
// avec source='mandat_ba'. On enrichit avec enterprise.name + profile.full_name.

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  organizationId: string | undefined;
  limit?: number;
}

interface ActivityRow {
  id: string;
  text: string;
  when: string;
  dotColor: string;
}

const STAGE_LABEL: Record<string, string> = {
  recus: 'Reçus',
  im: 'IM vendeur',
  interets: 'Intérêts',
  nego: 'Négo',
  close: 'Closé',
  lost: 'Perdu',
};

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function colorForStage(stage: string | null): string {
  if (stage === 'close') return '#16A34A';
  if (stage === 'lost') return '#DC2626';
  if (stage === 'nego') return '#DC2626';
  if (stage === 'interets') return '#BA7517';
  return '#534AB7';
}

export default function RecentActivity({ organizationId, limit = 8 }: Props) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    (async () => {
      setLoading(true);

      const { data: deals } = await supabase
        .from('pe_deals')
        .select('id, enterprise_id')
        .eq('organization_id', organizationId)
        .eq('source', 'mandat_ba');

      const dealIds = (deals || []).map((d: any) => d.id);
      if (!dealIds.length) {
        if (active) { setRows([]); setLoading(false); }
        return;
      }
      const entIdsByDeal = new Map((deals || []).map((d: any) => [d.id, d.enterprise_id]));

      const { data: history } = await supabase
        .from('pe_deal_history')
        .select('id, deal_id, from_stage, to_stage, changed_by, created_at')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      const entIds = [...new Set(
        (history || [])
          .map((h: any) => entIdsByDeal.get(h.deal_id))
          .filter(Boolean) as string[]
      )];
      const userIds = [...new Set(
        (history || [])
          .map((h: any) => h.changed_by)
          .filter(Boolean) as string[]
      )];

      const [{ data: ents }, { data: profs }] = await Promise.all([
        entIds.length
          ? supabase.from('enterprises').select('id, name').in('id', entIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const entMap = new Map((ents || []).map((e: any) => [e.id, e.name]));
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

      const mapped: ActivityRow[] = (history || []).map((h: any) => {
        const entName = entMap.get(entIdsByDeal.get(h.deal_id) || '') || 'Mandat';
        const actor = profMap.get(h.changed_by || '') || 'Quelqu\'un';
        const toLabel = STAGE_LABEL[h.to_stage] || h.to_stage;
        const fromLabel = h.from_stage ? STAGE_LABEL[h.from_stage] || h.from_stage : null;
        const text = fromLabel
          ? `${actor} a déplacé ${entName} : ${fromLabel} → ${toLabel}`
          : `${actor} a créé ${entName} (${toLabel})`;
        return {
          id: h.id,
          text,
          when: timeAgo(h.created_at),
          dotColor: colorForStage(h.to_stage),
        };
      });

      if (active) {
        setRows(mapped);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [organizationId, limit]);

  if (loading) return null;
  if (rows.length === 0) {
    return (
      <Card className="mt-4 p-4">
        <div className="text-sm font-semibold mb-1">Activité récente</div>
        <div className="text-xs text-muted-foreground">Aucune activité pour le moment.</div>
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-4">
      <div className="text-sm font-semibold mb-2">Activité récente</div>
      <div className="divide-y divide-border">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: r.dotColor }} />
              <span className="text-foreground/90">{r.text}</span>
            </div>
            <span className="text-muted-foreground text-[11px] shrink-0 ml-3">{r.when}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
