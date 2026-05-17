// src/components/ba/AppelSelector.stories.tsx
// Stories pour le sélecteur d'appels BA — 0/1/3/15 appels (test scalabilité).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import AppelSelector from './AppelSelector';
import type { BaProgramme } from '@/types/candidature-ba';

const makeProgramme = (overrides: Partial<BaProgramme> = {}): BaProgramme => ({
  id: 'p-' + Math.random().toString(36).slice(2, 8),
  organization_id: 'org-cisse',
  name: 'Appel sans nom',
  description: null,
  form_slug: 'slug-' + Math.random().toString(36).slice(2, 8),
  form_fields: [],
  start_date: '2026-05-01',
  end_date: '2026-08-31',
  status: 'in_progress',
  type: 'banque_affaires',
  country_filter: [],
  sector_filter: [],
  created_at: '2026-04-15T10:00:00Z',
  ...overrides,
});

const meta: Meta<typeof AppelSelector> = {
  title: 'BA / AppelSelector',
  component: AppelSelector,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper avec state pour interaction réelle
function InteractiveSelector({ programmes, counts }: { programmes: BaProgramme[]; counts?: Record<string, number> }) {
  const [selectedId, setSelectedId] = useState<string | null>(programmes[0]?.id ?? null);
  return (
    <div className="w-[480px]">
      <AppelSelector
        programmes={programmes}
        selectedId={selectedId}
        onSelect={setSelectedId}
        candidatureCounts={counts}
      />
      <div className="mt-3 text-[11px] text-muted-foreground">
        Sélectionné : <code>{selectedId ?? '(aucun)'}</code>
      </div>
    </div>
  );
}

export const Vide: Story = {
  render: () => <InteractiveSelector programmes={[]} />,
  name: '0 appel (caché)',
};

export const UnSeulAppel: Story = {
  render: () => (
    <InteractiveSelector
      programmes={[makeProgramme({ name: 'Levée Tech UEMOA 2026', status: 'in_progress' })]}
      counts={{ ['p-' + 'aaa']: 5 }}
    />
  ),
  name: '1 appel actif',
};

export const TroisAppelsStatutsMixtes: Story = {
  render: () => {
    const programmes = [
      makeProgramme({ id: 'p1', name: 'Levée Tech UEMOA 2026', status: 'in_progress' }),
      makeProgramme({ id: 'p2', name: 'Restructuration Agro Sénégal', status: 'closed' }),
      makeProgramme({ id: 'p3', name: 'M&A Pharma Côte d\'Ivoire', status: 'completed' }),
    ];
    const counts = { p1: 27, p2: 12, p3: 8 };
    return <InteractiveSelector programmes={programmes} counts={counts} />;
  },
  name: '3 appels statuts mixtes',
};

export const QuinzeAppels: Story = {
  render: () => {
    const programmes = Array.from({ length: 15 }, (_, i) => makeProgramme({
      id: 'p' + i,
      name: `Appel #${i + 1} — ${['Tech', 'Agro', 'Pharma', 'Énergie', 'Fintech'][i % 5]} ${2024 + (i % 3)}`,
      status: i % 4 === 0 ? 'closed' : 'in_progress',
    }));
    const counts: Record<string, number> = {};
    programmes.forEach((p, i) => { counts[p.id] = Math.floor(Math.random() * 50) + 1; });
    return <InteractiveSelector programmes={programmes} counts={counts} />;
  },
  name: '15 appels (test scroll)',
};

export const NomTresLong: Story = {
  render: () => (
    <InteractiveSelector
      programmes={[
        makeProgramme({
          id: 'long',
          name: 'Appel à candidatures grandes PME industrielles UEMOA en restructuration financière 2026 H2',
          status: 'in_progress',
        }),
      ]}
      counts={{ long: 3 }}
    />
  ),
  name: 'Nom très long (test truncate)',
};
