// src/components/ba/MandatShell.tsx
// Conteneur principal du workspace mandat BA.
// Structure ALIGNÉE sur le wireframe BA (remixed-3d73666a.tsx) :
//   Données : Upload documents · Informations de l'analyste · Benchmarks · Sources & références
//   Pré-screening : Pré-screening
//   Mémo investissement : §1 à §12 (sections dynamiques)
//   Valorisation : Valorisation
//   Teaser : Teaser
//   Diffusion (Partner only) : Investisseurs cibles (+ Suivi diffusion + Data Room)
//
// Routing interne par query param ?section=<code>.

import { useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MandatSubHeader from './MandatSubHeader';
import MandatSideNav from './MandatSideNav';
import PlaceholderSection from './sections/PlaceholderSection';
import UploadDocumentsSection from './sections/UploadDocumentsSection';
import NotesRdvSection from './sections/NotesRdvSection';
import BenchmarksSection from './sections/BenchmarksSection';
import SourcesSection from './sections/SourcesSection';
import PreScreeningBaSection from './sections/PreScreeningBaSection';
import MemoBaSection, { MEMO_SECTION_CODES } from './sections/MemoBaSection';
import ValuationBaSection from './sections/ValuationBaSection';
import TeaserBaSection from './sections/TeaserBaSection';
import FundMatchingSection from './sections/FundMatchingSection';
import DealTrackingSection from './sections/DealTrackingSection';
import DataRoomBaSection from './sections/DataRoomBaSection';
import Mandat360Section from './sections/Mandat360Section';
import type { MandatDetailBundle, SectionCode, SidebarGroup, SectionStatus } from '@/types/ba-shell';

interface Props {
  bundle: MandatDetailBundle;
  role: string | null | undefined;
  organizationId: string;
  /** Brief P8 fix #4 — propagé au SubHeader pour rafraîchir les stats après dispatch génération. */
  onReload?: () => void;
}

const PARTNER_ROLES = ['managing_director', 'owner', 'admin', 'partner'];
const ANALYST_ROLES = ['analyst', 'analyste'];

/** Les 12 sections du Memo d'investissement BA — aligné PE (cf. PeDealSidebar.SECTIONS). */
const MEMO_SECTIONS = [
  { num: 1,  label: 'Résumé exécutif' },
  { num: 2,  label: 'Actionnariat & gouvernance' },
  { num: 3,  label: 'Top management' },
  { num: 4,  label: 'Services' },
  { num: 5,  label: 'Concurrence & marché' },
  { num: 6,  label: 'Units economics' },
  { num: 7,  label: 'États financiers PnL' },
  { num: 8,  label: 'États financiers Bilan' },
  { num: 9,  label: "Thèse d'investissement" },
  { num: 10, label: 'Accompagnement demandé' },
  { num: 11, label: 'ESG / Risques' },
  { num: 12, label: 'Annexes' },
];

function defaultSectionForRole(role: string | null | undefined, _stats: MandatDetailBundle['stats']): SectionCode {
  // Partner / MD / owner / admin atterrissent sur la Vue 360° (brief #32) — vue d'ensemble du mandat.
  if (role && ['owner', 'admin', 'managing_director', 'partner'].includes(role)) return 'overview';
  if (role === 'investment_manager') return 'memo' as SectionCode;
  if (ANALYST_ROLES.includes(role || '')) return 'upload_documents';
  return 'overview';
}

function buildSidebarGroups(bundle: MandatDetailBundle, role: string | null | undefined): SidebarGroup[] {
  const { stats } = bundle;
  const docsStatus: SectionStatus = stats.docs_received === 0
    ? 'not_started'
    : stats.docs_received >= stats.docs_expected ? 'validated' : 'draft';
  const docsCaption = `${stats.docs_received}/${stats.docs_expected} docs reçus`;

  const memoStatus: SectionStatus = stats.sections_validated === stats.sections_total && stats.sections_total > 0
    ? 'validated'
    : stats.sections_submitted > 0 ? 'submitted'
    : stats.sections_correction > 0 ? 'correction'
    : stats.sections_draft > 0 ? 'draft'
    : 'not_started';
  // Caption enrichi : ajoute "X à valider" si Partner+ a des sections submitted en attente (brief #34)
  const isPartner = role && ['owner', 'admin', 'managing_director', 'partner', 'investment_manager'].includes(role);
  const memoCaption = stats.sections_submitted > 0 && isPartner
    ? `${stats.sections_validated}/${MEMO_SECTIONS.length} validées · ${stats.sections_submitted} à valider`
    : `${stats.sections_validated}/${MEMO_SECTIONS.length} sections validées`;

  const groups: SidebarGroup[] = [
    {
      code: 'vue_360',
      label: 'Vue 360°',
      items: [
        { code: 'overview', label: "Vue d'ensemble", status: 'not_started' },
      ],
    },
    {
      code: 'donnees',
      label: 'Données',
      items: [
        { code: 'upload_documents', label: 'Upload documents',           status: docsStatus, caption: docsCaption },
        { code: 'info_analyste',    label: "Informations de l'analyste", status: 'not_started' },
        { code: 'benchmarks',       label: 'Benchmarks',                  status: 'not_started' },
        { code: 'sources',          label: 'Sources & références',        status: 'not_started' },
      ],
    },
    {
      code: 'pre_screening',
      label: 'Pré-screening',
      items: [
        { code: 'pre_screening', label: 'Pré-screening', status: stats.pre_screening_status },
      ],
    },
    {
      code: 'memo',
      label: 'Mémo investissement',
      items: [
        { code: 'memo', label: "Vue d'ensemble", status: memoStatus, caption: memoCaption },
        ...MEMO_SECTIONS.map(s => ({
          code: `memo:${s.num}` as SectionCode,
          label: `§${s.num} ${s.label}`,
          status: 'not_started' as SectionStatus,
        })),
      ],
    },
    {
      code: 'valuation',
      label: 'Valorisation',
      items: [
        { code: 'valuation', label: 'Valorisation', status: stats.valuation_status },
      ],
    },
    {
      code: 'teaser',
      label: 'Teaser',
      items: [
        { code: 'teaser', label: 'Teaser', status: stats.teaser_status },
      ],
    },
    {
      code: 'diffusion',
      label: 'Diffusion',
      visibleForRoles: PARTNER_ROLES,
      items: [
        {
          code: 'fund_matching',
          label: 'Investisseurs cibles',
          status: stats.funds_contacted > 0 ? 'draft' : 'not_started',
          caption: stats.funds_contacted > 0 ? `${stats.funds_contacted} contacts` : undefined,
        },
        { code: 'deal_tracking', label: 'Suivi diffusion', status: 'not_started' },
        { code: 'data_room',     label: 'Data Room',       status: 'not_started' },
      ],
    },
  ];

  return groups.filter(g => !g.visibleForRoles || g.visibleForRoles.includes(role || ''));
}

function renderSection(code: SectionCode, dealId: string, organizationId: string, onNavigate?: (s: SectionCode) => void): React.ReactNode {
  switch (code) {
    case 'overview':
      return <Mandat360Section dealId={dealId} onSelectItem={(s) => onNavigate?.(s as SectionCode)} />;
    case 'upload_documents':
      return <UploadDocumentsSection dealId={dealId} organizationId={organizationId} />;
    case 'info_analyste':
      // "Informations de l'analyste" dans le wireframe = page Notes (RDV/CR + IA extraction).
      // Le brief #8 info_analyste décrivait à tort un formulaire structuré séparé.
      return <NotesRdvSection dealId={dealId} />;
    case 'benchmarks':
      return <BenchmarksSection dealId={dealId} />;
    case 'sources':
      return <SourcesSection dealId={dealId} />;
    case 'pre_screening':
      return <PreScreeningBaSection dealId={dealId} />;
    case 'memo':
      return <MemoBaSection dealId={dealId} />;
    case 'valuation':
      return <ValuationBaSection dealId={dealId} />;
    case 'teaser':
      return <TeaserBaSection dealId={dealId} />;
    case 'fund_matching':
      return <FundMatchingSection dealId={dealId} />;
    case 'deal_tracking':
      return <DealTrackingSection dealId={dealId} />;
    case 'data_room':
      return <DataRoomBaSection dealId={dealId} />;
    default:
      // Sections du memo (memo:1, memo:2, ...) → PeSingleSectionView via wrapper
      if (typeof code === 'string' && code.startsWith('memo:')) {
        const num = parseInt(code.slice(5), 10);
        const sectionCode = MEMO_SECTION_CODES[num];
        if (!sectionCode) return null;
        return <MemoBaSection dealId={dealId} sectionCode={sectionCode} />;
      }
      return null;
  }
}

export default function MandatShell({ bundle, role, organizationId, onReload }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const groups = useMemo(() => buildSidebarGroups(bundle, role), [bundle, role]);

  const urlSection = searchParams.get('section') as SectionCode | null;
  const validCodes = useMemo(
    () => new Set(groups.flatMap(g => g.items.map(i => i.code))),
    [groups],
  );
  const active: SectionCode = urlSection && validCodes.has(urlSection)
    ? urlSection
    : defaultSectionForRole(role, bundle.stats);

  useEffect(() => {
    if (urlSection && !validCodes.has(urlSection)) {
      setSearchParams(prev => { prev.delete('section'); return prev; }, { replace: true });
    }
  }, [urlSection, validCodes, setSearchParams]);

  const handleSelect = (code: SectionCode) => {
    setSearchParams(prev => { prev.set('section', code); return prev; }, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      <MandatSubHeader mandat={bundle.mandat} stats={bundle.stats} organizationId={organizationId} onNavigate={handleSelect} onReload={onReload} />
      <div className="flex flex-1 overflow-hidden">
        <MandatSideNav
          groups={groups}
          active={active}
          onSelect={handleSelect}
          stats={bundle.stats}
        />
        <main className="flex-1 overflow-y-auto p-4">
          {renderSection(active, bundle.mandat.id, organizationId, handleSelect)}
        </main>
      </div>
    </div>
  );
}
