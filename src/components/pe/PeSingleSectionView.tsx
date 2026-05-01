import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import * as Sections from './sections';

const SECTION_RENDERERS: Record<string, React.ComponentType<{ section: any; allSections?: Record<string, any> }>> = {
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
  stage: 'pre_screening' | 'note_ic1' | 'note_ic_finale';
  sectionCode: string;
}

export default function PeSingleSectionView({ dealId, stage, sectionCode }: Props) {
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<any>(null);
  const [allSections, setAllSections] = useState<Record<string, any>>({});
  const [versionMeta, setVersionMeta] = useState<{ status: string; label: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: memo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (!memo) { setLoading(false); return; }

      const { data: vers } = await supabase
        .from('memo_versions')
        .select('id, status, label')
        .eq('memo_id', memo.id)
        .eq('stage', stage)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1);
      const v = vers?.[0];
      if (!v) { setLoading(false); return; }
      setVersionMeta({ status: v.status, label: v.label });

      const { data: secs } = await supabase
        .from('memo_sections')
        .select('*')
        .eq('version_id', v.id);
      const map: Record<string, any> = {};
      (secs ?? []).forEach((s: any) => { map[s.section_code] = s; });
      if (cancelled) return;
      setAllSections(map);
      setSection(map[sectionCode] ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId, stage, sectionCode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="animate-spin h-4 w-4" /> Chargement...
      </div>
    );
  }

  if (!section) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Cette section n'a pas encore été générée.
        {!versionMeta && (
          <p className="mt-2">Drop des documents sur la carte du deal puis pousse en pré-screening pour générer le dossier.</p>
        )}
      </div>
    );
  }

  const Renderer = SECTION_RENDERERS[sectionCode];
  if (!Renderer) return <div className="p-8 text-muted-foreground">Section inconnue : {sectionCode}</div>;

  return (
    <div className="space-y-3">
      {versionMeta && (
        <div className="text-xs text-muted-foreground">
          Version : <strong>{versionMeta.label}</strong> · status : {versionMeta.status}
        </div>
      )}
      <Renderer section={section} allSections={allSections} />
    </div>
  );
}
