// MandatManageDialog — modal "Gérer le mandat" : infos read-only + actions
// rapides (voir pipeline, marquer perdu/close).
// Briefé P7 AUDIT 19/05 — implémente le bouton qui ne faisait rien.

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ExternalLink, XCircle, CheckCircle2 } from 'lucide-react';
import type { Mandat } from '@/types/ba';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mandat: Mandat;
  onUpdated?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  recus: 'Reçus', im: 'IM produit', interets: 'Intérêts fonds',
  nego: 'Négociation', close: 'Closé', lost: 'Perdu',
};

export default function MandatManageDialog({ open, onOpenChange, mandat, onUpdated }: Props) {
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);

  const updateStage = async (newStage: 'lost' | 'close') => {
    const labels = { lost: 'perdu', close: 'closé' };
    if (!confirm(`Marquer ce mandat comme ${labels[newStage]} ? Action réversible via le pipeline.`)) return;
    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke('update-pe-deal-stage', {
        body: { deal_id: mandat.id, new_stage: newStage },
      });
      if (error) throw new Error(error.message);
      toast.success(`Mandat marqué ${labels[newStage]}`);
      onOpenChange(false);
      onUpdated?.();
    } catch (e: any) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer le mandat</DialogTitle>
          <DialogDescription>
            Informations et actions rapides sur ce mandat. Pour les détails complets, voir le pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b py-1.5">
            <span className="text-muted-foreground">Société</span>
            <span className="font-medium">{mandat.enterprise_name || '—'}</span>
          </div>
          <div className="flex justify-between border-b py-1.5">
            <span className="text-muted-foreground">Référence</span>
            <span className="font-mono text-xs">{mandat.deal_ref}</span>
          </div>
          <div className="flex justify-between border-b py-1.5">
            <span className="text-muted-foreground">Stage</span>
            <Badge variant="outline">{STAGE_LABELS[mandat.stage] || mandat.stage}</Badge>
          </div>
          {mandat.sector && (
            <div className="flex justify-between border-b py-1.5">
              <span className="text-muted-foreground">Secteur</span>
              <span>{mandat.sector}</span>
            </div>
          )}
          {mandat.country && (
            <div className="flex justify-between border-b py-1.5">
              <span className="text-muted-foreground">Pays</span>
              <span>{mandat.country}</span>
            </div>
          )}
          {mandat.ticket_demande && (
            <div className="flex justify-between border-b py-1.5">
              <span className="text-muted-foreground">Ticket</span>
              <span className="font-medium">{(mandat.ticket_demande / 1_000_000).toFixed(1)} M {mandat.currency || 'USD'}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-col gap-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => { onOpenChange(false); navigate('/ba?tab=mandats'); }}
          >
            <ExternalLink className="h-4 w-4" /> Voir dans le pipeline
          </Button>
          {mandat.stage !== 'close' && mandat.stage !== 'lost' && (
            <>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={updating}
                onClick={() => updateStage('close')}
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                Marquer comme closé
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={updating}
                onClick={() => updateStage('lost')}
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 text-rose-600" />}
                Marquer comme perdu
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
