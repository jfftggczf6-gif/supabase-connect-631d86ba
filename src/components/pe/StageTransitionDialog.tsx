import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStage: string;
  toStage: string;
  dealRef: string;
  onConfirm: (lostReason?: string) => Promise<void>;
}

const STAGE_LABELS: Record<string, string> = {
  sourcing: 'Sourcing', pre_screening: 'Pre-screening', analyse: 'Analyse',
  ic1: 'IC1', dd: 'Due Diligence', ic_finale: 'IC finale',
  closing: 'Closing', portfolio: 'Portfolio', lost: 'Perdu',
};

export default function StageTransitionDialog({ open, onOpenChange, fromStage, toStage, dealRef, onConfirm }: Props) {
  const [lostReason, setLostReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isLost = toStage === 'lost';

  const handle = async () => {
    if (isLost && !lostReason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(isLost ? lostReason.trim() : undefined);
      setLostReason('');
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLost && <AlertTriangle className="h-4 w-4 text-red-500" />}
            Confirmer la transition
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            Deal <span className="font-mono">{dealRef}</span>
            <br />
            <span className="text-muted-foreground">{STAGE_LABELS[fromStage]}</span>
            {' → '}
            <span className="font-medium">{STAGE_LABELS[toStage]}</span>
          </p>
          {isLost && (
            <div className="space-y-1.5">
              <Label>Raison du rejet *</Label>
              <Textarea rows={3} value={lostReason} onChange={e => setLostReason(e.target.value)}
                placeholder="Hors thèse, problème de gouvernance, etc." />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handle} disabled={submitting || (isLost && !lostReason.trim())}
            variant={isLost ? 'destructive' : 'default'}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
