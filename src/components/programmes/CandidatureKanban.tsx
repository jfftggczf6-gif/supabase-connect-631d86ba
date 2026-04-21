import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const COLUMN_IDS = [
  { id: 'received', labelKey: 'candidature.received', color: 'bg-violet-50 border-violet-200' },
  { id: 'pre_selected', labelKey: 'candidature.pre_selected', color: 'bg-violet-50 border-violet-200' },
  { id: 'selected', labelKey: 'candidature.selected', color: 'bg-emerald-50 border-emerald-200' },
  { id: 'rejected', labelKey: 'candidature.rejected', color: 'bg-red-50 border-red-200' },
];

// Map legacy statuses to display columns
function getColumnId(status: string): string {
  if (status === 'in_review' || status === 'waitlisted') return 'received';
  return status;
}

interface Candidature {
  id: string;
  company_name: string;
  status: string;
  screening_score?: number | null;
  contact_email?: string;
  assigned_coach_id?: string | null;
}

function DroppableColumn({ col, children }: { col: typeof COLUMN_IDS[number]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-2 space-y-2 transition-colors ${col.color} ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
    >
      {children}
    </div>
  );
}

function KanbanCard({ c, onClick }: { c: Candidature; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    data: { type: 'card', status: c.status },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow" onClick={onClick}>
        <p className="font-medium text-sm truncate">{c.company_name || 'Sans nom'}</p>
        <div className="flex items-center gap-2 mt-1">
          {c.screening_score != null && (
            <Badge variant="outline" className={c.screening_score >= 70 ? 'border-emerald-300 text-emerald-700' : c.screening_score >= 40 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}>
              {c.screening_score}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}

function OverlayCard({ c }: { c: Candidature }) {
  return (
    <Card className="p-3 shadow-lg cursor-grabbing w-48">
      <p className="font-medium text-sm truncate">{c.company_name || 'Sans nom'}</p>
      {c.screening_score != null && (
        <Badge variant="outline" className="mt-1 text-xs">{c.screening_score}</Badge>
      )}
    </Card>
  );
}

interface Props {
  candidatures: Candidature[];
  onCardClick: (id: string) => void;
  onRefresh: () => void;
}

export default function CandidatureKanban({ candidatures, onCardClick, onRefresh }: Props) {
  const { t } = useTranslation();
  const [confirmReject, setConfirmReject] = useState<{ id: string; name: string } | null>(null);
  const [activeCard, setActiveCard] = useState<Candidature | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const moveCard = async (id: string, newStatus: string) => {
    const { data, error } = await supabase.functions.invoke('update-candidature', {
      body: { candidature_id: id, action: 'move', new_status: newStatus }
    });
    if (error || data?.error) {
      toast({ title: t('common.error'), description: data?.error || error?.message || t('common.error'), variant: 'destructive' });
      return;
    }
    toast({ title: t('candidature.status_updated') });
    onRefresh();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const card = candidatures.find(c => c.id === event.active.id);
    setActiveCard(card || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    // Check if dropped on a column directly
    const targetColumn = COLUMN_IDS.find(c => c.id === overId);
    // Or dropped on another card — find which column that card is in
    let targetStatus = targetColumn?.id;
    if (!targetStatus) {
      const overCard = candidatures.find(c => c.id === overId);
      if (overCard) targetStatus = getColumnId(overCard.status);
    }
    if (!targetStatus) return;

    const card = candidatures.find(c => c.id === active.id);
    if (!card || getColumnId(card.status) === targetStatus) return;

    if (targetStatus === 'rejected') {
      setConfirmReject({ id: card.id, name: card.company_name });
    } else if (targetStatus === 'selected') {
      // Selection requires coach assignment — must go through drawer
      toast({ title: t('candidature.assign_coach_required'), description: t('candidature.assign_coach_required_desc') });
    } else {
      moveCard(card.id, targetStatus);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-3 min-h-[400px]">
          {COLUMN_IDS.map(col => {
            const items = candidatures.filter(c => getColumnId(c.status) === col.id);
            return (
              <DroppableColumn key={col.id} col={col}>
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wide">{t(col.labelKey)}</h4>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 min-h-[50px]">
                    {items.map(c => (
                      <KanbanCard key={c.id} c={c} onClick={() => onCardClick(c.id)} />
                    ))}
                  </div>
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeCard ? <OverlayCard c={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      <AlertDialog open={!!confirmReject} onOpenChange={() => setConfirmReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('candidature.confirm_reject')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('candidature.confirm_reject_desc', { name: confirmReject?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmReject) { moveCard(confirmReject.id, 'rejected'); setConfirmReject(null); } }}>
              {t('candidature.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
