import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wand2, FolderOpen, Loader2 } from 'lucide-react';

interface ModeSelectionModalProps {
  enterpriseId: string;
  open: boolean;
  onModeSelected: () => void;
}

const MODES = [
  {
    id: 'reconstruction' as const,
    label: 'Reconstruction',
    description: "Uploadez tout ce que vous avez — l'IA reconstitue vos données financières",
    detail: 'Relevés bancaires, factures, photos de documents, tableurs partiels…',
    icon: Wand2,
    color: 'border-primary/50 hover:border-primary hover:bg-primary/5',
  },
  {
    id: 'due_diligence' as const,
    label: 'Due Diligence',
    description: 'Vous avez des documents structurés — créez votre dossier investisseur',
    detail: 'Bilans certifiés, comptes de résultat, business plan existant…',
    icon: FolderOpen,
    color: 'border-accent/50 hover:border-accent hover:bg-accent/5',
  },
];

export default function ModeSelectionModal({ enterpriseId, open, onModeSelected }: ModeSelectionModalProps) {
  const [selected, setSelected] = useState<'reconstruction' | 'due_diligence' | null>(null);
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = { operating_mode: selected };
      if (selected === 'due_diligence') {
        updates.data_room_enabled = true;
        updates.data_room_slug = crypto.randomUUID().substring(0, 12);
      }
      const { error } = await supabase
        .from('enterprises')
        .update(updates)
        .eq('id', enterpriseId);
      if (error) throw error;
      toast.success(selected === 'reconstruction' ? 'Mode Reconstruction activé !' : 'Mode Due Diligence activé !');
      onModeSelected();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Comment souhaitez-vous procéder ?</DialogTitle>
          <DialogDescription>
            Choisissez le mode qui correspond le mieux à votre situation documentaire.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selected === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setSelected(mode.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${mode.color} ${
                  isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{mode.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{mode.description}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{mode.detail}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          onClick={handleStart}
          disabled={!selected || saving}
          className="w-full mt-4"
          size="lg"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Démarrer
        </Button>
      </DialogContent>
    </Dialog>
  );
}
