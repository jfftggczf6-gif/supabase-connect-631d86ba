// src/components/ba/AppelSelector.tsx
// Sélecteur d'appel à candidatures actif pour le workspace BA.
// shadcn Select avec : nom + dot statut + nb candidatures par appel.
// Scalable jusqu'à ~50+ appels (vs onglets qui cassent à >5).

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { BaProgramme } from '@/types/candidature-ba';

interface Props {
  programmes: BaProgramme[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Map programmeId -> nombre de candidatures (optionnel, affichage). */
  candidatureCounts?: Record<string, number>;
  disabled?: boolean;
}

function StatusDot({ status }: { status: BaProgramme['status'] }) {
  const cls =
    status === 'in_progress' ? 'bg-emerald-500'
    : status === 'closed' ? 'bg-amber-500'
    : status === 'completed' ? 'bg-blue-500'
    : status === 'lost' ? 'bg-rose-500'
    : 'bg-muted-foreground';
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} aria-hidden="true" />;
}

function statusLabel(status: BaProgramme['status']): string {
  return status === 'in_progress' ? 'Actif'
    : status === 'closed' ? 'En pause'
    : status === 'completed' ? 'Terminé'
    : status === 'lost' ? 'Archivé'
    : 'Brouillon';
}

export default function AppelSelector({
  programmes, selectedId, onSelect, candidatureCounts, disabled,
}: Props) {
  if (programmes.length === 0) return null;

  const selected = programmes.find(p => p.id === selectedId);

  return (
    <Select
      value={selectedId ?? undefined}
      onValueChange={onSelect}
      disabled={disabled}
    >
      <SelectTrigger className="h-9 min-w-[260px] max-w-[420px]" data-testid="appel-selector">
        <SelectValue placeholder="Sélectionner un appel…">
          {selected && (
            <span className="flex items-center gap-2 text-sm">
              <StatusDot status={selected.status} />
              <span className="truncate font-medium">{selected.name}</span>
              {candidatureCounts?.[selected.id] != null && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  · {candidatureCounts[selected.id]} cand.
                </span>
              )}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {programmes.map(p => (
          <SelectItem key={p.id} value={p.id} className="py-2">
            <div className="flex items-start gap-2 max-w-[400px]">
              <span className="mt-1.5"><StatusDot status={p.status} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span>{statusLabel(p.status)}</span>
                  {candidatureCounts?.[p.id] != null && (
                    <>
                      <span>·</span>
                      <span>{candidatureCounts[p.id]} candidature{candidatureCounts[p.id] > 1 ? 's' : ''}</span>
                    </>
                  )}
                  {p.end_date && (
                    <>
                      <span>·</span>
                      <span>jusqu'au {new Date(p.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
