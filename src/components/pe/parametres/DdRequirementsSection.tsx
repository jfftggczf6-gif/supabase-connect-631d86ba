// DdRequirementsSection — Paramètres PE · onglet "Documents DD".
// Brief #36 : checklist documents Due Diligence configurable par fonds PE.
// Pattern aligné sur ba/parametres/DocumentRequirementsSection.

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Save, Sparkles, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePeDdRequirements,
  seedPeDdRequirementsForOrg,
  type PeDdRequirementRow,
} from '@/hooks/usePeDdRequirements';
import { supabase } from '@/integrations/supabase/client';

const DD_CATEGORIES: { value: string; label: string }[] = [
  { value: 'financial',    label: 'Financier' },
  { value: 'legal',        label: 'Juridique' },
  { value: 'compliance',   label: 'Compliance & social' },
  { value: 'commercial',   label: 'Commercial' },
  { value: 'organization', label: 'Organisation' },
  { value: 'strategy',     label: 'Stratégie' },
  { value: 'esg',          label: 'ESG / Impact' },
  { value: 'autre',        label: 'Autre' },
];

interface Props {
  organizationId: string;
}

interface EditableRow {
  id?: string;
  code: string;
  label: string;
  category: string;
  required: boolean;
  hint: string;
  display_order: number;
  _dirty?: boolean;
  _new?: boolean;
}

function toEditable(r: PeDdRequirementRow): EditableRow {
  return {
    id: r.id, code: r.code, label: r.label, category: r.category,
    required: r.required, hint: r.hint ?? '', display_order: r.display_order,
  };
}

export default function DdRequirementsSection({ organizationId }: Props) {
  const { rows, loading, error, reload } = usePeDdRequirements(organizationId);
  const [items, setItems] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(rows.map(toEditable)); }, [rows]);

  const update = (idx: number, patch: Partial<EditableRow>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch, _dirty: true } : it));
  };

  const addItem = () => {
    const nextOrder = Math.max(0, ...items.map(i => i.display_order)) + 1;
    setItems(prev => [...prev, {
      code: `dd_custom_${Date.now()}`,
      label: '', category: 'autre', required: true, hint: '',
      display_order: nextOrder, _dirty: true, _new: true,
    }]);
  };

  const removeItem = async (idx: number) => {
    const item = items[idx];
    if (item._new) {
      setItems(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    if (!confirm(`Supprimer « ${item.label} » de la checklist DD ?`)) return;
    const { error: delErr } = await supabase
      .from('pe_dd_requirements' as any)
      .delete()
      .eq('id', item.id!);
    if (delErr) {
      toast.error(`Suppression échouée : ${delErr.message}`);
      return;
    }
    toast.success('Document retiré de la checklist DD');
    reload();
  };

  const seedDefault = async () => {
    if (items.length > 0 && !confirm('Restaurer la checklist DD par défaut (10 documents) ? Les items existants seront conservés.')) return;
    try {
      await seedPeDdRequirementsForOrg(organizationId);
      toast.success('Checklist DD par défaut appliquée');
      reload();
    } catch (e: any) {
      toast.error(`Seed échoué : ${e.message}`);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const dirty = items.filter(i => i._dirty);
      for (const it of dirty) {
        if (!it.label.trim()) {
          toast.error('Chaque document doit avoir un nom');
          setSaving(false);
          return;
        }
        const payload = {
          organization_id: organizationId,
          code: it.code, label: it.label.trim(),
          category: it.category, required: it.required,
          hint: it.hint.trim() || null,
          display_order: it.display_order,
          updated_at: new Date().toISOString(),
        };
        if (it._new) {
          const { error: insErr } = await supabase
            .from('pe_dd_requirements' as any)
            .insert(payload);
          if (insErr) throw new Error(insErr.message);
        } else {
          const { error: updErr } = await supabase
            .from('pe_dd_requirements' as any)
            .update(payload)
            .eq('id', it.id!);
          if (updErr) throw new Error(updErr.message);
        }
      }
      toast.success(`${dirty.length} modification(s) enregistrée(s)`);
      reload();
    } catch (e: any) {
      toast.error(`Sauvegarde échouée : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const dirtyCount = items.filter(i => i._dirty).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Documents Due Diligence</CardTitle>
            <CardDescription>
              Définissez la checklist documents que chaque deal PE doit collecter en phase DD. La sidebar deal affichera X/Y catégories reçues.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {items.length === 0 && (
              <Button variant="outline" size="sm" onClick={seedDefault} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Charger le preset (10 docs DD)
              </Button>
            )}
            <Button size="sm" onClick={addItem} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <div className="text-xs text-rose-600">{error}</div>}

        {items.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            Aucun document DD configuré. Chargez le preset par défaut ou ajoutez vos propres documents.
          </div>
        )}

        {items
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((it) => {
            const realIdx = items.indexOf(it);
            return (
              <div key={it.id ?? it.code} className="flex items-center gap-2 p-3 border rounded-lg bg-card">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-move" />
                <Input
                  type="number"
                  value={it.display_order}
                  onChange={e => update(realIdx, { display_order: parseInt(e.target.value, 10) || 0 })}
                  className="w-16 h-9"
                  min={0}
                  title="Ordre d'affichage"
                />
                <Input
                  value={it.label}
                  onChange={e => update(realIdx, { label: e.target.value })}
                  placeholder="Nom du document DD"
                  className="flex-1 h-9"
                />
                <Select value={it.category} onValueChange={v => update(realIdx, { category: v })}>
                  <SelectTrigger className="w-44 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DD_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={it.hint}
                  onChange={e => update(realIdx, { hint: e.target.value })}
                  placeholder="Hint (optionnel)"
                  className="w-44 h-9"
                />
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={it.required}
                    onCheckedChange={v => update(realIdx, { required: v })}
                  />
                  <span className="text-[11px] text-muted-foreground">{it.required ? 'Requis' : 'Optionnel'}</span>
                </div>
                {it._new && <Badge variant="outline" className="text-[10px]">Nouveau</Badge>}
                {it._dirty && !it._new && <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">Modifié</Badge>}
                <Button variant="ghost" size="sm" onClick={() => removeItem(realIdx)} className="h-8 w-8 p-0">
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            );
          })}

        {items.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {items.length} document(s) configuré(s) · {items.filter(i => i.required).length} requis
            </div>
            <Button onClick={saveAll} disabled={saving || dirtyCount === 0} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Enregistrer {dirtyCount > 0 && `(${dirtyCount})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
