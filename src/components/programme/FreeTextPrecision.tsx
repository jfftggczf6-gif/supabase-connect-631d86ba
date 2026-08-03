import { Input } from "@/components/ui/input";

/**
 * Champ(s) de précision « champ libre » sous une question à choix, dans le formulaire
 * public. Pour chaque valeur sélectionnée qui est marquée « champ libre »
 * (`field.freeTextOptions[value]`), affiche un input avec le libellé d'invite associé.
 *
 * Générique : `selected` est un tableau (1 élément pour select/radio, N pour checkbox),
 * donc le même composant gère les 3 types de questions.
 */
export function FreeTextPrecision({
  field,
  selected,
  precisions,
  onChange,
  defaultLabel = "Précisez…",
  labelFor,
}: {
  field: { label?: string; freeTextOptions?: Record<string, string> };
  selected: string[];
  precisions: Record<string, string>;
  onChange: (opt: string, val: string) => void;
  defaultLabel?: string;
  labelFor?: (opt: string) => string;
}) {
  const ft = field.freeTextOptions || {};
  const active = selected.filter((v) => v in ft);
  if (!active.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {active.map((opt) => (
        <Input
          key={opt}
          className="text-sm"
          placeholder={labelFor ? labelFor(opt) : ft[opt] || defaultLabel}
          value={precisions[opt] || ""}
          onChange={(e) => onChange(opt, e.target.value)}
          aria-label={`Précision pour ${opt}`}
        />
      ))}
    </div>
  );
}
