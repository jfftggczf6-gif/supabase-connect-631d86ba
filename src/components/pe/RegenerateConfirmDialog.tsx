import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newDocsCount: number;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function RegenerateConfirmDialog({ open, onOpenChange, newDocsCount, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Régénérer le pré-screening ?</DialogTitle>
          <DialogDescription>
            {newDocsCount} nouvelle{newDocsCount > 1 ? 's' : ''} pièce{newDocsCount > 1 ? 's' : ''} ajoutée{newDocsCount > 1 ? 's' : ''} à la Data Room.
            Veux-tu régénérer le pré-screening en intégrant ce contenu ? Une nouvelle version sera créée et l'actuelle restera accessible dans l'onglet Historique.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onCancel?.(); onOpenChange(false); }}>Garder l'actuel</Button>
          <Button onClick={() => { onConfirm(); onOpenChange(false); }}>Régénérer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
