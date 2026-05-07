// NarrativeBlock — sous-section dans un encadré gris clair, titre violet au-dessus.
// Pattern aligné sur le Business Plan du volet programme (approche narrative
// avec encadrés gris par section).

interface Props {
  title?: React.ReactNode;
  /** Si true, le titre est rendu inline avec une bordure-l violette plutôt qu'au-dessus. */
  inlineTitle?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function NarrativeBlock({ title, children, className = '' }: Props) {
  return (
    <div className={className}>
      {title && (
        <h4 className="text-sm font-semibold text-violet-700 mb-2">
          {title}
        </h4>
      )}
      <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
