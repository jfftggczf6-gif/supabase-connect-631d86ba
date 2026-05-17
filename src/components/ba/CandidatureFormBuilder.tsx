// src/components/ba/CandidatureFormBuilder.tsx
// Sous-page builder du formulaire (Bloc 2 brief). 2 colonnes : éditeur + aperçu.
// Sauvegarde via manage-programme action='update' (form_fields jsonb).
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BaProgramme, FieldType, FormConfig, FormField } from '@/types/candidature-ba';
import CandidatureFormPreview from './CandidatureFormPreview';

interface Props {
  programme: BaProgramme;
  onBack: () => void;
  onSaved: () => void;
}

const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Texte court',
  textarea: 'Texte long',
  number: 'Nombre',
  email: 'Email',
  select: 'Liste déroulante',
  date: 'Date',
};

export default function CandidatureFormBuilder({ programme, onBack, onSaved }: Props) {
  const [draft, setDraft] = useState<FormConfig>({
    title: programme.name,
    description: programme.description ?? '',
    startDate: programme.start_date,
    endDate: programme.end_date,
    fields: programme.form_fields,
  });
  const [saving, setSaving] = useState(false);

  const updateField = (id: string | number, patch: Partial<FormField>) => {
    setDraft(d => ({ ...d, fields: d.fields.map(f => f.id === id ? { ...f, ...patch } : f) }));
  };
  const removeField = (id: string | number) => {
    setDraft(d => ({ ...d, fields: d.fields.filter(f => f.id !== id) }));
  };
  const addField = () => {
    setDraft(d => ({
      ...d,
      fields: [...d.fields, { id: Date.now(), label: 'Nouveau champ', type: 'text', required: false }],
    }));
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      toast.error('Le titre est requis');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('manage-programme', {
      body: {
        action: 'update',
        id: programme.id,
        name: draft.title,
        description: draft.description || null,
        start_date: draft.startDate,
        end_date: draft.endDate,
        form_fields: draft.fields,
      },
    });
    setSaving(false);

    if (error || (data as any)?.error) {
      // extract body si HttpError
      let realError: string | null = (data as any)?.error || null;
      if (!realError && error) {
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try { realError = (await ctx.json())?.error ?? null; } catch {}
        }
        if (!realError) realError = error.message;
      }
      toast.error(realError || 'Sauvegarde échouée');
      return;
    }
    toast.success('Formulaire enregistré');
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Retour
        </button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sauvegarde…</> : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Editor */}
        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              En-tête du formulaire
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Titre</Label>
              <Input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                className="font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={3}
                value={draft.description}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Période d'ouverture
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Début</Label>
                <Input
                  type="date"
                  value={draft.startDate ?? ''}
                  onChange={e => setDraft(d => ({ ...d, startDate: e.target.value || null }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fin</Label>
                <Input
                  type="date"
                  value={draft.endDate ?? ''}
                  onChange={e => setDraft(d => ({ ...d, endDate: e.target.value || null }))}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Les candidatures ne sont acceptées que pendant cette période.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Champs ({draft.fields.length})
              </div>
              <Button size="sm" variant="outline" onClick={addField} className="gap-1.5 h-7">
                <Plus className="h-3 w-3" /> Ajouter
              </Button>
            </div>
            <div className="space-y-3">
              {draft.fields.map((f, i) => (
                <div key={f.id} className="space-y-2 pb-3 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <Input
                      value={f.label}
                      onChange={e => updateField(f.id, { label: e.target.value })}
                      className="font-medium text-sm h-8"
                    />
                    <button
                      onClick={() => removeField(f.id)}
                      className="text-destructive hover:bg-destructive/10 p-1.5 rounded"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 pl-7">
                    <Select value={f.type} onValueChange={(v) => updateField(f.id, { type: v as FieldType })}>
                      <SelectTrigger className="h-7 text-xs w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_LABEL) as FieldType[]).map(t => (
                          <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={f.required}
                        onCheckedChange={(v) => updateField(f.id, { required: v === true })}
                      />
                      Requis
                    </label>
                  </div>
                  {f.type === 'select' && (
                    <div className="pl-7">
                      <Input
                        value={(f.options ?? []).join(', ')}
                        onChange={e => updateField(f.id, {
                          options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                        })}
                        placeholder="Option 1, Option 2, Option 3"
                        className="h-7 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Aperçu en temps réel
          </div>
          <Card className="p-6 bg-muted/20 sticky top-4">
            <CandidatureFormPreview config={draft} />
          </Card>
        </div>
      </div>
    </div>
  );
}
