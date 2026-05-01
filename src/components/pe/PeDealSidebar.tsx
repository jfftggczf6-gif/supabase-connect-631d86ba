import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, Home, FolderOpen, History,
  CheckCircle2, Circle, Loader2, FileEdit, ShieldCheck, FileCheck, Search, BookMarked,
  Send, AlertCircle,
} from 'lucide-react';

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

const COLLAPSIBLE_PHASES: Array<{
  stage: 'note_ic1' | 'note_ic_finale';
  label: string;
  icon: any;
  sections: typeof SECTIONS;
}> = [
  { stage: 'note_ic1',       label: 'Memo IC1',       icon: ShieldCheck, sections: SECTIONS },
  { stage: 'note_ic_finale', label: 'Memo IC finale', icon: FileCheck,   sections: SECTIONS },
];

type SectionWorkflowStatus = 'draft' | 'pending_validation' | 'validated' | 'needs_revision';

interface VersionWithSections {
  id: string;
  stage: string;
  status: 'generating' | 'ready' | 'validated' | 'rejected';
  filledSections: Set<string>;
  sectionStatusMap: Record<string, SectionWorkflowStatus>;
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
        .select('id, stage, status, memo_sections(section_code, content_md, content_json, status)')
        .eq('memo_id', memo.id)
        .order('created_at', { ascending: false });

      const map: Record<string, VersionWithSections> = {};
      (vers ?? []).forEach((v: any) => {
        if (map[v.stage]) return;
        const filled = new Set<string>();
        const statusMap: Record<string, SectionWorkflowStatus> = {};
        (v.memo_sections ?? []).forEach((s: any) => {
          if (s.content_md || (s.content_json && Object.keys(s.content_json).length > 0)) {
            filled.add(s.section_code);
          }
          statusMap[s.section_code] = (s.status as SectionWorkflowStatus) ?? 'draft';
        });
        map[v.stage] = { id: v.id, stage: v.stage, status: v.status, filledSections: filled, sectionStatusMap: statusMap };
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
    if (!v.filledSections.has(code)) return <Circle className="h-3 w-3 text-muted-foreground/40" />;

    // Section remplie : on affiche son statut workflow
    const ws = v.sectionStatusMap[code] ?? 'draft';
    if (ws === 'validated') return <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--pe-ok)' }} />;
    if (ws === 'pending_validation') return <Send className="h-3 w-3" style={{ color: 'var(--pe-info)' }} />;
    if (ws === 'needs_revision') return <AlertCircle className="h-3 w-3" style={{ color: 'var(--pe-warning)' }} />;
    return <CheckCircle2 className="h-3 w-3 text-muted-foreground" />;
  };

  const phaseProgress = (stage: string) => {
    const v = versions[stage];
    if (!v) return null;
    const total = SECTIONS.length;
    const done = v.filledSections.size;
    return `${done}/${total}`;
  };

  /** Compte les sections en attente de validation (pending) sur un stage donné. */
  const pendingCount = (stage: string): number => {
    const v = versions[stage];
    if (!v) return 0;
    return Object.values(v.sectionStatusMap).filter(s => s === 'pending_validation').length;
  };

  const ItemRow = ({
    active, onClick, icon: Icon, label, badge, disabled, rightExtra,
  }: { active: boolean; onClick: () => void; icon: any; label: string; badge?: string | number | null; disabled?: boolean; rightExtra?: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors',
        active ? 'bg-muted font-medium' : 'hover:bg-muted/50',
        disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {badge != null && badge !== '' && (
          <span className="text-[10px] text-muted-foreground">{badge}</span>
        )}
        {rightExtra}
      </div>
    </button>
  );

  return (
    <div className="w-64 shrink-0 border-r bg-card overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      <nav className="p-2 space-y-0.5">
        {/* Vue d'ensemble — toujours en haut */}
        <ItemRow
          active={selectedItem === 'overview'}
          onClick={() => onSelectItem('overview')}
          icon={Home}
          label="Vue d'ensemble"
        />

        {/* ── DONNÉES ── */}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1 px-3">Données</div>
        <ItemRow
          active={selectedItem === 'documents'}
          onClick={() => onSelectItem('documents')}
          icon={FolderOpen}
          label="Documents"
          badge={docCount || null}
        />
        <ItemRow
          active={selectedItem === 'benchmark'}
          onClick={() => onSelectItem('benchmark')}
          icon={BookMarked}
          label="Benchmark & sources"
        />
        <ItemRow
          active={selectedItem === 'history'}
          onClick={() => onSelectItem('history')}
          icon={History}
          label="Historique"
          badge={versionCount || null}
        />

        {/* ── LIVRABLES ── */}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1 px-3">Livrables</div>

        {/* Pré-screening : item unique avec TOC interne */}
        <ItemRow
          active={selectedItem === 'pre_screening'}
          onClick={() => onSelectItem('pre_screening')}
          icon={FileEdit}
          label="Pré-screening 360°"
          badge={phaseProgress('pre_screening')}
          rightExtra={pendingCount('pre_screening') > 0 ? (
            <span className="text-[10px] px-1 rounded font-medium" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
              {pendingCount('pre_screening')} ⏳
            </span>
          ) : null}
        />

        {/* Memo IC1 : dépliable */}
        {COLLAPSIBLE_PHASES.slice(0, 1).map((phase) => {
          const isOpen = expanded[phase.stage];
          const v = versions[phase.stage];
          const pending = pendingCount(phase.stage);
          return (
            <div key={phase.stage}>
              <button
                onClick={() => {
                  setExpanded(e => ({ ...e, [phase.stage]: !e[phase.stage] }));
                  onSelectItem(phase.stage);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors',
                  selectedItem === phase.stage ? 'bg-muted font-medium' : 'hover:bg-muted/50',
                )}
              >
                {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                <phase.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{phase.label}</span>
                {pending > 0 && (
                  <span className="text-[10px] px-1 rounded font-medium" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>{pending} ⏳</span>
                )}
                {phaseProgress(phase.stage) && (
                  <span className="text-[10px] text-muted-foreground">{phaseProgress(phase.stage)}</span>
                )}
              </button>
              {isOpen && (
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
            </div>
          );
        })}

        {/* DD : entre Memo IC1 et Memo IC finale */}
        <ItemRow
          active={selectedItem === 'dd'}
          onClick={() => onSelectItem('dd')}
          icon={Search}
          label="Due Diligence"
          badge="à venir"
          disabled
        />

        {/* Memo IC finale : dépliable */}
        {COLLAPSIBLE_PHASES.slice(1).map((phase) => {
          const isOpen = expanded[phase.stage];
          const v = versions[phase.stage];
          const isPlaceholder = !v;
          return (
            <div key={phase.stage}>
              <button
                onClick={() => {
                  setExpanded(e => ({ ...e, [phase.stage]: !e[phase.stage] }));
                  if (!isPlaceholder) onSelectItem(phase.stage);
                }}
                disabled={isPlaceholder}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors',
                  selectedItem === phase.stage ? 'bg-muted font-medium' : 'hover:bg-muted/50',
                  isPlaceholder && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                )}
              >
                {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                <phase.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{phase.label}</span>
                {phaseProgress(phase.stage)
                  ? <span className="text-[10px] text-muted-foreground">{phaseProgress(phase.stage)}</span>
                  : <span className="text-[10px] text-muted-foreground">à venir</span>}
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
            </div>
          );
        })}

      </nav>
    </div>
  );
}
