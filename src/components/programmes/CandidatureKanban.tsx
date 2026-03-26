import { useState } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const COLUMNS = [
  { id: 'submitted', label: 'Reçues', color: 'bg-blue-50 border-blue-200' },
  { id: 'in_review', label: 'En revue', color: 'bg-amber-50 border-amber-200' },
  { id: 'pre_selected', label: 'Pré-sélectionnées', color: 'bg-violet-50 border-violet-200' },
  { id: 'rejected', label: 'Rejetées', color: 'bg-red-50 border-red-200' },
  { id: 'selected', label: 'Sélectionnées', color: 'bg-emerald-50 border-emerald-200' },
  { id: 'waitlist', label: "Liste d'attente", color: 'bg-gray-50 border-gray-200' },
];

interface Candidature {
  id: string;
  company_name: string;
  status: string;
  screening_score?: number | null;
  contact_email?: string;
  assigned_coach_id?: string | null;
}

function KanbanCard({ c, onClick }: { c: Candidature; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: c.id, data: { status: c.status } });
  const style = { transform: CSS.Transform.toString(transform), transition };

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

interface Props {
  candidatures: Candidature[];
  onCardClick: (id: string) => void;
  onRefresh: () => void;
}

export default function CandidatureKanban({ candidatures, onCardClick, onRefresh }: Props) {
  const [confirmReject, setConfirmReject] = useState<{ id: string; name: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const moveCard = async (id: string, newStatus: string) => {
    const { error } = await supabase.functions.invoke('update-candidature', {
      body: { id, status: newStatus }
    });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Statut mis à jour' });
    onRefresh();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = over.id as string;
    const targetColumn = COLUMNS.find(c => c.id === overId);
    if (!targetColumn) return;
    const card = candidatures.find(c => c.id === active.id);
    if (!card || card.status === targetColumn.id) return;

    if (targetColumn.id === 'rejected') {
      setConfirmReject({ id: card.id, name: card.company_name });
    } else {
      moveCard(card.id, targetColumn.id);
    }
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-6 gap-3 min-h-[400px]">
          {COLUMNS.map(col => {
            const items = candidatures.filter(c => c.status === col.id);
            return (
              <div key={col.id} className={`rounded-lg border p-2 space-y-2 ${col.color}`} id={col.id}>
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wide">{col.label}</h4>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 min-h-[50px]" id={col.id}>
                    {items.map(c => (
                      <KanbanCard key={c.id} c={c} onClick={() => onCardClick(c.id)} />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>

      <AlertDialog open={!!confirmReject} onOpenChange={() => setConfirmReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le rejet</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous rejeter la candidature de <strong>{confirmReject?.name}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmReject) { moveCard(confirmReject.id, 'rejected'); setConfirmReject(null); } }}>
              Rejeter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
