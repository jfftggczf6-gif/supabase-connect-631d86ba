// src/components/ba/MandatKanban.tsx
// Kanban BA — 5 colonnes lues depuis le preset (resolveStagesForRole).
// Drag & drop via @dnd-kit/core, invoke update-pe-deal-stage au drop.
//
// Permissions drag (brief critère 15) :
//   • Analyste            : drag désactivé partout
//   • Senior (IM)         : seule la transition recus → im autorisée
//   • Partner / MD / owner: toutes transitions autorisées
//
// Si le drop est refusé (pré-validation OU EF) → silent abort, la card revient
// à sa place. Pas de toast d'erreur — uniquement un toast succès en cas de move.
import { useState, useMemo, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Mandat } from '@/types/ba';
import type { StageDef } from '@/lib/pe-stage-config';
import MandatCard from './MandatCard';

interface Props {
  mandats: Mandat[];
  stages: StageDef[];
  role: string | null | undefined;
  myUserId?: string | null;
  onMandatClick?: (m: Mandat) => void;
  /** Appelé après une transition (success uniquement) pour resync depuis la DB. */
  onMandatMoved?: () => void;
}

function isAnalystRole(role: string | null | undefined): boolean {
  return role === 'analyst' || role === 'analyste';
}
function isSeniorRole(role: string | null | undefined): boolean {
  return role === 'investment_manager';
}

/** Politique brief critère 15 :
 *  - Analyste : pas de drag du tout (mais cette fonction est appelée en
 *    backup ; la prop dragDisabled est déjà à true sur les cards).
 *  - Senior   : seule la transition recus → im est autorisée.
 *  - Partner  : tout autorisé. */
function canDragTransition(
  role: string | null | undefined,
  fromStage: string,
  toStage: string,
): boolean {
  if (isAnalystRole(role)) return false;
  if (isSeniorRole(role)) return fromStage === 'recus' && toStage === 'im';
  return true;
}

function Column({
  stage, label, count, children,
}: {
  stage: string; label: string; count: number; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[220px] max-w-[260px] bg-muted/30 rounded-lg p-2 transition-colors ${isOver ? 'ring-2 ring-primary bg-muted/50' : ''}`}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
        {children}
      </div>
    </div>
  );
}

function DraggableMandatCard({
  mandat, active, dragDisabled, onClick,
}: {
  mandat: Mandat;
  /** Visuel : false = grisé (analyste sur mandats d'autres). */
  active: boolean;
  /** Bloque le drag (UI ne capture pas le pointer pour drag). */
  dragDisabled: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: mandat.id,
    disabled: dragDisabled,
  });
  // Pendant le drag, l'élément d'origine est masqué (l'overlay le remplace).
  const style: React.CSSProperties = isDragging
    ? { opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden', pointerEvents: 'none' }
    : transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : {};
  const cursor = !active
    ? ''
    : dragDisabled
      ? 'cursor-pointer'
      : 'cursor-grab active:cursor-grabbing touch-none';
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cursor}
      {...attributes}
      {...listeners}
    >
      <MandatCard mandat={mandat} active={active} onClick={onClick} />
    </div>
  );
}

export default function MandatKanban({
  mandats, stages, role, myUserId, onMandatClick, onMandatMoved,
}: Props) {
  const isAnalyst = isAnalystRole(role);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Overrides locaux pour l'optimistic update.
  // Clé = deal_id, valeur = nouveau stage. Vidé après resync via onMandatMoved.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  const displayedMandats = useMemo(() => {
    if (Object.keys(overrides).length === 0) return mandats;
    return mandats.map(m => overrides[m.id] ? { ...m, stage: overrides[m.id] } : m);
  }, [mandats, overrides]);

  const mandatsByStage = useCallback(
    (code: string) => displayedMandats.filter(m => m.stage === code),
    [displayedMandats],
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const dealId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || !overId.startsWith('col-')) return;
    const toStage = overId.replace('col-', '');
    const mandat = displayedMandats.find(m => m.id === dealId);
    if (!mandat || mandat.stage === toStage) return;

    // Pré-validation rôle (silent abort si non autorisé).
    if (!canDragTransition(role, mandat.stage, toStage)) return;

    // Optimistic : la card bouge immédiatement.
    setOverrides(prev => ({ ...prev, [dealId]: toStage }));

    const { error, data } = await supabase.functions.invoke('update-pe-deal-stage', {
      body: { deal_id: dealId, new_stage: toStage },
    });

    // Reset override (la DB est source de vérité après reload).
    setOverrides(prev => {
      const next = { ...prev };
      delete next[dealId];
      return next;
    });

    if (error || (data as any)?.error) {
      // Silent rollback : pas de toast, card revient à sa place via reload.
      onMandatMoved?.();
      return;
    }

    const label = stages.find(s => s.code === toStage)?.label ?? toStage;
    toast.success(`Mandat passé en ${label}`);
    onMandatMoved?.();
  };

  const activeMandat = activeId ? displayedMandats.find(m => m.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map(s => {
          const items = mandatsByStage(s.code);
          return (
            <Column key={s.code} stage={s.code} label={s.label} count={items.length}>
              {items.map(m => {
                const isMine = !isAnalyst || m.lead_analyst_id === myUserId;
                // Drag désactivé pour :
                //  - analyste (toujours)
                //  - cards grisées (mandats d'autres analystes)
                const dragDisabled = isAnalyst || !isMine;
                return (
                  <DraggableMandatCard
                    key={m.id}
                    mandat={m}
                    active={isMine}
                    dragDisabled={dragDisabled}
                    onClick={isMine ? () => onMandatClick?.(m) : undefined}
                  />
                );
              })}
              {items.length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-4 italic">
                  Vide
                </div>
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeMandat && <MandatCard mandat={activeMandat} active />}
      </DragOverlay>
    </DndContext>
  );
}
