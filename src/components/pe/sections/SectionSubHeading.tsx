// SectionSubHeading — sous-titre violet uppercase aligné sur la charte unifiée
// du memo PE. Pas de fonds coloré, juste une bordure violet à gauche.

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function SectionSubHeading({ children, className = '' }: Props) {
  return (
    <h4 className={`text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3 border-l-2 border-violet-600 pl-2 py-0.5 ${className}`}>
      {children}
    </h4>
  );
}
