// PePipelineKanban — composant kanban pur (sans DashboardLayout) extrait de PePipelinePage
// Utilisable dans PeWorkspacePage (onglet Synthèse) ou comme page standalone via PePipelinePage
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { toast } from 'sonner';
import PeDealCard from '@/components/pe/PeDealCard';
import CreateDealDialog from '@/components/pe/CreateDealDialog';
import StageTransitionDialog from '@/components/pe/StageTransitionDialog';
import { getStagesForRole, SENSITIVE_TRANSITIONS, canTransition, type PeStage } from '@/lib/pe-stage-config';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

export interface KanbanDeal {
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
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {children}
      </div>
    </div>
  );
}

interface Props {
  /** Si true, masque les boutons "+ Nouveau deal" et "Équipe" (utile dans onglet Synthèse où header est ailleurs). */
  hideHeader?: boolean;
  /** Callback à chaque rechargement de deals (utile pour parent qui veut refresh KPIs). */
  onDealsLoaded?: (deals: KanbanDeal[]) => void;
}

export default function PePipelineKanban({ hideHeader = false, onDealsLoaded }: Props) {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { role } = useCurrentRole();
  const COLUMNS = useMemo(() => getStagesForRole(role).map(s => ({ stage: s.code, label: s.label })), [role]);
  const [deals, setDeals] = useState<KanbanDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{ deal: KanbanDeal; toStage: string } | null>(null);
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

    const enrichedDeals = ((dealsData || []) as any[]).map((d: any) => ({
      ...d,
      enterprise_name: d.enterprise_id ? (entMap.get(d.enterprise_id) || null) : null,
      lead_analyst_initials: initials(profMap.get(d.lead_analyst_id) || null),
    }));
    setDeals(enrichedDeals);
    onDealsLoaded?.(enrichedDeals);
    setLoading(false);
  }, [currentOrg, onDealsLoaded]);

  useEffect(() => { load(); }, [load]);

  const performTransition = async (
    deal: KanbanDeal,
    toStage: string,
    extras: { lostReason?: string; icDecision?: any } = {},
  ) => {
    const fromStage = deal.stage;
    const { error, data } = await supabase.functions.invoke('update-pe-deal-stage', {
      body: { deal_id: deal.id, new_stage: toStage, lost_reason: extras.lostReason, ic_decision: extras.icDecision },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Erreur');
      load();
      return;
    }
    toast.success(`Deal passé en ${toStage}`);

    if (toStage === 'note_ic1' && fromStage === 'pre_screening') {
      try {
        const token = await getValidAccessToken(null);
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ic1-memo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ deal_id: deal.id }),
        });
        const result = await resp.json();
        if (resp.ok) {
          toast.success(result.already_exists ? 'Note IC1 existait déjà' : 'Note IC1 enrichie');
        } else {
          toast.warning(`Note IC1 non générée : ${result.error}`);
        }
      } catch (e: any) {
        toast.warning(`Note IC1 non générée : ${e.message}`);
      }
    }
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

    const check = canTransition(role, deal.stage, toStage);
    if (!check.allowed) {
      toast.warning(check.reason ?? 'Transition non autorisée pour ton rôle');
      return;
    }

    if (SENSITIVE_TRANSITIONS.has(toStage as PeStage)) {
      setPendingTransition({ deal, toStage });
    } else {
      performTransition(deal, toStage);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const dealsByStage = (stage: string) => deals.filter(d => d.stage === stage);
  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null;

  return (
    <>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deals.length}</span> deal{deals.length > 1 ? 's' : ''} actif{deals.length > 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            {role !== 'analyste' && role !== 'analyst' && (
              <Button variant="outline" onClick={() => navigate('/pe/team')}>Équipe</Button>
            )}
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nouveau deal
            </Button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map(c => (
            <Column key={c.stage} stage={c.stage} label={c.label} count={dealsByStage(c.stage).length}>
              {dealsByStage(c.stage).map(d => (
                <PeDealCard
                  key={d.id}
                  deal={d}
                  organizationId={currentOrg?.id}
                  onClick={() => navigate(`/pe/deals/${d.id}`)}
                  onRefresh={load}
                />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay>{activeDeal && <PeDealCard deal={activeDeal} organizationId={currentOrg?.id} onClick={() => {}} />}</DragOverlay>
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
          onConfirm={async (extras) => {
            await performTransition(pendingTransition.deal, pendingTransition.toStage, extras);
            setPendingTransition(null);
          }}
        />
      )}
    </>
  );
}
