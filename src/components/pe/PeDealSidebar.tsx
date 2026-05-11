import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Home, FolderOpen, History,
  CheckCircle2, Circle, Loader2, FileEdit, ShieldCheck, Search, BookMarked,
  Send, AlertCircle, Calculator, ZoomIn, FileSignature, Sparkles, Activity, DoorOpen, PenLine,
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
  /** Nom de l'entreprise — affiché dans le header (pattern programme). */
  enterpriseName?: string | null;
  /** Pays de l'entreprise — affiché sous le nom dans le header. */
  enterpriseCountry?: string | null;
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

export default function PeDealSidebar({ dealId, selectedItem, onSelectItem, dealStage, userRole, holdingMonths, enterpriseName, enterpriseCountry }: Props) {
  const [activeVersion, setActiveVersion] = useState<ActiveMemoVersion | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [versionCount, setVersionCount] = useState(0);

  const reload = async () => {
    const { data: memo } = await supabase
      .from('investment_memos')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle();

    if (memo) {
      // Living document : on prend la dernière version utilisable (skip 'rejected')
      const { data: vers } = await supabase
        .from('memo_versions')
        .select('id, stage, status, memo_sections(section_code, content_md, content_json, status)')
        .eq('memo_id', memo.id)
        .neq('status', 'rejected')
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

  // ItemRow aligné sur le pattern DashboardSidebar (programme/banque) :
  // border-l-2 transparent, active = bg-primary/10 + text-primary + border-l-primary
  const ItemRow = ({
    active, onClick, icon: Icon, label, badge, disabled, rightExtra, status,
  }: {
    active: boolean;
    onClick: () => void;
    icon: any;
    label: string;
    badge?: string | number | null;
    disabled?: boolean;
    rightExtra?: React.ReactNode;
    /** Statut module type programme : completed = check vert, in_progress = loader, sinon cercle vide */
    status?: 'completed' | 'in_progress' | 'not_started';
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-1.5 text-left text-xs transition-colors border-l-2',
        active
          ? 'bg-primary/10 text-primary font-medium border-l-primary'
          : 'border-l-transparent hover:bg-muted/50 ' + (status === 'completed' ? 'text-foreground' : 'text-muted-foreground'),
        disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
      )}
    >
      <Icon className="h-4 w-4 flex-none" />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && badge !== '' && (
        <span className="text-[10px] text-muted-foreground/70 flex-none">{badge}</span>
      )}
      {rightExtra}
      {status === 'completed' ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-none" />
      ) : status === 'in_progress' ? (
        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin flex-none" />
      ) : status === 'not_started' ? (
        <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex-none" />
      ) : null}
    </button>
  );

  // Calcul du % de progression — basé sur les sections du memo remplies / total
  const totalProgress = activeVersion
    ? Math.round((activeVersion.filledSections.size / SECTIONS.length) * 100)
    : 0;

  return (
    <div className="w-64 shrink-0 border-r bg-card overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {/* Header entreprise — pattern aligné sur DashboardSidebar (volet programme) */}
      {(enterpriseName || enterpriseCountry) && (
        <div className="px-4 py-4 border-b bg-violet-50/40">
          {enterpriseName && (
            <p className="font-bold text-sm text-foreground truncate">{enterpriseName}</p>
          )}
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            — · {enterpriseCountry || '—'}
          </p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${totalProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{totalProgress}% complété</p>
        </div>
      )}

      <nav className="p-2 space-y-0.5">
        {/* Vue d'ensemble — toujours en haut */}
        <ItemRow
          active={selectedItem === 'overview'}
          onClick={() => onSelectItem('overview')}
          icon={Home}
          label="Vue d'ensemble"
        />

        {/* ── DONNÉES ── */}
        <div className="w-full flex items-center gap-2 px-3 py-2 mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-100/60 rounded-md">
          <span className="flex-1 text-left">Données</span>
        </div>
        <ItemRow
          active={selectedItem === 'documents'}
          onClick={() => onSelectItem('documents')}
          icon={FolderOpen}
          label="Upload document"
        />
        <ItemRow
          active={selectedItem === 'notes'}
          onClick={() => onSelectItem('notes')}
          icon={PenLine}
          label="Notes analyste"
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
        />

        {/* ── ANALYSE (stage ≥ pre_screening) ── */}
        {isStageAtLeast(dealStage, 'pre_screening') && (
          <div className="w-full flex items-center gap-2 px-3 py-2 mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-100/60 rounded-md">
            <span className="flex-1 text-left">Analyse</span>
          </div>
        )}

        {/* Pré-screening 360° : visible dès stage ≥ pre_screening */}
        {isStageAtLeast(dealStage, 'pre_screening') && (
          <ItemRow
            active={selectedItem === 'pre_screening'}
            onClick={() => onSelectItem('pre_screening')}
            icon={FileEdit}
            label="Pré-screening 360°"
          />
        )}

        {/* Memo d'investissement : visible dès stage ≥ note_ic1
            FIXE — toujours déplié (pas de collapse), aligné sur le pattern programme */}
        {isStageAtLeast(dealStage, 'note_ic1') && (() => {
          const pending = memoPendingCount();
          return (
            <div>
              <button
                onClick={() => onSelectItem('memo')}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-1.5 text-left text-xs transition-colors border-l-2',
                  selectedItem === 'memo'
                    ? 'bg-primary/10 text-primary font-medium border-l-primary'
                    : 'border-l-transparent hover:bg-muted/50 text-foreground',
                )}
              >
                <ShieldCheck className="h-4 w-4 flex-none" />
                <span className="flex-1 truncate">Memo d'investissement</span>
                {pending > 0 && (
                  <span className="text-[10px] px-1 rounded font-medium bg-blue-50 text-blue-700">{pending} ⏳</span>
                )}
              </button>
              {/* Sections — toujours visibles (pas de collapse) */}
              <div className="ml-3 pl-3 border-l border-border/50 space-y-0.5 mt-0.5">
                {SECTIONS.map((s) => {
                  const itemKey = `memo:${s.code}`;
                  return (
                    <button
                      key={s.code}
                      onClick={() => onSelectItem(itemKey)}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-xs rounded transition-colors',
                        selectedItem === itemKey
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted/50 text-muted-foreground',
                      )}
                    >
                      <span className="truncate">{s.label}</span>
                      {sectionStatusIcon(s.code)}
                    </button>
                  );
                })}
              </div>
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

        {/* ── DÉCISION (stage ≥ dd) ── DD + Closing */}
        {isStageAtLeast(dealStage, 'dd') && (
          <div className="w-full flex items-center gap-2 px-3 py-2 mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-100/60 rounded-md">
            <span className="flex-1 text-left">Décision</span>
          </div>
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

        {/* Closing : visible dès stage ≥ closing, role IM/MD/admin/owner */}
        {isStageAtLeast(dealStage, 'closing') && canSeePortfolioOps(userRole) && (
          <ItemRow
            active={selectedItem === 'closing'}
            onClick={() => onSelectItem('closing')}
            icon={FileSignature}
            label="Closing"
          />
        )}

        {/* ── PORTEFEUILLE (stage ≥ portfolio, role IM/MD/admin/owner) ── */}
        {isStageAtLeast(dealStage, 'portfolio') && canSeePortfolioOps(userRole) && (
          <div className="w-full flex items-center gap-2 px-3 py-2 mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-100/60 rounded-md">
            <span className="flex-1 text-left">Portefeuille</span>
          </div>
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

        {/* ── SORTIE (stage ≥ exit_prep OU portfolio ≥ 36 mois, role MD/admin/owner) ── */}
        {((isStageAtLeast(dealStage, 'exit_prep')) ||
          (isStageAtLeast(dealStage, 'portfolio') && (holdingMonths ?? 0) >= 36)) &&
          canSeeExit(userRole) && (
          <>
            <div className="w-full flex items-center gap-2 px-3 py-2 mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-100/60 rounded-md">
              <span className="flex-1 text-left">Sortie</span>
            </div>
            <ItemRow
              active={selectedItem === 'exit_prep'}
              onClick={() => onSelectItem('exit_prep')}
              icon={DoorOpen}
              label="Exit & sortie"
            />
          </>
        )}

      </nav>
    </div>
  );
}
