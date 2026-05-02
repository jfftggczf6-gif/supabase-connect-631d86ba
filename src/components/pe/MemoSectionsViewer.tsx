import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

const SECTION_LABELS: Record<SectionCode, string> = {
  executive_summary:        'Résumé exécutif',
  shareholding_governance:  'Actionnariat & gouvernance',
  top_management:           'Top management',
  services:                 'Services',
  competition_market:       'Concurrence & marché',
  unit_economics:           'Units economics',
  financials_pnl:           'États financiers PnL',
  financials_balance:       'États financiers Bilan',
  investment_thesis:        "Thèse d'investissement",
  support_requested:        'Accompagnement demandé',
  esg_risks:                'ESG / Risques',
  annexes:                  'Annexes',
};

const SECTION_ORDER: SectionCode[] = [
  'executive_summary', 'shareholding_governance', 'top_management', 'services',
  'competition_market', 'unit_economics', 'financials_pnl', 'financials_balance',
  'investment_thesis', 'support_requested', 'esg_risks', 'annexes',
];

interface Props {
  dealId: string;
  /** Living document : on query toujours la latest version active. Le stage est ignoré. */
  versionStage?: 'pre_screening' | 'note_ic1' | 'note_ic_finale';
  /** Si true, affiche une table des matières interne à gauche du contenu (pattern programme). */
  withToc?: boolean;
  /** Titre de la page. Par défaut "Memo d'investissement". */
  title?: string;
}

export default function MemoSectionsViewer({ dealId, withToc = false, title }: Props) {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, any>>({});
  const [deal, setDeal] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<SectionCode>('executive_summary');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
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

      // Living document : on prend toujours la dernière version 'ready' (peu importe le stage)
      const { data: versions } = await supabase
        .from('memo_versions')
        .select('*')
        .eq('memo_id', memo.id)
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
  }, [dealId]);

  // IntersectionObserver pour mettre à jour la section active selon le scroll (TOC mode)
  useEffect(() => {
    if (!withToc || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const code = visible[0].target.getAttribute('data-section') as SectionCode;
          if (code) setActiveSection(code);
        }
      },
      { rootMargin: '-20% 0% -60% 0%', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    SECTION_ORDER.forEach((code) => {
      const el = sectionRefs.current[code];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [withToc, loading, sections]);

  const scrollToSection = (code: SectionCode) => {
    const el = sectionRefs.current[code];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="animate-spin h-4 w-4" /> Chargement...
      </div>
    );
  }
  if (!version) {
    return <div className="p-8 text-muted-foreground">Aucun memo disponible. Génère le pré-screening pour initialiser le dossier.</div>;
  }

  const enterpriseName = (deal?.enterprises as any)?.name ?? deal?.deal_ref ?? '—';
  const enterpriseSector = (deal?.enterprises as any)?.sector;
  const enterpriseCountry = (deal?.enterprises as any)?.country;

  const headerCard = (
    <Card>
      <CardContent className="p-4 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{title ?? `Memo d'investissement · ${version.stage ?? 'pre_screening'}`}</span>
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
  );

  const sectionsList = SECTION_ORDER.map((code, idx) => {
    const Renderer = SECTION_RENDERERS[code];
    const sec = sections[code];
    if (!sec) return null;
    return (
      <div
        key={code}
        ref={(el) => { sectionRefs.current[code] = el; }}
        data-section={code}
        id={`section-${code}`}
      >
        <Renderer section={sec} allSections={sections} />
      </div>
    );
  });

  if (!withToc) {
    return (
      <div className="space-y-3 text-sm">
        {headerCard}
        {sectionsList}
      </div>
    );
  }

  // Layout 2 colonnes interne : TOC à gauche + contenu à droite
  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 text-sm">
      {/* TOC sticky */}
      <aside className="border-r pr-3">
        <div className="sticky top-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Table des matières</div>
          <ol className="space-y-0.5">
            {SECTION_ORDER.map((code, idx) => {
              const filled = !!sections[code]?.content_md || !!sections[code]?.content_json;
              const active = activeSection === code;
              return (
                <li key={code}>
                  <button
                    onClick={() => scrollToSection(code)}
                    disabled={!filled}
                    className={cn(
                      'w-full flex items-center gap-1.5 text-left text-xs py-1 px-1.5 rounded transition-colors',
                      active && 'bg-primary/10 text-primary font-medium',
                      !active && filled && 'hover:bg-muted text-foreground',
                      !filled && 'text-muted-foreground/40 cursor-not-allowed',
                    )}
                  >
                    <span className="text-[10px] tabular-nums">{idx + 1}.</span>
                    <span className="truncate">{SECTION_LABELS[code]}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>

      {/* Contenu */}
      <div className="space-y-3 min-w-0">
        {headerCard}
        {sectionsList}
      </div>
    </div>
  );
}
