// SeniorConsoView — Vue consolidée S3 (Senior).
// 3 cards :
//   1. Charge par analyste (mandats actifs par analyste)
//   2. Sections en attente de review (memo_sections status='submitted')
//   3. Alertes (sections >3j en review, mandats inactifs >7j)

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Mandat } from '@/types/ba';

interface Props {
  mandats: Mandat[];
}

interface PendingSection {
  deal_id: string;
  enterprise_name: string;
  section_codes: string[];
  ageDays: number;
}

const SECTION_LABEL: Record<string, string> = {
  executive_summary: '§1',
  shareholding_governance: '§2',
  top_management: '§3',
  services: '§4',
  competition_market: '§5',
  unit_economics: '§6',
  financials_pnl: '§7',
  financials_balance: '§8',
  investment_thesis: '§9',
  support_requested: '§10',
  esg_risks: '§11',
  annexes: '§12',
};

export default function SeniorConsoView({ mandats }: Props) {
  const [pending, setPending] = useState<PendingSection[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Charge par analyste (depuis mandats prop)
  const chargeParAnalyste = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const m of mandats) {
      if (m.stage === 'close' || m.stage === 'lost') continue;
      if (!m.lead_analyst_id) continue;
      const cur = map.get(m.lead_analyst_id);
      if (cur) cur.count += 1;
      else map.set(m.lead_analyst_id, { name: m.lead_analyst_name || 'Analyste', count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [mandats]);

  // 3. Mandats inactifs >7j
  const inactiveMandats = useMemo(() => {
    const now = Date.now();
    return mandats.filter(m => {
      if (m.stage === 'close' || m.stage === 'lost') return false;
      if (!m.updated_at) return false;
      const days = (now - new Date(m.updated_at).getTime()) / 86_400_000;
      return days > 7;
    });
  }, [mandats]);

  // 2. Sections en attente (query memo_sections submitted sur memos des mandats)
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const dealIds = mandats.map(m => m.id);
      if (!dealIds.length) {
        if (active) { setPending([]); setLoading(false); }
        return;
      }
      const { data: memos } = await supabase
        .from('investment_memos')
        .select('id, deal_id')
        .in('deal_id', dealIds);
      const memoIds = (memos || []).map((m: any) => m.id);
      if (!memoIds.length) {
        if (active) { setPending([]); setLoading(false); }
        return;
      }
      const { data: versions } = await supabase
        .from('memo_versions')
        .select('id, memo_id')
        .in('memo_id', memoIds);
      const versionIds = (versions || []).map((v: any) => v.id);
      const versionToMemo = new Map((versions || []).map((v: any) => [v.id, v.memo_id]));
      const memoToDeal = new Map((memos || []).map((m: any) => [m.id, m.deal_id]));
      if (!versionIds.length) {
        if (active) { setPending([]); setLoading(false); }
        return;
      }
      const { data: sections } = await supabase
        .from('memo_sections')
        .select('id, version_id, section_code, updated_at')
        .in('version_id', versionIds)
        .eq('status', 'submitted');

      const byDeal = new Map<string, { codes: string[]; minUpdated: number }>();
      for (const s of sections || []) {
        const memoId = versionToMemo.get((s as any).version_id);
        const dealId = memoId ? memoToDeal.get(memoId) : null;
        if (!dealId) continue;
        const code = SECTION_LABEL[(s as any).section_code] || (s as any).section_code;
        const upd = new Date((s as any).updated_at).getTime();
        const cur = byDeal.get(dealId);
        if (cur) {
          cur.codes.push(code);
          if (upd < cur.minUpdated) cur.minUpdated = upd;
        } else {
          byDeal.set(dealId, { codes: [code], minUpdated: upd });
        }
      }
      const dealMap = new Map(mandats.map(m => [m.id, m]));
      const now = Date.now();
      const result: PendingSection[] = [];
      for (const [dealId, info] of byDeal.entries()) {
        const m = dealMap.get(dealId);
        if (!m) continue;
        result.push({
          deal_id: dealId,
          enterprise_name: m.enterprise_name || m.deal_ref,
          section_codes: info.codes,
          ageDays: Math.floor((now - info.minUpdated) / 86_400_000),
        });
      }
      result.sort((a, b) => b.ageDays - a.ageDays);
      if (active) { setPending(result); setLoading(false); }
    })();
    return () => { active = false; };
  }, [mandats]);

  const overdueSections = pending.filter(p => p.ageDays >= 3);
  const hasAlerts = overdueSections.length > 0 || inactiveMandats.length > 0;

  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Charge par analyste</div>
        {chargeParAnalyste.length === 0 ? (
          <div className="text-xs text-muted-foreground">Aucun mandat actif assigné.</div>
        ) : (
          <div className="space-y-1.5">
            {chargeParAnalyste.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{a.count} mandat{a.count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Sections en attente de review</div>
        {loading ? (
          <div className="text-xs text-muted-foreground">Chargement…</div>
        ) : pending.length === 0 ? (
          <div className="text-xs text-muted-foreground">Aucune section soumise.</div>
        ) : (
          <div className="space-y-1.5">
            {pending.slice(0, 6).map(p => (
              <div key={p.deal_id} className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium truncate flex-1">{p.enterprise_name}</span>
                <span className="text-muted-foreground truncate flex-1">{p.section_codes.join(', ')}</span>
                <Badge variant={p.ageDays >= 3 ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                  {p.ageDays === 0 ? "auj." : `${p.ageDays}j`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {hasAlerts && (
        <Card className="p-4 md:col-span-2 border-orange-200 bg-orange-50/40">
          <div className="text-xs font-semibold text-orange-700 mb-1.5">⚠ Alertes</div>
          <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
            {overdueSections.map(s => (
              <li key={`s-${s.deal_id}`}>
                {s.enterprise_name} — {s.section_codes.length} section{s.section_codes.length > 1 ? 's' : ''} en attente depuis +{s.ageDays}j
              </li>
            ))}
            {inactiveMandats.map(m => (
              <li key={`m-${m.id}`}>
                {m.enterprise_name || m.deal_ref} — aucune activité depuis +7j
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
