// src/components/ba/MandatShell.tsx
// Conteneur principal du workspace mandat BA.
// Brief mandat_detail_layout : SubHeader + Sidebar 6 groupes + zone contenu.
// Routing interne par query param ?section=<code>.

import { useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MandatSubHeader from './MandatSubHeader';
import MandatSideNav from './MandatSideNav';
import PlaceholderSection from './sections/PlaceholderSection';
import UploadDocumentsSection from './sections/UploadDocumentsSection';
import InfoAnalysteSection from './sections/InfoAnalysteSection';
import NotesRdvSection from './sections/NotesRdvSection';
import type { MandatDetailBundle, SectionCode, SidebarGroup, SectionStatus } from '@/types/ba-shell';

interface Props {
  bundle: MandatDetailBundle;
  /** Rôle utilisateur pour filtrage Diffusion. */
  role: string | null | undefined;
  /** Organization courante (sert aux sections enfants qui font des inserts). */
  organizationId: string;
}

const PARTNER_ROLES = ['managing_director', 'owner', 'admin', 'partner'];
const ANALYST_ROLES = ['analyst', 'analyste'];

/** Section par défaut selon le rôle (brief #9, #10).
 *  - Senior : première section 'submitted' du memo (review en attente)
 *  - Analyste : première section 'correction' OU le memo
 *  - Partner : overview (= upload_documents, première data) */
function defaultSectionForRole(role: string | null | undefined, stats: MandatDetailBundle['stats']): SectionCode {
  if (role === 'investment_manager') {
    return stats.sections_submitted > 0 ? 'memo' : 'upload_documents';
  }
  if (ANALYST_ROLES.includes(role || '')) {
    return stats.sections_correction > 0 ? 'memo' : 'memo';
  }
  return 'upload_documents';
}

/** Construit la structure sidebar à partir des stats du mandat. */
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
  const memoCaption = `${stats.sections_validated}/${stats.sections_total} sections validées`;

  const groups: SidebarGroup[] = [
    {
      code: 'donnees',
      label: 'Données',
      items: [
        { code: 'upload_documents', label: 'Documents', status: docsStatus, caption: docsCaption },
        { code: 'info_analyste',    label: 'Info entreprise', status: 'not_started' },
        { code: 'benchmarks',       label: 'Benchmarks sectoriels', status: 'not_started' },
        { code: 'sources',          label: 'Sources & références', status: 'not_started' },
      ],
    },
    {
      code: 'suivi',
      label: 'Suivi mandat',
      items: [
        { code: 'notes', label: 'Notes & RDV', status: 'not_started' },
      ],
    },
    {
      code: 'pre_screening',
      label: 'Pré-screening',
      items: [
        { code: 'pre_screening', label: 'Pre-screening 360°', status: stats.pre_screening_status },
      ],
    },
    {
      code: 'memo',
      label: 'Mémo investissement',
      items: [
        { code: 'memo', label: '12 sections IM', status: memoStatus, caption: memoCaption },
      ],
    },
    {
      code: 'valuation',
      label: 'Valorisation',
      items: [
        { code: 'valuation', label: 'DCF + multiples + ANCC', status: stats.valuation_status },
      ],
    },
    {
      code: 'teaser',
      label: 'Teaser',
      items: [
        { code: 'teaser', label: 'One-pager anonymisé', status: stats.teaser_status },
      ],
    },
    {
      code: 'diffusion',
      label: 'Diffusion',
      visibleForRoles: PARTNER_ROLES,
      items: [
        {
          code: 'fund_matching',
          label: 'Fonds & matching',
          status: stats.funds_contacted > 0 ? 'draft' : 'not_started',
          caption: stats.funds_contacted > 0 ? `${stats.funds_contacted} fonds contactés` : undefined,
        },
        { code: 'deal_tracking', label: 'Suivi diffusion', status: 'not_started' },
      ],
    },
  ];

  // Filtrer les groupes restrictifs (brief #8 : Diffusion visible Partner uniquement)
  return groups.filter(g => !g.visibleForRoles || g.visibleForRoles.includes(role || ''));
}

/** Map section → composant rendu. */
function renderSection(code: SectionCode, dealId: string, organizationId: string): React.ReactNode {
  switch (code) {
    case 'upload_documents':
      return <UploadDocumentsSection dealId={dealId} organizationId={organizationId} />;
    case 'info_analyste':
      return <InfoAnalysteSection dealId={dealId} />;
    case 'notes':
      return <NotesRdvSection dealId={dealId} />;
    case 'benchmarks':
      return <PlaceholderSection
        featureName="benchmarks_sectoriels"
        title="Benchmarks sectoriels UEMOA"
        description="Positionnement automatique du deal vs médiane sectorielle : marge brute, marge EBITDA, BFR/CA, croissance, dette/EBITDA. Données IFC, BCEAO, FMI."
      />;
    case 'sources':
      return <PlaceholderSection
        featureName="sources_references"
        title="Sources & références"
        description="Vue lecture seule de toutes les sources mobilisées pour ce mandat : documents fournis, sources externes citées dans l'IM, entretiens réalisés."
      />;
    case 'pre_screening':
      return <PlaceholderSection
        featureName="pre_screening_ba"
        title="Pre-screening 360°"
        description="Génération IA en 30-60s : 11 blocs (activité, actionnariat, KPIs, scénarios BEAR/BASE/BULL, red flags SYSCOHADA, recommandation GO/CONDITIONNEL/NO-GO)."
      />;
    case 'memo':
      return <PlaceholderSection
        featureName="generate_im_vendeur + living_document"
        title="Mémo investissement vendeur"
        description="12 sections IM en ton vendeur, workflow draft → submitted → correction → validated. Génération IA, regénération section par section, snapshots versionnés, export PDF / DOCX / PPTX."
      />;
    case 'valuation':
      return <PlaceholderSection
        featureName="valuation_ba"
        title="Valorisation"
        description="DCF 7 ans + multiples comparables sectoriels + ANCC. Sensitivity matrix 5x5 (WACC × croissance terminale). Fourchette de prix BEAR / BASE / BULL. Export PDF + XLSX."
      />;
    case 'teaser':
      return <PlaceholderSection
        featureName="generate_teaser"
        title="Teaser anonymisé"
        description="One-pager généré depuis l'IM. Nom de code automatique. Détection IA des mentions identifiantes (warnings). Workflow Analyste → Partner approuve → diffusable."
      />;
    case 'fund_matching':
      return <PlaceholderSection
        featureName="fund_matching"
        title="Fonds & matching"
        description="Matching anonyme deal ↔ fonds. Score d'adéquation, statuts par fonds (non_contacté → teaser_envoyé → intéressé → NDA → IM_partagé → IOI), relances auto."
      />;
    case 'deal_tracking':
      return <PlaceholderSection
        featureName="deal_tracking_ba"
        title="Suivi diffusion"
        description="Timeline par fonds : teaser → NDA → IM → Management meeting → IOI → LOI → Close. Levée d'anonymat. Handoff BA → PE (cross-organization)."
      />;
    default:
      return null;
  }
}

export default function MandatShell({ bundle, role, organizationId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const groups = useMemo(() => buildSidebarGroups(bundle, role), [bundle, role]);

  // Section active : query param ?section= · fallback intelligent par rôle.
  const urlSection = searchParams.get('section') as SectionCode | null;
  const validCodes = useMemo(
    () => new Set(groups.flatMap(g => g.items.map(i => i.code))),
    [groups],
  );
  const active: SectionCode = urlSection && validCodes.has(urlSection)
    ? urlSection
    : defaultSectionForRole(role, bundle.stats);

  // Si l'URL référence une section invalide pour ce rôle, nettoyer.
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
      <MandatSubHeader mandat={bundle.mandat} />
      <div className="flex flex-1 overflow-hidden">
        <MandatSideNav
          groups={groups}
          active={active}
          onSelect={handleSelect}
        />
        <main className="flex-1 overflow-y-auto p-4">
          {renderSection(active, bundle.mandat.id, organizationId)}
        </main>
      </div>
    </div>
  );
}
