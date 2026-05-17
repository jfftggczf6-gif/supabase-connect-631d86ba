// src/components/ba/CandidatureFormPreview.tsx
// Aperçu temps réel d'un formulaire candidature (réutilisable dans le builder).
// Rendu disabled : juste pour visualiser, pas pour interagir.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import type { FormConfig } from '@/types/candidature-ba';

interface Props {
  config: FormConfig;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function CandidatureFormPreview({ config }: Props) {
  return (
    <div className="space-y-4">
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
        Ouvert du {formatDate(config.startDate)} au {formatDate(config.endDate)}
      </Badge>

      <h3 className="text-xl font-bold">{config.title || 'Titre du formulaire'}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {config.description || 'Description du formulaire'}
      </p>

      <div className="space-y-3">
        {config.fields.map(f => (
          <div key={f.id} className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {f.label} {f.required && <span className="text-destructive">*</span>}
            </Label>
            {f.type === 'text' && <Input disabled placeholder="" />}
            {f.type === 'email' && <Input disabled type="email" />}
            {f.type === 'number' && <Input disabled type="number" />}
            {f.type === 'date' && <Input disabled type="date" />}
            {f.type === 'textarea' && <Textarea disabled rows={3} />}
            {f.type === 'select' && (
              <Select disabled>
                <SelectTrigger><SelectValue placeholder="— Sélectionner —" /></SelectTrigger>
                <SelectContent>
                  {(f.options ?? []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {f.type === 'file' && (
              <div className="border-2 border-dashed rounded-md p-3 text-center text-xs text-muted-foreground bg-white">
                <Upload className="h-4 w-4 mx-auto mb-1 opacity-50" />
                <div>Glisser-déposer{f.multiple ? ' un ou plusieurs' : ' un'} fichier{f.multiple ? 's' : ''}</div>
                {f.accept && <div className="text-[10px] mt-1 opacity-70">{f.accept}</div>}
              </div>
            )}
            {f.type === 'checkbox' && (f.options ?? []).map(o => (
              <label key={o} className="flex items-center gap-2 text-xs">
                <input type="checkbox" disabled /> {o}
              </label>
            ))}
            {f.type === 'radio' && (f.options ?? []).map(o => (
              <label key={o} className="flex items-center gap-2 text-xs">
                <input type="radio" disabled /> {o}
              </label>
            ))}
          </div>
        ))}
      </div>

      <Button disabled className="w-full">Envoyer ma candidature</Button>
    </div>
  );
}
