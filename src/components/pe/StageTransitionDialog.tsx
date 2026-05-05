import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, Check, X, Plus, Trash2 } from 'lucide-react';

export interface IcDecisionPayload {
  ic_type: 'ic1' | 'ic_finale';
  decision: 'go' | 'go_conditional' | 'no_go';
  conditions: string[];
  motif?: string;
  notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStage: string;
  toStage: string;
  dealRef: string;
  onConfirm: (extras: { lostReason?: string; icDecision?: IcDecisionPayload }) => Promise<void>;
}

const STAGE_LABELS: Record<string, string> = {
  sourcing: 'Sourcing', pre_screening: 'Pre-screening',
  note_ic1: 'Note IC1', dd: 'Due Diligence', note_ic_finale: 'Note IC finale',
  closing: 'Closing', portfolio: 'Portfolio', lost: 'Perdu',
  analyse: 'Analyse', ic1: 'Note IC1', ic_finale: 'Note IC finale',
};

/** Renvoie le type d'IC à formaliser pour cette transition (ou null). */
function detectIcType(fromStage: string, toStage: string): 'ic1' | 'ic_finale' | null {
  // note_ic1 → dd : décision IC1 (Go DD ou No-go)
  if (fromStage === 'note_ic1' && toStage === 'dd') return 'ic1';
  // note_ic_finale → closing : décision IC finale (Go investir ou No-go)
  if (fromStage === 'note_ic_finale' && toStage === 'closing') return 'ic_finale';
  return null;
}

export default function StageTransitionDialog({ open, onOpenChange, fromStage, toStage, dealRef, onConfirm }: Props) {
  const [lostReason, setLostReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isLost = toStage === 'lost';
  const icType = detectIcType(fromStage, toStage);
  const requiresIcDecision = icType !== null;

  // État formulaire IC
  const [decision, setDecision] = useState<'go' | 'go_conditional' | 'no_go'>('go');
  const [conditions, setConditions] = useState<string[]>(['']);
  const [icMotif, setIcMotif] = useState('');
  const [icNotes, setIcNotes] = useState('');

  // Reset à chaque ouverture
  useEffect(() => {
    if (open) {
      setLostReason('');
      setDecision('go');
      setConditions(['']);
      setIcMotif('');
      setIcNotes('');
    }
  }, [open]);

  const handle = async () => {
    if (isLost && !lostReason.trim()) return;
    if (requiresIcDecision) {
      // Validation IC
      if (decision === 'no_go' && !icMotif.trim()) return;
      if (decision === 'go_conditional' && conditions.filter(c => c.trim()).length === 0) return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        lostReason: isLost ? lostReason.trim() : undefined,
        icDecision: requiresIcDecision && icType
          ? {
              ic_type: icType,
              decision,
              conditions: conditions.map(c => c.trim()).filter(Boolean),
              motif: decision === 'no_go' ? icMotif.trim() : undefined,
              notes: icNotes.trim() || undefined,
            }
          : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateCondition = (i: number, val: string) => {
    setConditions(c => c.map((v, idx) => idx === i ? val : v));
  };
  const addCondition = () => setConditions(c => [...c, '']);
  const removeCondition = (i: number) => setConditions(c => c.length > 1 ? c.filter((_, idx) => idx !== i) : c);

  const canConfirm =
    !submitting &&
    !(isLost && !lostReason.trim()) &&
    !(requiresIcDecision && decision === 'no_go' && !icMotif.trim()) &&
    !(requiresIcDecision && decision === 'go_conditional' && conditions.filter(c => c.trim()).length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLost && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {requiresIcDecision
              ? `Décision Comité ${icType === 'ic1' ? 'IC1' : 'IC finale'}`
              : 'Confirmer la transition'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
          <p className="text-sm">
            Deal <span className="font-mono">{dealRef}</span>
            <br />
            <span className="text-muted-foreground">{STAGE_LABELS[fromStage]}</span>
            {' → '}
            <span className="font-medium">{STAGE_LABELS[toStage]}</span>
          </p>

          {/* === IC Decision form === */}
          {requiresIcDecision && (
            <div className="space-y-3 border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Verdict du comité
                </Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant={decision === 'go' ? 'default' : 'outline'}
                    onClick={() => setDecision('go')}
                    className="gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" /> Go
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={decision === 'go_conditional' ? 'default' : 'outline'}
                    onClick={() => setDecision('go_conditional')}
                    className="gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" /> Go sous conditions
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={decision === 'no_go' ? 'destructive' : 'outline'}
                    onClick={() => setDecision('no_go')}
                    className="gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" /> No-go
                  </Button>
                </div>
              </div>

              {/* Conditions (si go_conditional) */}
              {decision === 'go_conditional' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Conditions à respecter *</Label>
                  {conditions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={c}
                        onChange={e => updateCondition(i, e.target.value)}
                        placeholder="Ex: recrutement DAF dans 6 mois, formalisation CA…"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(i)}
                        disabled={conditions.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={addCondition}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter une condition
                  </Button>
                </div>
              )}

              {/* Motif (si no_go) */}
              {decision === 'no_go' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Motif du rejet *</Label>
                  <Textarea
                    rows={3}
                    value={icMotif}
                    onChange={e => setIcMotif(e.target.value)}
                    placeholder="Ex: valorisation trop élevée, gouvernance insuffisante, marché non porteur…"
                  />
                </div>
              )}

              {/* Notes (optionnel) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Notes (optionnel)</Label>
                <Textarea
                  rows={2}
                  value={icNotes}
                  onChange={e => setIcNotes(e.target.value)}
                  placeholder="Notes internes sur la séance, points soulevés…"
                />
              </div>
            </div>
          )}

          {/* === Lost reason form === */}
          {isLost && (
            <div className="space-y-1.5">
              <Label>Raison du rejet *</Label>
              <Textarea
                rows={3}
                value={lostReason}
                onChange={e => setLostReason(e.target.value)}
                placeholder="Hors thèse, problème de gouvernance, etc."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button
            onClick={handle}
            disabled={!canConfirm}
            variant={isLost || decision === 'no_go' ? 'destructive' : 'default'}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {requiresIcDecision && decision === 'no_go' ? 'Confirmer le rejet' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
