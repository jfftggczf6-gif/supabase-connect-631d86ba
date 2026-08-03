import { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/**
 * Enveloppe un champ du constructeur de formulaire pour le rendre déplaçable
 * (glisser-déposer via @dnd-kit). Affiche une poignée à gauche ; le reste du champ
 * (libellé, type, options…) est passé en `children`. L'`id` = l'id stable du champ,
 * donc déplacer ne perd rien (options, champ-libre, traductions restent attachés).
 */
export function SortableFormField({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Réordonner ce champ"
          title="Glisser pour réordonner"
          className="mt-2 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
