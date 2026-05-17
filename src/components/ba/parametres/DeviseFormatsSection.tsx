// src/components/ba/parametres/DeviseFormatsSection.tsx
// SECTION 2 — Devise & formats : toggle buttons pour devise, date, nombre, langue.

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeviseFormats, Devise, DateFormat, NumberFormat, Langue } from '@/types/parametres-ba';

interface Props {
  value: DeviseFormats;
  saving: boolean;
  onSave: (next: DeviseFormats) => Promise<boolean>;
}

const DEVISES: { code: Devise; label: string; flag: string }[] = [
  { code: 'XOF', label: 'FCFA (XOF)', flag: '🌍' },
  { code: 'EUR', label: 'Euro (EUR)', flag: '🇪🇺' },
  { code: 'USD', label: 'Dollar (USD)', flag: '🇺🇸' },
  { code: 'GBP', label: 'Livre (GBP)', flag: '🇬🇧' },
];

const DATE_FORMATS: { code: DateFormat; label: string; example: string }[] = [
  { code: 'DD/MM/YYYY', label: 'Français',  example: '17/05/2026' },
  { code: 'MM/DD/YYYY', label: 'Américain', example: '05/17/2026' },
  { code: 'YYYY-MM-DD', label: 'ISO 8601',  example: '2026-05-17' },
];

const NUMBER_FORMATS: { code: NumberFormat; label: string; example: string }[] = [
  { code: 'fr-FR', label: 'Français', example: '1 234 567,89' },
  { code: 'en-US', label: 'Anglais',  example: '1,234,567.89' },
];

const LANGUES: { code: Langue; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
];

function Toggle<T extends string>({
  label, options, selected, onChange, disabled,
}: {
  label: string;
  options: { code: T; label: string; example?: string; flag?: string }[];
  selected: T;
  onChange: (code: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            disabled={disabled}
            className={cn(
              'px-3 py-1.5 text-xs rounded border transition-colors',
              selected === opt.code
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted/50 border-input',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {opt.flag && <span className="mr-1">{opt.flag}</span>}
            {opt.label}
            {opt.example && (
              <span className="ml-1.5 opacity-70 font-mono text-[10px]">{opt.example}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DeviseFormatsSection({ value, saving, onSave }: Props) {
  const [draft, setDraft] = useState<DeviseFormats>(value);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Devise & formats</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Affecte l'affichage des montants, dates et nombres partout dans l'app.
        </p>
      </div>

      <Toggle
        label="Devise par défaut"
        options={DEVISES}
        selected={draft.devise}
        onChange={(devise) => setDraft({ ...draft, devise })}
        disabled={saving}
      />
      <Toggle
        label="Format de date"
        options={DATE_FORMATS}
        selected={draft.date_format}
        onChange={(date_format) => setDraft({ ...draft, date_format })}
        disabled={saving}
      />
      <Toggle
        label="Format des nombres"
        options={NUMBER_FORMATS}
        selected={draft.number_format}
        onChange={(number_format) => setDraft({ ...draft, number_format })}
        disabled={saving}
      />
      <Toggle
        label="Langue de l'interface"
        options={LANGUES}
        selected={draft.langue}
        onChange={(langue) => setDraft({ ...draft, langue })}
        disabled={saving}
      />

      <div className="flex justify-end gap-2 pt-2 border-t">
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(value)} disabled={saving}>
            Annuler
          </Button>
        )}
        <Button size="sm" onClick={() => onSave(draft)} disabled={!dirty || saving}>
          {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sauvegarde…</> : 'Sauvegarder'}
        </Button>
      </div>
    </Card>
  );
}
