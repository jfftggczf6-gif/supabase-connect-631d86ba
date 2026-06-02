import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText } from 'lucide-react';

export type ConflictChoice = 'replace' | 'skip' | 'cancel';

interface DocumentConflictDialogProps {
  open: boolean;
  conflicts: string[];
  onChoice: (choice: ConflictChoice) => void;
}

export function DocumentConflictDialog({ open, conflicts, onChoice }: DocumentConflictDialogProps) {
  const isMulti = conflicts.length > 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onChoice('cancel'); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {isMulti ? `${conflicts.length} documents déjà présents` : 'Document déjà présent'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            {isMulti
              ? 'Les fichiers suivants existent déjà dans le dossier :'
              : 'Ce fichier existe déjà dans le dossier :'}
          </p>

          <ul className="max-h-40 overflow-y-auto space-y-1 rounded-md border bg-muted/30 p-2">
            {conflicts.map((name) => (
              <li key={name} className="flex items-center gap-2 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-none" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>

          <div className="text-xs text-muted-foreground space-y-1 leading-relaxed">
            <p><b className="text-foreground">Remplacer</b> : écrase les anciens fichiers et leur analyse par les nouveaux.</p>
            <p><b className="text-foreground">Ignorer</b> : conserve les anciens, n'upload que les nouveaux fichiers.</p>
            <p><b className="text-foreground">Annuler</b> : ne fait rien.</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onChoice('cancel')}>Annuler</Button>
          <Button variant="secondary" onClick={() => onChoice('skip')}>Ignorer</Button>
          <Button onClick={() => onChoice('replace')}>Remplacer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
