// PeParametersTab — onglet "Paramètres" du workspace MD
// Permet au MD de configurer la thèse d'investissement du fonds :
// devise par défaut, ticket min/max, secteurs cibles, pays cibles, stades, critères ESG.
// Stocké dans organizations.settings.pe_thesis (JSONB).
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X, Plus, Settings, Globe, Target, Coins, Leaf } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentRole } from '@/hooks/useCurrentRole';

interface Props {
  organizationId: string;
}

interface PeThesis {
  description?: string;
  currency: 'XOF' | 'EUR' | 'USD' | 'XAF';
  ticket_min: number | null;
  ticket_max: number | null;
  sectors_focus: string[];
  countries_focus: string[];
  stages_focus: string[];
  esg_criteria: string[];
}

const STAGE_OPTIONS = [
  { value: 'seed', label: 'Seed' },
  { value: 'pre_serie_a', label: 'Pré-Série A' },
  { value: 'series_a', label: 'Série A' },
  { value: 'series_b', label: 'Série B' },
  { value: 'growth', label: 'Growth' },
  { value: 'mezzanine', label: 'Mezzanine' },
  { value: 'lbo', label: 'LBO / Buy-out' },
];

const DEFAULT_THESIS: PeThesis = {
  description: '',
  currency: 'XOF',
  ticket_min: null,
  ticket_max: null,
  sectors_focus: [],
  countries_focus: [],
  stages_focus: [],
  esg_criteria: [],
};

// Petit composant interne pour gérer une liste de chips (input + badge + suppression)
function ChipList({
  items, onAdd, onRemove, placeholder, disabled,
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');
  const submit = () => {
    const v = input.trim();
    if (!v || items.includes(v)) { setInput(''); return; }
    onAdd(v);
    setInput('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {items.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun élément ajouté</span>}
        {items.map(item => (
          <Badge key={item} variant="outline" className="gap-1 bg-violet-50 text-violet-700 border-violet-200">
            {item}
            {!disabled && (
              <button onClick={() => onRemove(item)} className="hover:text-red-500" type="button">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            placeholder={placeholder}
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={submit} disabled={!input.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PeParametersTab({ organizationId }: Props) {
  const { role } = useCurrentRole();
  const canEdit = ['owner', 'admin', 'manager'].includes(role || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thesis, setThesis] = useState<PeThesis>(DEFAULT_THESIS);
  const [orgName, setOrgName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('organizations')
      .select('name, settings')
      .eq('id', organizationId)
      .single();
    if (data) {
      setOrgName(data.name);
      const settings = (data.settings as any) || {};
      const peThesis = settings.pe_thesis || {};
      setThesis({
        description: peThesis.description ?? '',
        currency: peThesis.currency ?? 'XOF',
        ticket_min: peThesis.ticket_min ?? null,
        ticket_max: peThesis.ticket_max ?? null,
        sectors_focus: peThesis.sectors_focus ?? [],
        countries_focus: peThesis.countries_focus ?? [],
        stages_focus: peThesis.stages_focus ?? [],
        esg_criteria: peThesis.esg_criteria ?? [],
      });
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    // Récupère settings existant pour merge
    const { data: cur } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();
    const existing = (cur?.settings as any) || {};
    const newSettings = { ...existing, pe_thesis: thesis };
    const { error } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', organizationId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Paramètres enregistrés');
    load();
  };

  const toggleStage = (s: string) => {
    setThesis(t => ({
      ...t,
      stages_focus: t.stages_focus.includes(s) ? t.stages_focus.filter(x => x !== s) : [...t.stages_focus, s],
    }));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-violet-600" /> Paramètres du fonds
          </h2>
          <p className="text-xs text-muted-foreground">{orgName} — thèse d'investissement utilisée pour le scoring et les filtres</p>
        </div>
        {canEdit && (
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
        )}
      </div>

      {!canEdit && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800">
            Lecture seule — seul un MD/admin/owner peut modifier les paramètres du fonds.
          </CardContent>
        </Card>
      )}

      {/* Section : Description & Devise */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold flex items-center gap-2">
            <Coins className="h-3.5 w-3.5" /> Identité & Devise
          </h3>

          <div className="space-y-1.5">
            <Label className="text-xs">Description / mandat du fonds</Label>
            <Textarea
              value={thesis.description ?? ''}
              onChange={(e) => setThesis(t => ({ ...t, description: e.target.value }))}
              placeholder="Ex: Fonds early-stage tech & impact, ticket 500K-3M€ en Afrique de l'Ouest francophone..."
              rows={3}
              disabled={!canEdit}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Devise par défaut</Label>
              <Select value={thesis.currency} onValueChange={(v) => setThesis(t => ({ ...t, currency: v as PeThesis['currency'] }))} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="XOF">XOF — Franc CFA UEMOA</SelectItem>
                  <SelectItem value="XAF">XAF — Franc CFA CEMAC</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="USD">USD — Dollar US</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ticket min</Label>
              <Input
                type="number"
                value={thesis.ticket_min ?? ''}
                onChange={(e) => setThesis(t => ({ ...t, ticket_min: e.target.value ? Number(e.target.value) : null }))}
                placeholder="500000"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ticket max</Label>
              <Input
                type="number"
                value={thesis.ticket_max ?? ''}
                onChange={(e) => setThesis(t => ({ ...t, ticket_max: e.target.value ? Number(e.target.value) : null }))}
                placeholder="5000000"
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section : Stades */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold flex items-center gap-2">
            <Target className="h-3.5 w-3.5" /> Stades d'investissement ciblés
          </h3>
          <div className="flex flex-wrap gap-2">
            {STAGE_OPTIONS.map(s => {
              const active = thesis.stages_focus.includes(s.value);
              return (
                <Button
                  key={s.value}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleStage(s.value)}
                  disabled={!canEdit}
                  className={active ? 'bg-violet-600 hover:bg-violet-700' : ''}
                >
                  {s.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section : Secteurs / Pays */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Secteurs cibles
            </h3>
            <ChipList
              items={thesis.sectors_focus}
              onAdd={(v) => setThesis(t => ({ ...t, sectors_focus: [...t.sectors_focus, v] }))}
              onRemove={(v) => setThesis(t => ({ ...t, sectors_focus: t.sectors_focus.filter(x => x !== v) }))}
              placeholder="Ex: Agro, Fintech, Santé…"
              disabled={!canEdit}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" /> Pays cibles
            </h3>
            <ChipList
              items={thesis.countries_focus}
              onAdd={(v) => setThesis(t => ({ ...t, countries_focus: [...t.countries_focus, v] }))}
              onRemove={(v) => setThesis(t => ({ ...t, countries_focus: t.countries_focus.filter(x => x !== v) }))}
              placeholder="Ex: Côte d'Ivoire, Sénégal…"
              disabled={!canEdit}
            />
          </CardContent>
        </Card>
      </div>

      {/* Section : Critères ESG */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold flex items-center gap-2">
            <Leaf className="h-3.5 w-3.5" /> Critères ESG / Impact
          </h3>
          <p className="text-xs text-muted-foreground -mt-1">
            Critères évalués lors de la due diligence (ex: "Pas de tabac/armement", "Mixité +30%", "Empreinte carbone réduite")
          </p>
          <ChipList
            items={thesis.esg_criteria}
            onAdd={(v) => setThesis(t => ({ ...t, esg_criteria: [...t.esg_criteria, v] }))}
            onRemove={(v) => setThesis(t => ({ ...t, esg_criteria: t.esg_criteria.filter(x => x !== v) }))}
            placeholder="Ex: Pas de tabac/armement, Mixité hommes/femmes…"
            disabled={!canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
