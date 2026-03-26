import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PenLine, Check, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { propagateCorrection, type PropagationResult } from '@/lib/field-propagation';

interface Props {
  enterpriseId: string;
  deliverableId: string;
  deliverableType: string;
  fieldPath: string;
  currentValue: any;
  onSaved?: (newValue: any) => void;
  onStaleTextsFound?: (staleTexts: PropagationResult['staleTexts']) => void;
}

export default function DeliverableEditor({
  enterpriseId, deliverableId, deliverableType, fieldPath, currentValue, onSaved, onStaleTextsFound,
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentValue ?? ''));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error('Raison de la correction obligatoire');
      return;
    }

    setSaving(true);

    // Parse value
    let parsed: any = value;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') parsed = num;

    // Save correction record
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('deliverable_corrections').insert({
      enterprise_id: enterpriseId,
      deliverable_id: deliverableId,
      deliverable_type: deliverableType,
      corrected_by: user?.id,
      field_path: fieldPath,
      original_value: currentValue,
      corrected_value: parsed,
      correction_reason: reason,
    } as any);

    // Update the deliverable data in-place
    const { data: deliv } = await supabase
      .from('deliverables')
      .select('data')
      .eq('id', deliverableId)
      .single();

    if (deliv?.data) {
      const newData = { ...deliv.data as any };
      const parts = fieldPath.split('.');
      let ref = newData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!ref[parts[i]]) ref[parts[i]] = {};
        ref = ref[parts[i]];
      }
      ref[parts[parts.length - 1]] = parsed;

      await supabase.from('deliverables').update({ data: newData }).eq('id', deliverableId);

      // Log activity
      try {
        await (supabase.from('activity_log') as any).insert({
          enterprise_id: enterpriseId,
          actor_id: user?.id,
          actor_role: 'coach',
          action: 'correction',
          resource_type: 'deliverable',
          resource_id: deliverableId,
          deliverable_type: deliverableType,
          metadata: { field_path: fieldPath, original_value: currentValue, corrected_value: parsed },
        });
      } catch (_) { /* non-blocking */ }
    }

    // Propagate correction to related fields in other deliverables
    try {
      const propagation = await propagateCorrection(
        enterpriseId, deliverableType, fieldPath, currentValue, parsed,
      );

      if (propagation.propagated.length > 0) {
        toast.success(
          `Correction propagée dans ${propagation.propagated.length} autre(s) livrable(s)`,
          { icon: <ArrowRight className="h-4 w-4" /> },
        );
      }

      if (propagation.staleTexts.length > 0) {
        toast(
          `${propagation.staleTexts.length} section(s) texte citent l'ancienne valeur — cliquez pour reformuler`,
          { duration: 8000 },
        );
        onStaleTextsFound?.(propagation.staleTexts);
      }
    } catch (_) { /* propagation is best-effort */ }

    setSaving(false);
    setOpen(false);
    setReason('');
    toast.success('Correction enregistrée');
    onSaved?.(parsed);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <PenLine className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="text-xs font-medium text-muted-foreground">{fieldPath}</p>
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          className="text-sm h-8"
          placeholder="Nouvelle valeur"
        />
        <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="text-xs resize-none"
          rows={2}
          placeholder="Raison de la correction (obligatoire)"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-7 gap-1" onClick={handleSave} disabled={saving}>
            <Check className="h-3.5 w-3.5" /> Sauver
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
