// src/components/ba/EligibilityBadge.stories.tsx
// Stories Storybook pour EligibilityBadge — 3 variantes V/O/R + 2 sizes.
import type { Meta, StoryObj } from '@storybook/react-vite';
import EligibilityBadge from './EligibilityBadge';

const meta: Meta<typeof EligibilityBadge> = {
  title: 'BA / EligibilityBadge',
  component: EligibilityBadge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    level: {
      control: 'radio',
      options: ['green', 'orange', 'red'],
      description: 'Niveau d\'éligibilité calculé par computeEligibility()',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md'],
      description: 'sm = table row · md = modale détail',
    },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Eligible: Story = {
  args: { level: 'green', size: 'sm' },
};

export const Partiel: Story = {
  args: { level: 'orange', size: 'sm' },
};

export const HorsThese: Story = {
  args: { level: 'red', size: 'sm' },
  name: 'Hors thèse',
};

export const ModaleSize: Story = {
  args: { level: 'green', size: 'md' },
  name: 'Modale (size=md)',
};

export const TousNiveaux: Story = {
  name: 'Comparaison 3 niveaux',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <EligibilityBadge level="green" />
      <EligibilityBadge level="orange" />
      <EligibilityBadge level="red" />
    </div>
  ),
};
