import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import PeDealCard from '@/components/pe/PeDealCard';
import CreateDealDialog from '@/components/pe/CreateDealDialog';
import StageTransitionDialog from '@/components/pe/StageTransitionDialog';

const COLUMNS: { stage: string; label: string }[] = [
  { stage: 'sourcing', label: 'Sourcing' },
  { stage: 'pre_screening', label: 'Pre-screening' },
  { stage: 'analyse', label: 'Analyse' },
  { stage: 'ic1', label: 'IC1' },
  { stage: 'dd', label: 'DD' },
  { stage: 'ic_finale', label: 'IC finale' },
  { stage: 'closing', label: 'Closing' },
  { stage: 'portfolio', label: 'Portfolio' },
];

const SENSITIVE_TRANSITIONS = new Set(['ic1', 'dd', 'ic_finale', 'closing', 'lost']);

interface Deal {
  id: string;
  deal_ref: string;
  enterprise_id: string | null;
  enterprise_name?: string | null;
  stage: string;
  ticket_demande: number | null;
  currency: string | null;
  lead_analyst_id: string | null;
  lead_analyst_initials?: string;
  score_360: number | null;
}

function Column({ stage, label, count, children }: { stage: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}` });
  return (
    <div ref={setNodeRef}
      className={`flex flex-col min-w-[220px] max-w-[260px] bg-muted/30 rounded-lg p-2 ${isOver ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 230px)' }}>
        {children}
      </div>
    </div>
  );
}

export default function PePipelinePage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{ deal: Deal; toStage: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    const { data: dealsData } = await supabase
      .from('pe_deals')
      .select('id, deal_ref, enterprise_id, stage, ticket_demande, currency, lead_analyst_id, score_360')
      .eq('organization_id', currentOrg.id)
      .neq('stage', 'lost')
      .order('created_at', { ascending: false });

    const entIds = [...new Set(((dealsData || []) as any[]).map((d: any) => d.enterprise_id).filter(Boolean))] as string[];
    const userIds = [...new Set(((dealsData || []) as any[]).map((d: any) => d.lead_analyst_id).filter(Boolean))] as string[];

    const [{ data: ents }, { data: profs }] = await Promise.all([
      entIds.length ? supabase.from('enterprises').select('id, name').in('id', entIds) : Promise.resolve({ data: [] as any[] }),
      userIds.length ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const entMap = new Map((ents || []).map((e: any) => [e.id, e.name]));
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    const initials = (name: string | null) => {
      if (!name) return '??';
      return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
    };

    setDeals(((dealsData || []) as any[]).map((d: any) => ({
      ...d,
      enterprise_name: d.enterprise_id ? (entMap.get(d.enterprise_id) || null) : null,
      lead_analyst_initials: initials(profMap.get(d.lead_analyst_id) || null),
    })));
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const performTransition = async (deal: Deal, toStage: string, lostReason?: string) => {
    const { error, data } = await supabase.functions.invoke('update-pe-deal-stage', {
      body: { deal_id: deal.id, new_stage: toStage, lost_reason: lostReason },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Erreur');
      load();
      return;
    }
    toast.success(`Deal passé en ${toStage}`);
    load();
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const dealId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || !overId.startsWith('col-')) return;
    const toStage = overId.replace('col-', '');
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage === toStage) return;

    if (SENSITIVE_TRANSITIONS.has(toStage)) {
      setPendingTransition({ deal, toStage });
    } else {
      performTransition(deal, toStage);
    }
  };

  if (loading) return <DashboardLayout title="Pipeline PE"><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></DashboardLayout>;

  const dealsByStage = (stage: string) => deals.filter(d => d.stage === stage);
  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null;

  return (
    <DashboardLayout title="Pipeline PE" subtitle={currentOrg?.name || ''}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{deals.length}</span> deal{deals.length > 1 ? 's' : ''} actif{deals.length > 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/pe/team')}>Équipe</Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau deal
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map(c => (
            <Column key={c.stage} stage={c.stage} label={c.label} count={dealsByStage(c.stage).length}>
              {dealsByStage(c.stage).map(d => (
                <PeDealCard key={d.id} deal={d} onClick={() => navigate(`/pe/deals/${d.id}`)} />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay>{activeDeal && <PeDealCard deal={activeDeal} onClick={() => {}} />}</DragOverlay>
      </DndContext>

      {currentOrg && user && (
        <CreateDealDialog open={showCreate} onOpenChange={setShowCreate}
          organizationId={currentOrg.id} currentUserId={user.id} onCreated={load} />
      )}

      {pendingTransition && (
        <StageTransitionDialog
          open={!!pendingTransition}
          onOpenChange={(open) => { if (!open) setPendingTransition(null); }}
          fromStage={pendingTransition.deal.stage}
          toStage={pendingTransition.toStage}
          dealRef={pendingTransition.deal.deal_ref}
          onConfirm={async (reason) => {
            await performTransition(pendingTransition.deal, pendingTransition.toStage, reason);
            setPendingTransition(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
