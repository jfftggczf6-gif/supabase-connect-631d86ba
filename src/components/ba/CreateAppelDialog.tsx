// src/components/ba/CreateAppelDialog.tsx
// Modal "+ Nouvel appel à candidatures" pour le Partner BA.
// 5 champs : nom (req), description (req), période start/end (req), pays ciblés (opt),
// secteurs ciblés (opt). Auto-seed 11 DEFAULT_FORM_FIELDS au create.
// Crée 1 row dans `programmes` via EF manage-programme action=create.

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_FORM_FIELDS } from '@/types/candidature-ba';

// Référentiel pays/secteurs aligné CandidatureFormBuilder + ProgrammeCreatePage.
const COUNTRIES = [
  'Bénin', 'Burkina Faso', 'Cameroun', 'Congo', "Côte d'Ivoire", 'Gabon',
  'Guinée', 'Mali', 'Niger', 'RDC', 'Sénégal', 'Togo',
];
const SECTORS = [
  'Agriculture', 'Agro-industrie', 'BTP', 'Commerce', 'Éducation', 'Énergie',
  'Fintech', 'Industrie', 'Santé', 'Services', 'Technologie', 'Transport',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  /** Appelé avec l'id du nouvel appel créé pour que le parent switche dessus. */
  onCreated: (programmeId: string) => void;
}

function MultiSelect({
  label, options, selected, onChange, placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (value: string) => {
    onChange(selected.includes(value)
      ? selected.filter(s => s !== value)
      : [...selected, value]);
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9">
            <span className="truncate text-muted-foreground text-sm">
              {selected.length === 0
                ? placeholder
                : `${selected.length} sélectionné${selected.length > 1 ? 's' : ''}`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher…" />
            <CommandList>
              <CommandEmpty>Aucun résultat.</CommandEmpty>
              <CommandGroup>
                {options.map(opt => (
                  <CommandItem
                    key={opt}
                    onSelect={() => toggle(opt)}
                    className="cursor-pointer"
                  >
                    <Check className={cn('mr-2 h-4 w-4', selected.includes(opt) ? 'opacity-100' : 'opacity-0')} />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selected.map(s => (
            <Badge key={s} variant="secondary" className="gap-1 text-[10px] pl-2 pr-1 py-0.5">
              {s}
              <button
                type="button"
                onClick={() => toggle(s)}
                className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateAppelDialog({
  open, onOpenChange, organizationId, onCreated,
}: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(''); setDescription(''); setStartDate(''); setEndDate('');
    setCountries([]); setSectors([]); setSubmitting(false);
  };

  const canSubmit = name.trim().length >= 3
    && description.trim().length >= 10
    && !!startDate && !!endDate
    && endDate >= startDate;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('manage-programme', {
      body: {
        action: 'create',
        organization_id: organizationId,
        name: name.trim(),
        description: description.trim(),
        type: 'banque_affaires',
        status: 'in_progress',
        start_date: startDate,
        end_date: endDate,
        country_filter: countries,
        sector_filter: sectors,
        form_fields: DEFAULT_FORM_FIELDS,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      let real: string | null = (data as any)?.error || null;
      if (!real && error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) { try { real = (await ctx.json())?.error ?? null; } catch {} }
        if (!real) real = error.message;
      }
      toast.error(real || 'Création échouée');
      return;
    }
    const created = (data as any)?.programme || (data as any)?.data;
    toast.success(`Appel "${name.trim()}" créé`);
    reset();
    onOpenChange(false);
    if (created?.id) onCreated(created.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvel appel à candidatures</DialogTitle>
          <DialogDescription className="text-xs">
            Crée la vitrine publique de l'appel. Les 11 champs de formulaire par
            défaut sont initialisés — tu pourras les personnaliser après via
            "Gérer le formulaire".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Nom de l'appel <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Levée série A — Tech UEMOA 2026"
              maxLength={120}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce que vous cherchez : type d'entreprise, stade, contexte. Affichée en haut de la page publique."
              rows={3}
              maxLength={500}
              disabled={submitting}
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {description.length}/500
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Début <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Fin <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                disabled={submitting}
              />
            </div>
          </div>

          <MultiSelect
            label="Pays ciblés (optionnel)"
            options={COUNTRIES}
            selected={countries}
            onChange={setCountries}
            placeholder="Tous les pays"
          />

          <MultiSelect
            label="Secteurs ciblés (optionnel)"
            options={SECTORS}
            selected={sectors}
            onChange={setSectors}
            placeholder="Tous les secteurs"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { reset(); onOpenChange(false); }}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Création…</> : "Créer l'appel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
