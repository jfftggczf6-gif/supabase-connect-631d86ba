// src/components/ba/parametres/CriteresSection.tsx
// SECTION 3 — Critères d'investissement : ticket min/max, secteurs autorisés/exclus,
// géographies, ancienneté, toggle ESG IFC. Alimente pre-screening + candidature
// screening + fund matching.

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GEOGRAPHIES_UEMOA, SECTORS_PRESETS, ESG_EXCLUDED_PRESETS,
  type InvestmentCriteria, type GeographieUEMOA,
} from '@/types/parametres-ba';

interface Props {
  value: InvestmentCriteria;
  saving: boolean;
  onSave: (next: InvestmentCriteria) => Promise<boolean>;
}

function TagPicker({
  label, options, selected, onToggle, color, allowCustom = false,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
  color: 'emerald' | 'rose';
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState('');
  const isExclusion = color === 'rose';
  const selectedClass = isExclusion
    ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200'
    : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200';
  const unselectedClass = 'bg-muted/30 text-muted-foreground border-input hover:bg-muted/60';

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const sel = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(
                'px-2.5 py-1 text-xs rounded border transition-colors',
                sel ? selectedClass : unselectedClass,
              )}
            >
              {opt}
            </button>
          );
        })}
        {/* Tags custom ajoutés au-delà du preset */}
        {selected.filter(s => !options.includes(s)).map(s => (
          <Badge
            key={s}
            variant="outline"
            className={cn('gap-1 text-xs cursor-pointer', isExclusion ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700')}
            onClick={() => onToggle(s)}
          >
            {s}
            <X className="h-3 w-3" />
          </Badge>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-1">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={`Ajouter ${isExclusion ? 'une exclusion' : 'un secteur'} custom`}
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.trim()) {
                onToggle(custom.trim());
                setCustom('');
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={() => {
              if (custom.trim()) {
                onToggle(custom.trim());
                setCustom('');
              }
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CriteresSection({ value, saving, onSave }: Props) {
  const [draft, setDraft] = useState<InvestmentCriteria>(value);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const ticketValid = draft.ticket_min >= 0 && draft.ticket_max > draft.ticket_min;
  const canSubmit = ticketValid && draft.anciennete_min >= 0;

  const toggleSector = (tag: string) =>
    setDraft({
      ...draft,
      sectors_authorized: draft.sectors_authorized.includes(tag)
        ? draft.sectors_authorized.filter(s => s !== tag)
        : [...draft.sectors_authorized, tag],
    });

  const toggleExclusion = (tag: string) =>
    setDraft({
      ...draft,
      sectors_excluded: draft.sectors_excluded.includes(tag)
        ? draft.sectors_excluded.filter(s => s !== tag)
        : [...draft.sectors_excluded, tag],
    });

  const toggleGeo = (geo: GeographieUEMOA) =>
    setDraft({
      ...draft,
      geographies: draft.geographies.includes(geo)
        ? draft.geographies.filter(g => g !== geo)
        : [...draft.geographies, geo],
    });

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold">Critères d'investissement</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Utilisé par : pre-screening IA · screening candidatures · matching fonds.
        </p>
      </div>

      {/* Fourchette ticket */}
      <div className="space-y-1.5">
        <Label className="text-xs">Fourchette ticket (en M USD)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={draft.ticket_min}
            onChange={(e) => setDraft({ ...draft, ticket_min: Number(e.target.value) || 0 })}
            placeholder="Min"
            min={0}
            step={0.5}
            disabled={saving}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="number"
            value={draft.ticket_max}
            onChange={(e) => setDraft({ ...draft, ticket_max: Number(e.target.value) || 0 })}
            placeholder="Max"
            min={0}
            step={0.5}
            disabled={saving}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">M USD</span>
        </div>
        {!ticketValid && (
          <p className="text-[10px] text-rose-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Max doit être &gt; Min
          </p>
        )}
      </div>

      {/* Secteurs autorisés */}
      <TagPicker
        label="Secteurs autorisés"
        options={SECTORS_PRESETS}
        selected={draft.sectors_authorized}
        onToggle={toggleSector}
        color="emerald"
        allowCustom
      />

      {/* Secteurs exclus ESG */}
      <TagPicker
        label="Secteurs exclus ESG"
        options={ESG_EXCLUDED_PRESETS}
        selected={draft.sectors_excluded}
        onToggle={toggleExclusion}
        color="rose"
        allowCustom
      />

      {/* Géographies */}
      <div className="space-y-2">
        <Label className="text-xs">Géographies cibles (UEMOA)</Label>
        <div className="flex flex-wrap gap-1.5">
          {GEOGRAPHIES_UEMOA.map(geo => {
            const sel = draft.geographies.includes(geo);
            return (
              <button
                key={geo}
                type="button"
                onClick={() => toggleGeo(geo)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded border transition-colors',
                  sel
                    ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                    : 'bg-muted/30 text-muted-foreground border-input hover:bg-muted/60',
                )}
              >
                {geo}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ancienneté min */}
      <div className="space-y-1.5">
        <Label className="text-xs">Ancienneté minimum société (années)</Label>
        <Input
          type="number"
          value={draft.anciennete_min}
          onChange={(e) => setDraft({ ...draft, anciennete_min: Number(e.target.value) || 0 })}
          min={0}
          max={50}
          disabled={saving}
          className="w-24"
        />
      </div>

      {/* Toggle ESG IFC */}
      <div className="flex items-center justify-between p-3 border rounded bg-muted/20">
        <div className="flex-1">
          <div className="text-xs font-semibold">Grille ESG IFC</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Active l'évaluation IFC Performance Standards dans les pre-screenings et IM.
          </p>
        </div>
        <Switch
          checked={draft.esg_ifc_enabled}
          onCheckedChange={(esg_ifc_enabled) => setDraft({ ...draft, esg_ifc_enabled })}
          disabled={saving}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(value)} disabled={saving}>
            Annuler
          </Button>
        )}
        <Button size="sm" onClick={() => onSave(draft)} disabled={!dirty || !canSubmit || saving}>
          {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sauvegarde…</> : 'Sauvegarder'}
        </Button>
      </div>
    </Card>
  );
}
