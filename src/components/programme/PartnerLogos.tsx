import { cn } from "@/lib/utils";

export type PartnerLogo = { url: string; name?: string };

/**
 * Bande « Partenaires » (Option B) : une rangée de logos dédiée, séparée du texte de présentation,
 * affichée en bas de la page publique. N'apparaît que s'il y a au moins un logo valide ; les entrées
 * sans URL exploitable sont ignorées (pas d'<img> cassée).
 */
export function PartnerLogos({
  logos,
  label = "Avec le soutien de",
  className,
}: {
  logos?: PartnerLogo[] | null;
  label?: string;
  className?: string;
}) {
  const valid = (logos || []).filter((l) => l && typeof l.url === "string" && l.url.trim().length > 0);
  if (valid.length === 0) return null;

  return (
    <div className={cn("mt-10 pt-6 border-t", className)}>
      <p className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-4">
        {label}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
        {valid.map((l, i) => (
          <img
            key={`${l.url}-${i}`}
            src={l.url}
            alt={l.name || ""}
            title={l.name || undefined}
            className="h-12 max-w-[150px] object-contain"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}
