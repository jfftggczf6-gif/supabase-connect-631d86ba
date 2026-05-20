// src/components/pe/PeDealSidebar.tsx
//
// Brief #37 [CROSS] Mutualiser sidebar PE + BA — ce composant est désormais
// un wrapper léger autour de `shared/DealSideNav`. Toute la logique métier PE
// (stage-gating, role-gating, data fetching, sub-items memo, badges) reste
// localisée ici ; le rendu visuel est délégué au shared.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Home, FolderOpen, History, FileEdit, ShieldCheck, Search,
  BookMarked, Calculator, FileSignature, Sparkles, Activity, DoorOpen, PenLine, Lock,
} from 'lucide-react';
import DealSideNav, {
  type SharedSidebarGroup, type SharedSidebarItem, type SharedSectionStatus,
} from '@/components/shared/DealSideNav';

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

// ═══════════════════════════════════════════════════════════════════════════
// Mapping workflow status PE → SharedSectionStatus
// ═══════════════════════════════════════════════════════════════════════════
function workflowToShared(ws: SectionWorkflowStatus | undefined, filled: boolean): SharedSectionStatus {
  if (!filled) return 'not_started';
  if (!ws) return 'draft';
  if (ws === 'validated') return 'validated';
  if (ws === 'pending_validation') return 'pending_validation';
  if (ws === 'needs_revision') return 'needs_revision';
  return 'draft';
}

export default function PeDealSidebar({
  dealId, selectedItem, onSelectItem, dealStage, userRole, holdingMonths,
  enterpriseName, enterpriseCountry,
}: Props) {
  const [activeVersion, setActiveVersion] = useState<ActiveMemoVersion | null>(null);
  const [hasValuation, setHasValuation] = useState(false);
  const [hasDdFindings, setHasDdFindings] = useState(false);

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
    } else {
      setActiveVersion(null);
    }

    // Existence de livrables avancés (sert à débloquer la nav même si le stage
    // du deal n'a pas encore été avancé manuellement par l'IM/MD).
    const [{ data: valuation }, { count: ddCount }] = await Promise.all([
      supabase
        .from('pe_valuation')
        .select('status')
        .eq('deal_id', dealId)
        .maybeSingle(),
      supabase
        .from('pe_dd_findings')
        .select('id', { count: 'exact', head: true })
        .eq('deal_id', dealId),
    ]);
    setHasValuation(!!valuation && valuation.status === 'ready');
    setHasDdFindings((ddCount ?? 0) > 0);
  };

  useEffect(() => { reload(); }, [dealId]);

  // Calcul du % de progression — basé sur les sections du memo remplies / total
  const totalProgress = activeVersion
    ? Math.round((activeVersion.filledSections.size / SECTIONS.length) * 100)
    : 0;

  // Compteur memo sections en attente de validation (pour badge)
  const memoPendingCount = activeVersion
    ? Object.values(activeVersion.sectionStatusMap).filter(s => s === 'pending_validation').length
    : 0;

  // Gates "contenu existe" : la sidebar débloque les sections dès qu'un livrable
  // a été généré, indépendamment du stage formel du deal.
  const hasMemoEnriched =
    activeVersion?.stage === 'note_ic1' || activeVersion?.stage === 'note_ic_finale';
  const showAnalysis = isStageAtLeast(dealStage, 'pre_screening') || !!activeVersion;
  const showMemo = isStageAtLeast(dealStage, 'note_ic1') || hasMemoEnriched;
  const showValuation = isStageAtLeast(dealStage, 'note_ic1') || hasValuation;
  const showDecision = isStageAtLeast(dealStage, 'dd') || hasDdFindings;
  const showPortfolio = isStageAtLeast(dealStage, 'portfolio') && canSeePortfolioOps(userRole);
  const showExit = ((isStageAtLeast(dealStage, 'exit_prep')) ||
    (isStageAtLeast(dealStage, 'portfolio') && (holdingMonths ?? 0) >= 36)) &&
    canSeeExit(userRole);
  const showClosing = isStageAtLeast(dealStage, 'closing') && canSeePortfolioOps(userRole);

  // ─── Construction des groupes pour DealSideNav ─────────────────────────────
  const groups: SharedSidebarGroup<string>[] = [];

  // Groupe synthétique pour "Vue d'ensemble" (sans header — affiché tout en haut)
  groups.push({
    code: 'top',
    label: '',
    items: [
      { code: 'overview', label: "Vue d'ensemble", status: 'not_started', icon: Home },
    ],
  });

  // ── DONNÉES ──
  groups.push({
    code: 'donnees',
    label: 'Données',
    items: [
      { code: 'documents', label: 'Upload document',   status: 'not_started', icon: FolderOpen },
      { code: 'notes',     label: 'Notes analyste',    status: 'not_started', icon: PenLine },
      { code: 'benchmark', label: 'Benchmark & sources', status: 'not_started', icon: BookMarked },
      { code: 'history',   label: 'Historique',        status: 'not_started', icon: History },
    ],
  });

  // ── ANALYSE ──
  if (showAnalysis) {
    const analyseItems: SharedSidebarItem<string>[] = [
      { code: 'pre_screening', label: 'Pré-screening 360°', status: 'not_started', icon: FileEdit },
    ];
    if (showMemo) {
      // Memo parent + 12 sub-items
      const memoSubItems: SharedSidebarItem<string>[] = SECTIONS.map(s => {
        const ws = activeVersion?.sectionStatusMap[s.code];
        const filled = activeVersion?.filledSections.has(s.code) ?? false;
        return {
          code: `memo:${s.code}`,
          label: s.label,
          status: workflowToShared(ws, filled),
        };
      });
      analyseItems.push({
        code: 'memo',
        label: "Memo d'investissement",
        status: 'not_started',
        icon: ShieldCheck,
        badge: memoPendingCount > 0
          ? <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{memoPendingCount} ⏳</span>
          : undefined,
        subItems: memoSubItems,
      });
    }
    if (showValuation) {
      analyseItems.push({ code: 'valuation', label: 'Valuation', status: 'not_started', icon: Calculator });
    }
    groups.push({ code: 'analyse', label: 'Analyse', items: analyseItems });
  }

  // ── DÉCISION ──
  if (showDecision) {
    const decisionItems: SharedSidebarItem<string>[] = [
      { code: 'dd', label: 'Due Diligence', status: 'not_started', icon: Search },
    ];
    if (showClosing) {
      decisionItems.push({ code: 'closing', label: 'Closing', status: 'not_started', icon: FileSignature });
    }
    groups.push({ code: 'decision', label: 'Décision', items: decisionItems });
  }

  // ── DATA ROOM ── (brief #35) — toujours dispo dès qu'un memo existe
  if (showAnalysis) {
    groups.push({
      code: 'partage',
      label: 'Partage',
      items: [
        { code: 'data_room', label: 'Data Room', status: 'not_started', icon: Lock },
      ],
    });
  }

  // ── PORTEFEUILLE ──
  if (showPortfolio) {
    groups.push({
      code: 'portefeuille',
      label: 'Portefeuille',
      items: [
        { code: 'plan_100j',          label: 'Plan 100 jours', status: 'not_started', icon: Sparkles },
        { code: 'monitoring',         label: 'Monitoring',     status: 'not_started', icon: Activity },
        { code: 'valuation_history',  label: 'NAV History',    status: 'not_started', icon: History },
      ],
    });
  }

  // ── SORTIE ──
  if (showExit) {
    groups.push({
      code: 'sortie',
      label: 'Sortie',
      items: [
        { code: 'exit_prep', label: 'Exit & sortie', status: 'not_started', icon: DoorOpen },
      ],
    });
  }

  // Header entreprise (pattern programme aligné — préservé tel quel)
  const headerNode = (enterpriseName || enterpriseCountry) ? (
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
  ) : undefined;

  return (
    <DealSideNav<string>
      groups={groups}
      active={selectedItem}
      onSelect={onSelectItem}
      topContent={headerNode}
      width="w-64"
      groupHeaderStyle="highlighted"
    />
  );
}
