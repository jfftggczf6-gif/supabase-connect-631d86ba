import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import ScoreCircle from '@/components/dashboard/viewers/atoms/pe/ScoreCircle';
import ClassificationTag from '@/components/dashboard/viewers/atoms/pe/ClassificationTag';
import * as Sections from './sections';

type SectionCode =
  | 'executive_summary' | 'shareholding_governance' | 'top_management' | 'services'
  | 'competition_market' | 'unit_economics' | 'financials_pnl' | 'financials_balance'
  | 'investment_thesis' | 'support_requested' | 'esg_risks' | 'annexes';

const SECTION_RENDERERS: Record<SectionCode, React.ComponentType<{ section: any; allSections?: Record<string, any> }>> = {
  executive_summary:        Sections.ExecutiveSummarySection,
  shareholding_governance:  Sections.ShareholdingGovernanceSection,
  top_management:           Sections.TopManagementSection,
  services:                 Sections.ServicesSection,
  competition_market:       Sections.CompetitionMarketSection,
  unit_economics:           Sections.UnitEconomicsSection,
  financials_pnl:           Sections.FinancialsPnlSection,
  financials_balance:       Sections.FinancialsBalanceSection,
  investment_thesis:        Sections.InvestmentThesisSection,
  support_requested:        Sections.SupportRequestedSection,
  esg_risks:                Sections.EsgRisksSection,
  annexes:                  Sections.AnnexesSection,
};

interface Props {
  dealId: string;
  versionStage: 'pre_screening' | 'note_ic1' | 'note_ic_finale';
}

export default function MemoSectionsViewer({ dealId, versionStage }: Props) {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, any>>({});
  const [deal, setDeal] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // pe_deals : pas de colonne 'name', via enterprises (FK)
      const { data: dealData } = await supabase
        .from('pe_deals')
        .select('id, deal_ref, source, enterprises(name, sector, country), ticket_demande, currency')
        .eq('id', dealId)
        .maybeSingle();
      if (cancelled) return;
      setDeal(dealData);

      const { data: memo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (!memo) { setLoading(false); return; }

      const { data: versions } = await supabase
        .from('memo_versions')
        .select('*')
        .eq('memo_id', memo.id)
        .eq('stage', versionStage)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1);
      const v = versions?.[0];
      if (!v) { setLoading(false); return; }
      setVersion(v);

      const { data: secs } = await supabase
        .from('memo_sections')
        .select('*')
        .eq('version_id', v.id)
        .order('position');
      const map: Record<string, any> = {};
      (secs ?? []).forEach((s: any) => { map[s.section_code] = s; });
      if (cancelled) return;
      setSections(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId, versionStage]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="animate-spin h-4 w-4" /> Chargement...
      </div>
    );
  }
  if (!version) {
    return <div className="p-8 text-muted-foreground">Aucune version {versionStage} disponible.</div>;
  }

  const enterpriseName = (deal?.enterprises as any)?.name ?? deal?.deal_ref ?? '—';
  const enterpriseSector = (deal?.enterprises as any)?.sector;
  const enterpriseCountry = (deal?.enterprises as any)?.country;

  return (
    <div className="space-y-3 text-sm">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Pré-screening 360° enrichi</span>
              <ClassificationTag classification={version.classification} />
            </div>
            <div className="text-lg font-medium">{enterpriseName}</div>
            <div className="text-muted-foreground text-xs">
              {enterpriseSector ?? '—'} · {enterpriseCountry ?? '—'}
              {deal?.deal_ref && <> · Deal ref. {deal.deal_ref}</>}
            </div>
          </div>
          <div className="flex gap-2 items-start">
            {deal?.source && (
              <div className="text-center px-3 py-1.5 bg-muted rounded">
                <div className="text-[10px] text-muted-foreground">Source</div>
                <div className="text-sm font-medium">{deal.source}</div>
              </div>
            )}
            {version.overall_score != null && <ScoreCircle score={Number(version.overall_score)} />}
          </div>
        </CardContent>
      </Card>

      {/* 12 sections */}
      {(Object.keys(SECTION_RENDERERS) as SectionCode[]).map((code) => {
        const Renderer = SECTION_RENDERERS[code];
        const sec = sections[code];
        if (!sec) return null;
        return <Renderer key={code} section={sec} allSections={sections} />;
      })}
    </div>
  );
}
