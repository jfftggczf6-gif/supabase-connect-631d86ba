// src/components/ba/CreateAppelDialog.stories.tsx
// Stories pour le dialog de création d'appel BA.
// On ne teste pas la soumission réelle (supabase client mocké via no-op),
// juste le rendu visuel des 3 états : fermé, ouvert vide, ouvert pré-rempli.

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import CreateAppelDialog from './CreateAppelDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const meta: Meta<typeof CreateAppelDialog> = {
  title: 'BA / CreateAppelDialog',
  component: CreateAppelDialog,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-4">
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Nouvel appel
      </Button>
      <CreateAppelDialog
        open={open}
        onOpenChange={setOpen}
        organizationId="org-cisse-storybook"
        onCreated={(id) => alert(`Appel créé (mock) : ${id}`)}
      />
    </div>
  );
}

export const Ferme: Story = {
  render: () => <InteractiveDialog defaultOpen={false} />,
  name: 'Fermé (bouton trigger)',
};

export const OuvertVide: Story = {
  render: () => <InteractiveDialog defaultOpen={true} />,
  name: 'Ouvert (vide — Créer désactivé)',
};
