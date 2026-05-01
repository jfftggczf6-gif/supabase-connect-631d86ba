import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, Home, FileText, FolderOpen, History,
  CheckCircle2, Circle, Loader2, FileEdit, ShieldCheck, FileCheck, Settings,
} from 'lucide-react';

// Les 12 sections fixes (synchronisé avec memo-helpers.ts SECTION_ORDER)
const SECTIONS = [
  { code: 'executive_summary',       label: 'Résumé exécutif' },
  { code: 'shareholding_governance', label: 'Actionnariat & gouvernance' },
  { code: 'top_management',          label: 'Top management' },
  { code: 'services',                label: 'Services' },
  { code: 'competition_market',      label: 'Concurrence & marché' },
  { code: 'unit_economics',          label: 'Units economics' },
  { code: 'financials_pnl',          label: 'États financiers PnL' },
  { code: 'financials_balance',      label: 'États financiers Bilan' },
  { code: 'investment_thesis',       label: "Thèse d'investissement" },
  { code: 'support_requested',       label: 'Accompagnement demandé' },
  { code: 'esg_risks',               label: 'ESG / Risques' },
  { code: 'annexes',                 label: 'Annexes' },
] as const;

type SectionCode = typeof SECTIONS[number]['code'];

// Pre-screening = 1 document unique (TOC interne) → pas d'expansion sidebar
// Memo IC1 / IC finale = sections dépliables (édition par section, comme livrables programme)
const COLLAPSIBLE_PHASES: Array<{
  stage: 'note_ic1' | 'note_ic_finale';
  label: string;
  icon: any;
  sections: typeof SECTIONS;
}> = [
  { stage: 'note_ic1',       label: 'Memo IC1',        icon: ShieldCheck, sections: SECTIONS },
  { stage: 'note_ic_finale', label: 'Memo IC finale',  icon: FileCheck,   sections: SECTIONS },
];

interface VersionWithSections {
  id: string;
  stage: string;
  status: 'generating' | 'ready' | 'validated' | 'rejected';
  filledSections: Set<string>;
}

interface Props {
  dealId: string;
  selectedItem: string;
  onSelectItem: (item: string) => void;
}

export default function PeDealSidebar({ dealId, selectedItem, onSelectItem }: Props) {
  const [versions, setVersions] = useState<Record<string, VersionWithSections>>({});
  const [docCount, setDocCount] = useState(0);
  const [versionCount, setVersionCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    note_ic1: false,
    note_ic_finale: false,
  });

  const reload = async () => {
    const { data: memo } = await supabase
      .from('investment_memos')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle();

    if (memo) {
      const { data: vers } = await supabase
        .from('memo_versions')
        .select('id, stage, status, memo_sections(section_code, content_md, content_json)')
        .eq('memo_id', memo.id)
        .order('created_at', { ascending: false });

      const map: Record<string, VersionWithSections> = {};
      (vers ?? []).forEach((v: any) => {
        // pour chaque stage, on garde la dernière (plus récente) version ready/generating
        if (map[v.stage]) return;
        const filled = new Set<string>();
        (v.memo_sections ?? []).forEach((s: any) => {
          if (s.content_md || (s.content_json && Object.keys(s.content_json).length > 0)) {
            filled.add(s.section_code);
          }
        });
        map[v.stage] = { id: v.id, stage: v.stage, status: v.status, filledSections: filled };
      });
      setVersions(map);
      setVersionCount(vers?.length ?? 0);
    } else {
      setVersions({});
      setVersionCount(0);
    }

    const { count } = await supabase
      .from('pe_deal_documents')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', dealId);
    setDocCount(count ?? 0);
  };

  useEffect(() => { reload(); }, [dealId]);

  const sectionStatusIcon = (stage: string, code: string) => {
    const v = versions[stage];
    if (!v) return <Circle className="h-3 w-3 text-muted-foreground/40" />;
    if (v.status === 'generating') return <Loader2 className="h-3 w-3 animate-spin text-info" />;
    if (v.status === 'rejected') return <Circle className="h-3 w-3 text-destructive" />;
    if (v.filledSections.has(code)) return <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--pe-ok)' }} />;
    return <Circle className="h-3 w-3 text-muted-foreground/40" />;
  };

  const phaseProgress = (stage: string) => {
    const v = versions[stage];
    if (!v) return null;
    const total = SECTIONS.length;
    const done = v.filledSections.size;
    return `${done}/${total}`;
  };

  const ItemRow = ({
    active, onClick, icon: Icon, label, badge,
  }: { active: boolean; onClick: () => void; icon: any; label: string; badge?: string | number | null }) => (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors',
        active ? 'bg-muted font-medium' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </div>
      {badge != null && badge !== '' && (
        <span className="text-[10px] text-muted-foreground shrink-0">{badge}</span>
      )}
    </button>
  );

  return (
    <div className="w-64 shrink-0 border-r bg-card overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      <nav className="p-2 space-y-0.5">
        <ItemRow
          active={selectedItem === 'overview'}
          onClick={() => onSelectItem('overview')}
          icon={Home}
          label="Vue d'ensemble"
        />
        <ItemRow
          active={selectedItem === 'settings'}
          onClick={() => onSelectItem('settings')}
          icon={Settings}
          label="Paramètres"
        />

        {/* Section header DONNÉES */}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1 px-3">Données</div>

        {/* Documents */}
        <ItemRow
          active={selectedItem === 'documents'}
          onClick={() => onSelectItem('documents')}
          icon={FolderOpen}
          label="Documents"
          badge={docCount || null}
        />

        {/* Section header LIVRABLES */}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1 px-3">Livrables</div>

        {/* Pré-screening : item unique (TOC interne) */}
        <ItemRow
          active={selectedItem === 'pre_screening'}
          onClick={() => onSelectItem('pre_screening')}
          icon={FileEdit}
          label="Pré-screening 360°"
          badge={phaseProgress('pre_screening')}
        />

        {/* Memo IC1 / IC finale : header dépliable + sous-sections */}
        {COLLAPSIBLE_PHASES.map((phase) => {
          const isOpen = expanded[phase.stage];
          const v = versions[phase.stage];
          const isPlaceholder = phase.stage === 'note_ic_finale' && !v;
          return (
            <div key={phase.stage}>
              <button
                onClick={() => {
                  setExpanded(e => ({ ...e, [phase.stage]: !e[phase.stage] }));
                  // Cliquer sur le header sélectionne aussi le mode "tout voir"
                  if (!isPlaceholder) onSelectItem(phase.stage);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors',
                  selectedItem === phase.stage ? 'bg-muted font-medium' : 'hover:bg-muted/50',
                  isPlaceholder && 'opacity-50',
                )}
              >
                {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                <phase.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{phase.label}</span>
                {phaseProgress(phase.stage) && (
                  <span className="text-[10px] text-muted-foreground">{phaseProgress(phase.stage)}</span>
                )}
              </button>
              {isOpen && !isPlaceholder && (
                <div className="ml-3 pl-3 border-l border-border/50 space-y-0.5 mt-0.5">
                  {phase.sections.map((s) => {
                    const itemKey = `${phase.stage}:${s.code}`;
                    return (
                      <button
                        key={s.code}
                        onClick={() => onSelectItem(itemKey)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-xs rounded transition-colors',
                          selectedItem === itemKey ? 'bg-muted font-medium' : 'hover:bg-muted/50',
                        )}
                      >
                        <span className="truncate">{s.label}</span>
                        {sectionStatusIcon(phase.stage, s.code)}
                      </button>
                    );
                  })}
                </div>
              )}
              {isOpen && isPlaceholder && (
                <p className="ml-8 text-[10px] text-muted-foreground py-1">À venir (Phase D'/E')</p>
              )}
            </div>
          );
        })}

        {/* DD placeholder */}
        <ItemRow
          active={false}
          onClick={() => {/* disabled */}}
          icon={FileText}
          label="Due Diligence"
          badge="à venir"
        />

        {/* Section header SUIVI */}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1 px-3">Suivi</div>

        {/* Historique */}
        <ItemRow
          active={selectedItem === 'history'}
          onClick={() => onSelectItem('history')}
          icon={History}
          label="Historique"
          badge={versionCount || null}
        />
      </nav>
    </div>
  );
}

export type PeWorkspaceItem = string;
