import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onAdded: () => void;
}

const CATEGORIES = [
  ['financier', 'Financier'],
  ['juridique', 'Juridique'],
  ['fiscal', 'Fiscal'],
  ['commercial', 'Commercial'],
  ['operationnel', 'Opérationnel'],
  ['rh', 'RH'],
  ['esg', 'ESG'],
  ['it', 'IT'],
] as const;

const FINDING_TYPES = [
  ['informative', 'Informatif'],
  ['confirmation', 'Confirmation'],
  ['adjustment', 'Ajustement'],
  ['red_flag', 'Red flag'],
] as const;

const SEVERITIES = [
  ['Low', 'Low'],
  ['Medium', 'Medium'],
  ['High', 'High'],
  ['Critical', 'Critical'],
] as const;

export default function AddInternalFindingDialog({ open, onOpenChange, dealId, onAdded }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [category, setCategory] = useState<string>('financier');
  const [findingType, setFindingType] = useState<string>('informative');
  const [severity, setSeverity] = useState<string>('Medium');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle(''); setBody(''); setRecommendation('');
    setCategory('financier'); setFindingType('informative'); setSeverity('Medium');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Titre et description requis');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('pe_dd_findings').insert({
      deal_id: dealId,
      category,
      finding_type: findingType,
      severity,
      title: title.trim(),
      body: body.trim(),
      recommendation: recommendation.trim() || null,
      source: 'manual',
      source_type: 'internal_analysis',
      status: 'open',
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success('Finding interne ajouté');
    reset();
    onOpenChange(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Finding DD interne
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            Mode amorçage : tu fais la DD toi-même, sans rapport cabinet externe. Ce finding sera marqué "Interne".
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={findingType} onValueChange={setFindingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINDING_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sévérité</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Titre *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="EBITDA retraité de 320 à 295M FCFA" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description *</Label>
            <Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Détail du finding, chiffres, observations…" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Recommandation (optionnel)</Label>
            <Textarea rows={2} value={recommendation} onChange={e => setRecommendation(e.target.value)} placeholder="Action recommandée pour le memo IC finale…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !body.trim()}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ajouter le finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
