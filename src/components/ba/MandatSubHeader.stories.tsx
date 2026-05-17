// src/components/ba/MandatSubHeader.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import MandatSubHeader from './MandatSubHeader';
import type { Mandat } from '@/types/ba';

const baseMandat: Mandat = {
  id: 'deal-001',
  deal_ref: 'MCA-001',
  enterprise_id: 'ent-001',
  enterprise_name: 'PharmaCi SARL',
  sector: 'Santé',
  country: "Côte d'Ivoire",
  stage: 'recus',
  ticket_demande: 8_500_000,
  currency: 'USD',
  lead_analyst_id: null,
  lead_im_id: null,
  score_360: null,
};

const meta: Meta<typeof MandatSubHeader> = {
  title: 'BA / MandatSubHeader',
  component: MandatSubHeader,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="bg-background">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Recus: Story = { args: { mandat: baseMandat } };
export const IM: Story = { args: { mandat: { ...baseMandat, stage: 'im', enterprise_name: 'AgroTech Sénégal' } }, name: 'Stage IM' };
export const Interets: Story = { args: { mandat: { ...baseMandat, stage: 'interets', enterprise_name: 'Solar CI', sector: 'Énergie', ticket_demande: 12_000_000 } }, name: 'Stage Intérêts' };
export const Nego: Story = { args: { mandat: { ...baseMandat, stage: 'nego', enterprise_name: 'Fintech Mali', sector: 'Fintech', country: 'Mali', ticket_demande: 4_500_000 } }, name: 'Stage Négo' };
export const Close: Story = { args: { mandat: { ...baseMandat, stage: 'close', enterprise_name: 'Industrie BJ', sector: 'Industrie', country: 'Bénin' } }, name: 'Stage Close' };

export const SansEnterpriseName: Story = {
  args: { mandat: { ...baseMandat, enterprise_name: null, deal_ref: 'MCA-042', sector: null, country: null, ticket_demande: null } },
  name: 'Fallback (sans nom/secteur/pays/ticket)',
};

export const NomTresLong: Story = {
  args: { mandat: { ...baseMandat, enterprise_name: 'Société Anonyme à Conseil d\'Administration des Industries Pharmaceutiques de la Région UEMOA', ticket_demande: 25_000_000 } },
  name: 'Nom très long (test truncate)',
};
