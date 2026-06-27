import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Rendu Markdown stylé selon le design system (shadcn/Tailwind). Interprète la STRUCTURE du texte
 * (titres, paragraphes, listes, gras, liens) au lieu de l'afficher d'un bloc avec des `*`/`#` littéraux.
 * Supporte aussi les images Markdown `![alt](url)` (logos incorporables au fil du texte si besoin).
 *
 * GFM activé (remark-gfm) : tirets `-` ou `*` pour les puces, `1.` pour les listes ordonnées, etc.
 */
export function Markdown({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return <div className={className} />;
  return (
    <div className={cn("text-left space-y-3", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...p }) => <h2 className="text-lg font-display font-semibold text-foreground mt-5 mb-1.5" {...p} />,
          h2: ({ node, ...p }) => <h3 className="text-base font-semibold text-foreground mt-5 mb-1.5" {...p} />,
          h3: ({ node, ...p }) => <h4 className="text-sm font-semibold text-foreground mt-4 mb-1" {...p} />,
          p: ({ node, ...p }) => <p className="text-sm text-muted-foreground leading-relaxed" {...p} />,
          ul: ({ node, ...p }) => <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground" {...p} />,
          ol: ({ node, ...p }) => <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground" {...p} />,
          li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
          strong: ({ node, ...p }) => <strong className="font-semibold text-foreground" {...p} />,
          em: ({ node, ...p }) => <em className="italic" {...p} />,
          a: ({ node, ...p }) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
          img: ({ node, ...p }) => <img className="inline-block max-h-12 align-middle my-1" {...p} />,
          blockquote: ({ node, ...p }) => <blockquote className="border-l-2 pl-3 italic text-muted-foreground" {...p} />,
          hr: () => <hr className="my-5" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
