import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DefaultFieldConfig, DefaultFieldControl, DefaultFieldKey } from "@/lib/default-fields";

const CONTROL_LABEL: Record<DefaultFieldControl, string> = {
  text: "Texte",
  email: "Email",
  tel: "Téléphone",
  country: "Pays (liste)",
  sector: "Secteur (liste)",
};

/**
 * Éditeur des champs par défaut. Les champs cœur (locked) sont toujours affichés + obligatoires
 * (seul le libellé est éditable) ; les autres sont activables et requis/optionnels.
 */
export function DefaultFieldsEditor({
  value,
  onChange,
}: {
  value: DefaultFieldConfig[];
  onChange: (fields: DefaultFieldConfig[]) => void;
}) {
  const patch = (key: DefaultFieldKey, p: Partial<DefaultFieldConfig>) =>
    onChange(value.map((f) => (f.key === key ? { ...f, ...p } : f)));

  return (
    <div className="space-y-2">
      {value.map((f) => (
        <div key={f.key} className="flex items-center gap-2 p-2 border rounded-md">
          <Input
            value={f.label}
            onChange={(e) => patch(f.key, { label: e.target.value })}
            className="flex-1 h-8 text-sm"
            aria-label={`Libellé ${f.key}`}
          />
          <Badge variant="outline" className="text-[10px] whitespace-nowrap">{CONTROL_LABEL[f.control]}</Badge>

          {/* Affiché / masqué */}
          {f.locked ? (
            <Badge variant="secondary" className="text-[10px] gap-1 whitespace-nowrap" title="Champ cœur : toujours présent">
              <Lock className="h-3 w-3" /> Toujours
            </Badge>
          ) : (
            <Badge
              variant={f.enabled ? "default" : "outline"}
              className="cursor-pointer text-[10px] whitespace-nowrap"
              onClick={() => patch(f.key, { enabled: !f.enabled })}
            >
              {f.enabled ? "Affiché" : "Masqué"}
            </Badge>
          )}

          {/* Obligatoire / optionnel */}
          <Badge
            variant={f.required ? "default" : "outline"}
            className={cn("text-[10px] whitespace-nowrap", f.locked || !f.enabled ? "opacity-50" : "cursor-pointer")}
            onClick={() => { if (!f.locked && f.enabled) patch(f.key, { required: !f.required }); }}
          >
            {f.required ? "Obligatoire" : "Optionnel"}
          </Badge>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Les champs <strong>Pays</strong> et <strong>Secteur</strong> utilisent nos listes déroulantes normalisées
        (stats fiables). « Nom de l'entreprise », « Nom du contact » et « Email » sont toujours requis.
      </p>
    </div>
  );
}
