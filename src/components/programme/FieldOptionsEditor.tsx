import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

/**
 * Éditeur d'options façon Google Forms : une option par ligne, ajout / suppression / édition.
 * Utilisé pour les champs « Choix unique » (radio), « Choix multiples » (checkbox) et « Liste déroulante ».
 * Contrôlé : value/onChange. Garde toujours au moins une ligne affichée.
 */
export function FieldOptionsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (options: string[]) => void;
}) {
  const opts = value.length ? value : [""];

  const update = (i: number, val: string) => onChange(opts.map((o, idx) => (idx === i ? val : o)));
  const add = () => onChange([...opts, ""]);
  const remove = (i: number) => onChange(opts.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1.5">
      {opts.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-4 text-right">{i + 1}.</span>
          <Input
            value={o}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
            className="h-8 text-sm flex-1"
            aria-label={`Option ${i + 1}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={opts.length <= 1}
            className="text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed p-1"
            aria-label={`Retirer l'option ${i + 1}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-primary hover:underline ml-6">
        <Plus className="h-3.5 w-3.5" /> Ajouter une option
      </button>
    </div>
  );
}
