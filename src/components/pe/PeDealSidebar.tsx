import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, Home, FolderOpen, History,
  CheckCircle2, Circle, Loader2, FileEdit, ShieldCheck, Search, BookMarked, GitCompareArrows,
  Send, AlertCircle, Calculator, ZoomIn, FileSignature, Sparkles, Activity, DoorOpen,
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

// Living document : un seul memo qui évolue à travers les stages.
// La sidebar affiche UN item collapsible "Memo d'investissement" + un badge stage.
const STAGE_BADGE_LABELS: Record<string, string> = {
  pre_screening: 'Pré-screening',
  note_ic1: 'IC1',
  note_ic_finale: 'IC finale',
  dd: 'DD',
  closing: 'Closing',
  portfolio: 'Portfolio',
};

type SectionWorkflowStatus = 'draft' | 'pending_validation' | 'validated' | 'needs_revision';

interface ActiveMemoVersion {
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
  /** Stage actuel du deal (pilote la visibilité progressive des items). */
  dealStage?: string;
  /** Rôle de l'utilisateur courant — utilisé pour role-gating des items post-invest. */
  userRole?: string | null;
  /** Nombre de mois de portage (utilisé pour révéler "Exit & sortie" après ~3 ans). */
  holdingMonths?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers de visibilité — stage-gating + role-gating
// ═══════════════════════════════════════════════════════════════════════════

const STAGE_ORDER = [
  'sourcing', 'pre_screening', 'note_ic1', 'dd', 'note_ic_finale',
  'closing', 'portfolio', 'exit_prep', 'exited',
];

function isStageAtLeast(currentStage: string | undefined, minStage: string): boolean {
  if (!currentStage) return false;
  const ci = STAGE_ORDER.indexOf(currentStage);
  const mi = STAGE_ORDER.indexOf(minStage);
  if (ci < 0 || mi < 0) return true; // legacy / unknown stages : permissif
  return ci >= mi;
}

const ROLES_PORTFOLIO_OPS = ['investment_manager', 'managing_director', 'owner', 'admin', 'super_admin'];
const ROLES_EXIT = ['managing_director', 'owner', 'admin', 'super_admin'];

function canSeePortfolioOps(role?: string | null): boolean {
  if (!role) return true; // role inconnu : permissif (cas legacy / dev)
  return ROLES_PORTFOLIO_OPS.includes(role);
}

function canSeeExit(role?: string | null): boolean {
  if (!role) return true;
  return ROLES_EXIT.includes(role);
}

export default function PeDealSidebar({ dealId, selectedItem, onSelectItem, dealStage, userRole, holdingMonths }: Props) {
  const [activeVersion, setActiveVersion] = useState<ActiveMemoVersion | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [versionCount, setVersionCount] = useState(0);
  const [expanded, setExpanded] = useState<boolean>(true);

  const reload = async () => {
    const { data: memo } = await supabase
      .from('investment_memos')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle();

    if (memo) {
      // Living document : on prend la dernière version (peu importe le stage)
      const { data: vers } = await supabase
        .from('memo_versions')
        .select('id, stage, status, memo_sections(section_code, content_md, content_json, status)')
        .eq('memo_id', memo.id)
        .order('created_at', { ascending: false });

      const latest = vers?.[0];
      if (latest) {
        const filled = new Set<string>();
        const statusMap: Record<string, SectionWorkflowStatus> = {};
        (latest.memo_sections ?? []).forEach((s: any) => {
          if (s.content_md || (s.content_json && Object.keys(s.content_json).length > 0)) {
            filled.add(s.section_code);
          }
          statusMap[s.section_code] = (s.status as SectionWorkflowStatus) ?? 'draft';
        });
        setActiveVersion({
          id: latest.id,
          stage: latest.stage,
          status: latest.status,
          filledSections: filled,
          sectionStatusMap: statusMap,
        });
      } else {
        setActiveVersion(null);
      }
      setVersionCount(vers?.length ?? 0);
    } else {
      setActiveVersion(null);
      setVersionCount(0);
    }

    const { count } = await supabase
      .from('pe_deal_documents')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', dealId);
    setDocCount(count ?? 0);
  };

  useEffect(() => { reload(); }, [dealId]);

  const sectionStatusIcon = (code: string) => {
    if (!activeVersion) return <Circle className="h-3 w-3 text-muted-foreground/40" />;
    if (activeVersion.status === 'generating') return <Loader2 className="h-3 w-3 animate-spin text-info" />;
    if (activeVersion.status === 'rejected') return <Circle className="h-3 w-3 text-destructive" />;
    if (!activeVersion.filledSections.has(code)) return <Circle className="h-3 w-3 text-muted-foreground/40" />;

    // Section remplie : on affiche son statut workflow
    const ws = activeVersion.sectionStatusMap[code] ?? 'draft';
    if (ws === 'validated') return <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--pe-ok)' }} />;
    if (ws === 'pending_validation') return <Send className="h-3 w-3" style={{ color: 'var(--pe-info)' }} />;
    if (ws === 'needs_revision') return <AlertCircle className="h-3 w-3" style={{ color: 'var(--pe-warning)' }} />;
    return <CheckCircle2 className="h-3 w-3 text-muted-foreground" />;
  };

  const memoProgress = (): string | null => {
    if (!activeVersion) return null;
    return `${activeVersion.filledSections.size}/${SECTIONS.length}`;
  };

  const memoPendingCount = (): number => {
    if (!activeVersion) return 0;
    return Object.values(activeVersion.sectionStatusMap).filter(s => s === 'pending_validation').length;
  };

  const memoStageBadge = (): string | null => {
    if (!activeVersion) return null;
    return STAGE_BADGE_LABELS[activeVersion.stage] ?? activeVersion.stage;
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
          label="Upload document"
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
        {/* Versions du memo : visible dès qu'au moins 2 versions ont été créées (stage ≥ DD) */}
        {isStageAtLeast(dealStage, 'dd') && (
          <ItemRow
            active={selectedItem === 'memo_versions'}
            onClick={() => onSelectItem('memo_versions')}
            icon={GitCompareArrows}
            label="Versions du memo"
          />
        )}

        {/* ── LIVRABLES ── */}
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1 px-3">Livrables</div>

        {/* Pré-screening 360° : visible dès stage ≥ pre_screening */}
        {isStageAtLeast(dealStage, 'pre_screening') && (
          <ItemRow
            active={selectedItem === 'pre_screening'}
            onClick={() => onSelectItem('pre_screening')}
            icon={FileEdit}
            label="Pré-screening 360°"
            badge={memoProgress()}
          />
        )}

        {/* Memo d'investissement : visible dès stage ≥ note_ic1 */}
        {isStageAtLeast(dealStage, 'note_ic1') && (() => {
          const isOpen = expanded;
          const stageBadge = memoStageBadge();
          const pending = memoPendingCount();
          return (
            <div>
              <button
                onClick={() => {
                  setExpanded(e => !e);
                  onSelectItem('memo');
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors',
                  selectedItem === 'memo' ? 'bg-muted font-medium' : 'hover:bg-muted/50',
                )}
              >
                {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">Memo d'investissement</span>
                {stageBadge && (
                  <span className="text-[10px] px-1.5 rounded font-medium" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)' }}>
                    {stageBadge}
                  </span>
                )}
                {pending > 0 && (
                  <span className="text-[10px] px-1 rounded font-medium" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>{pending} ⏳</span>
                )}
                {memoProgress() && (
                  <span className="text-[10px] text-muted-foreground">{memoProgress()}</span>
                )}
              </button>
              {isOpen && (
                <div className="ml-3 pl-3 border-l border-border/50 space-y-0.5 mt-0.5">
                  {SECTIONS.map((s) => {
                    const itemKey = `memo:${s.code}`;
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
                        {sectionStatusIcon(s.code)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Valuation : visible dès stage ≥ note_ic1 */}
        {isStageAtLeast(dealStage, 'note_ic1') && (
          <ItemRow
            active={selectedItem === 'valuation'}
            onClick={() => onSelectItem('valuation')}
            icon={Calculator}
            label="Valuation"
          />
        )}

        {/* DD : visible dès stage ≥ dd */}
        {isStageAtLeast(dealStage, 'dd') && (
          <ItemRow
            active={selectedItem === 'dd'}
            onClick={() => onSelectItem('dd')}
            icon={Search}
            label="Due Diligence"
          />
        )}

        {/* ── PORTFOLIO MANAGEMENT (stage ≥ closing/portfolio + role IM/MD/admin/owner) ── */}
        {(isStageAtLeast(dealStage, 'closing') && canSeePortfolioOps(userRole)) && (
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1 px-3">
            Portefeuille
          </div>
        )}

        {/* Closing : visible dès stage ≥ closing, role IM/MD/admin/owner */}
        {isStageAtLeast(dealStage, 'closing') && canSeePortfolioOps(userRole) && (
          <ItemRow
            active={selectedItem === 'closing'}
            onClick={() => onSelectItem('closing')}
            icon={FileSignature}
            label="Closing"
          />
        )}

        {/* Plan 100 jours : stage ≥ portfolio, role IM/MD/admin/owner */}
        {isStageAtLeast(dealStage, 'portfolio') && canSeePortfolioOps(userRole) && (
          <ItemRow
            active={selectedItem === 'plan_100j'}
            onClick={() => onSelectItem('plan_100j')}
            icon={Sparkles}
            label="Plan 100 jours"
          />
        )}

        {/* Monitoring trimestriel : stage ≥ portfolio, role IM/MD/admin/owner */}
        {isStageAtLeast(dealStage, 'portfolio') && canSeePortfolioOps(userRole) && (
          <ItemRow
            active={selectedItem === 'monitoring'}
            onClick={() => onSelectItem('monitoring')}
            icon={Activity}
            label="Monitoring"
          />
        )}

        {/* NAV history : stage ≥ portfolio, role IM/MD/admin/owner */}
        {isStageAtLeast(dealStage, 'portfolio') && canSeePortfolioOps(userRole) && (
          <ItemRow
            active={selectedItem === 'valuation_history'}
            onClick={() => onSelectItem('valuation_history')}
            icon={History}
            label="NAV History"
          />
        )}

        {/* Exit & sortie : stage ≥ exit_prep OU (portfolio ET >= 36 mois holding), role MD/admin/owner */}
        {((isStageAtLeast(dealStage, 'exit_prep')) ||
          (isStageAtLeast(dealStage, 'portfolio') && (holdingMonths ?? 0) >= 36)) &&
          canSeeExit(userRole) && (
          <ItemRow
            active={selectedItem === 'exit_prep'}
            onClick={() => onSelectItem('exit_prep')}
            icon={DoorOpen}
            label="Exit & sortie"
          />
        )}

      </nav>
    </div>
  );
}
