// src/components/ba/parametres/TheseSection.tsx
// SECTION 4 — Thèse d'investissement : textarea + compteur caractères + aperçu IA.

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { THESIS_AI_USAGES, type InvestmentThesis } from '@/types/parametres-ba';

interface Props {
  value: InvestmentThesis;
  saving: boolean;
  onSave: (next: InvestmentThesis) => Promise<boolean>;
}

export default function TheseSection({ value, saving, onSave }: Props) {
  const [draft, setDraft] = useState<InvestmentThesis>(value);
  const dirty = draft.text !== value.text;
  const len = draft.text.length;
  const overLimit = len > draft.max_length;
  const nearLimit = len > draft.max_length * 0.9;

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Thèse d'investissement</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Décrivez votre approche, vos critères qualitatifs, vos convictions sectorielles.
          Texte libre, utilisé par l'IA partout où elle a besoin de comprendre vos préférences.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Thèse (texte libre)</Label>
        <Textarea
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          placeholder="Ex: Nous accompagnons les PME en croissance de la zone UEMOA dans les secteurs de la santé, de l'agro-industrie et de l'énergie renouvelable. Nous cherchons des entreprises avec un EBITDA positif, un management expérimenté, et un fort potentiel de scaling régional. Nous évitons les modèles capital-intensifs et privilégions les business models récurrents..."
          rows={10}
          disabled={saving}
          className={cn('font-sans', overLimit && 'border-rose-300 focus-visible:ring-rose-400')}
        />
        <div className={cn(
          'text-right text-[10px]',
          overLimit ? 'text-rose-600 font-semibold' : nearLimit ? 'text-amber-600' : 'text-muted-foreground',
        )}>
          {len} / {draft.max_length} caractères
          {overLimit && ' — limite dépassée'}
        </div>
      </div>

      <div className="rounded border bg-violet-50/50 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">
            Où l'IA utilise votre thèse
          </span>
        </div>
        <ul className="space-y-1 ml-5 text-xs text-muted-foreground">
          {THESIS_AI_USAGES.map(usage => (
            <li key={usage.code} className="list-disc">
              {usage.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(value)} disabled={saving}>
            Annuler
          </Button>
        )}
        <Button size="sm" onClick={() => onSave(draft)} disabled={!dirty || overLimit || saving}>
          {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sauvegarde…</> : 'Sauvegarder'}
        </Button>
      </div>
    </Card>
  );
}
