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
            {newDocsCount} nouveau{newDocsCount > 1 ? 'x' : ''} document{newDocsCount > 1 ? 's' : ''} ajouté{newDocsCount > 1 ? 's' : ''}.
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
