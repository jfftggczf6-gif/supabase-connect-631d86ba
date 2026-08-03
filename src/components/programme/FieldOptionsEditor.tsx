import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

/**
 * Éditeur d'options façon Google Forms : une option par ligne, ajout / suppression / édition.
 * Utilisé pour les champs « Choix unique » (radio), « Choix multiples » (checkbox) et « Liste déroulante ».
 * Contrôlé : value/onChange. Garde toujours au moins une ligne affichée.
 *
 * Optionnel — « champ libre » par option : si `onFreeTextChange` est fourni, chaque option
 * gagne une case « champ libre » et (si cochée) un champ pour saisir le libellé d'invite.
 * `freeTextOptions` = { valeur d'option → libellé d'invite ("" = « Précisez… » par défaut) }.
 * Un bouton « + Ajouter une option "Autre" » ajoute une option pré-cochée.
 */
export function FieldOptionsEditor({
  value,
  onChange,
  freeTextOptions,
  onFreeTextChange,
}: {
  value: string[];
  onChange: (options: string[]) => void;
  freeTextOptions?: Record<string, string>;
  onFreeTextChange?: (ft: Record<string, string>) => void;
}) {
  const opts = value.length ? value : [""];
  const ft = freeTextOptions || {};
  const showFreeText = typeof onFreeTextChange === "function";

  const update = (i: number, val: string) => {
    const old = opts[i];
    onChange(opts.map((o, idx) => (idx === i ? val : o)));
    // Migration de la clé freeText si l'option renommée en avait une.
    if (showFreeText && old in ft && old !== val) {
      const next = { ...ft };
      const label = next[old];
      delete next[old];
      if (val) next[val] = label;
      onFreeTextChange!(next);
    }
  };
  const add = () => onChange([...opts, ""]);
  const remove = (i: number) => {
    const removed = opts[i];
    onChange(opts.filter((_, idx) => idx !== i));
    if (showFreeText && removed in ft) {
      const next = { ...ft };
      delete next[removed];
      onFreeTextChange!(next);
    }
  };
  const toggleFreeText = (opt: string, on: boolean) => {
    if (!showFreeText) return;
    const next = { ...ft };
    if (on) next[opt] = next[opt] ?? "";
    else delete next[opt];
    onFreeTextChange!(next);
  };
  const setFreeTextLabel = (opt: string, label: string) => {
    if (!showFreeText) return;
    onFreeTextChange!({ ...ft, [opt]: label });
  };
  const addAutre = () => {
    onChange([...opts.filter(Boolean), "Autre"]);
    if (showFreeText) onFreeTextChange!({ ...ft, Autre: ft["Autre"] ?? "" });
  };

  return (
    <div className="space-y-1.5">
      {opts.map((o, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-4 text-right">{i + 1}.</span>
            <Input
              value={o}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="h-8 text-sm flex-1"
              aria-label={`Option ${i + 1}`}
            />
            {showFreeText && (
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={o in ft}
                  onChange={(e) => toggleFreeText(o, e.target.checked)}
                  aria-label={`Champ libre pour l'option ${i + 1}`}
                />
                champ libre
              </label>
            )}
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
          {showFreeText && o in ft && (
            <Input
              value={ft[o]}
              onChange={(e) => setFreeTextLabel(o, e.target.value)}
              placeholder="Précisez…"
              aria-label={`Libellé du champ libre pour l'option ${i + 1}`}
              className="h-7 text-xs ml-6"
            />
          )}
        </div>
      ))}
      <div className="flex items-center gap-4 ml-6">
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Ajouter une option
        </button>
        {showFreeText && (
          <button type="button" onClick={addAutre} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Ajouter une option « Autre »
          </button>
        )}
      </div>
    </div>
  );
}
