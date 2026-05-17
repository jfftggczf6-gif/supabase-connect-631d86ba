// src/components/ba/MandatSideNav.stories.tsx
// Stories sidebar MandatShell : différentes combinaisons rôles/statuts.

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import MandatSideNav, { StatusLegend } from './MandatSideNav';
import type { SectionCode, SidebarGroup } from '@/types/ba-shell';

const FULL_GROUPS_PARTNER: SidebarGroup[] = [
  {
    code: 'donnees',
    label: 'Données',
    items: [
      { code: 'upload_documents', label: 'Documents', status: 'draft', caption: '4/7 docs reçus' },
      { code: 'info_analyste',    label: 'Info entreprise', status: 'draft' },
      { code: 'benchmarks',       label: 'Benchmarks sectoriels', status: 'validated' },
      { code: 'sources',          label: 'Sources & références', status: 'not_started' },
    ],
  },
  {
    code: 'pre_screening',
    label: 'Pré-screening',
    items: [{ code: 'pre_screening', label: 'Pre-screening 360°', status: 'submitted' }],
  },
  {
    code: 'memo',
    label: 'Mémo investissement',
    items: [{ code: 'memo', label: '12 sections IM', status: 'correction', caption: '5/12 sections validées' }],
  },
  {
    code: 'valuation',
    label: 'Valorisation',
    items: [{ code: 'valuation', label: 'DCF + multiples + ANCC', status: 'draft' }],
  },
  {
    code: 'teaser',
    label: 'Teaser',
    items: [{ code: 'teaser', label: 'One-pager anonymisé', status: 'not_started' }],
  },
  {
    code: 'diffusion',
    label: 'Diffusion',
    items: [
      { code: 'fund_matching', label: 'Fonds & matching', status: 'draft', caption: '3 fonds contactés' },
      { code: 'deal_tracking', label: 'Suivi diffusion', status: 'not_started' },
    ],
  },
];

// Analyste = pas de Diffusion
const ANALYST_GROUPS = FULL_GROUPS_PARTNER.filter(g => g.code !== 'diffusion');

const meta: Meta<typeof MandatSideNav> = {
  title: 'BA / MandatSideNav',
  component: MandatSideNav,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="h-[600px] flex bg-background">
          <Story />
          <div className="flex-1 p-4 text-xs text-muted-foreground">
            ← Zone contenu (rendue par MandatShell)
          </div>
        </div>
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

function Interactive({ groups }: { groups: SidebarGroup[] }) {
  const [active, setActive] = useState<SectionCode>('memo');
  return <MandatSideNav groups={groups} active={active} onSelect={setActive} />;
}

export const Partner: Story = {
  render: () => <Interactive groups={FULL_GROUPS_PARTNER} />,
  name: 'Partner (6 groupes inclus Diffusion)',
};

export const Analyste: Story = {
  render: () => <Interactive groups={ANALYST_GROUPS} />,
  name: 'Analyste (5 groupes — pas de Diffusion)',
};

export const TousStatuts: Story = {
  render: () => <Interactive groups={[
    {
      code: 'donnees',
      label: 'Tous statuts (démo)',
      items: [
        { code: 'upload_documents', label: 'not_started', status: 'not_started' },
        { code: 'info_analyste',    label: 'empty',       status: 'empty' },
        { code: 'benchmarks',       label: 'draft',       status: 'draft' },
        { code: 'pre_screening',    label: 'submitted',   status: 'submitted' },
        { code: 'sources',          label: 'correction',  status: 'correction' },
        { code: 'memo',             label: 'validated',   status: 'validated' },
      ],
    },
  ]} />,
  name: 'Tous les statuts (palette)',
};

export const VueAvecLegende: Story = {
  render: () => (
    <div className="flex flex-col">
      <Interactive groups={FULL_GROUPS_PARTNER} />
      <StatusLegend />
    </div>
  ),
  name: 'Avec légende statuts',
};
