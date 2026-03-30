import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  enterpriseId: string;
  deliverableId: string;
  deliverableType: string;
  fieldPath: string;
  currentText: string;
  /** Optional extra context to help the AI (e.g. "le CA a été mis à jour à 50M") */
  context?: string;
  onReformulated?: (newText: string) => void;
}

export default function DeliverableReformulator({
  enterpriseId, deliverableId, deliverableType, fieldPath, currentText, context, onReformulated,
}: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleReformulate = async () => {
    if (!instruction.trim()) {
      toast.error('Ajoutez une instruction');
      return;
    }

    setLoading(true);
    setPreview(null);

    try {
      const token = await getValidAccessToken(session);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reformulate-field`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            enterprise_id: enterpriseId,
            deliverable_id: deliverableId,
            deliverable_type: deliverableType,
            field_path: fieldPath,
            current_text: currentText,
            instruction: instruction,
            context: context || null,
          }),
        },
      );

      if (!resp.ok) throw new Error('Erreur reformulation');
      const result = await resp.json();
      setPreview(result.reformulated);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!preview) return;
    setSaving(true);

    try {
      // Fetch current deliverable data
      const { data: deliv } = await supabase
        .from('deliverables')
        .select('data')
        .eq('id', deliverableId)
        .single();

      if (deliv?.data) {
        const newData = { ...(deliv.data as any) };
        const parts = fieldPath.split('.');
        let ref = newData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!ref[parts[i]] || typeof ref[parts[i]] !== 'object') ref[parts[i]] = {};
          ref = ref[parts[i]];
        }
        ref[parts[parts.length - 1]] = preview;

        await supabase.from('deliverables').update({ data: newData }).eq('id', deliverableId);

        // Record correction
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('deliverable_corrections').insert({
          enterprise_id: enterpriseId,
          deliverable_id: deliverableId,
          deliverable_type: deliverableType,
          corrected_by: user?.id,
          field_path: fieldPath,
          original_value: currentText,
          corrected_value: preview,
          correction_reason: `Reformulation IA : ${instruction}`,
        } as any).catch(() => {});
      }

      toast.success('Texte reformulé et enregistré');
      setOpen(false);
      setPreview(null);
      setInstruction('');
      onReformulated?.(preview);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setPreview(null);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview(null); setInstruction(''); } }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Sparkles className="h-3 w-3 text-indigo-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-3" align="start">
        <p className="text-xs font-medium text-muted-foreground">{fieldPath}</p>

        {/* Current text preview */}
        <div className="p-2 rounded bg-muted/50 max-h-24 overflow-y-auto">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentText.length > 300 ? currentText.slice(0, 300) + '...' : currentText}
          </p>
        </div>

        {!preview ? (
          <>
            <Textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              className="text-xs resize-none"
              rows={2}
              placeholder='Ex: "Rends plus concis", "Ajoute les chiffres du CA", "Ton plus formel"...'
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-7 gap-1" onClick={handleReformulate} disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reformulation...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Reformuler</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Preview of reformulated text */}
            <div className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 max-h-40 overflow-y-auto">
              <p className="text-xs leading-relaxed">{preview}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={handleRetry}>
                <RotateCcw className="h-3.5 w-3.5" /> Réessayer
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" /> Annuler
              </Button>
              <Button size="sm" className="h-7 gap-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleAccept} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Accepter</>
                )}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
