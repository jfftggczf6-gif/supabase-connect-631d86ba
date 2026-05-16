// src/pages/ba/BaPipelinePage.tsx
// Page principale du pipeline BA (mandats).
// Adapte la vue selon le rôle :
//   - analyst : voit ses mandats (autres grisés), KPIs perso
//   - investment_manager (Senior) : voit mandats des analystes assignés + KPIs Senior + vue conso S3
//   - managing_director / owner / admin / super_admin (Partner) : voit tout + onglets

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useOrgPreset } from '@/hooks/useOrgPreset';
import { resolveStagesForRole } from '@/lib/pe-stage-config';
import type { Mandat, ViewMode } from '@/types/ba';
import MandatKpiHeader from '@/components/ba/MandatKpiHeader';
import MandatKanban from '@/components/ba/MandatKanban';
import MandatTable from '@/components/ba/MandatTable';
import CreateMandatDialog from '@/components/ba/CreateMandatDialog';
import RecentActivity from '@/components/ba/RecentActivity';
import SeniorConsoView from '@/components/ba/SeniorConsoView';

export default function BaPipelinePage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { role } = useCurrentRole();
  const { workflow, loading: presetLoading } = useOrgPreset();

  const [mandats, setMandats] = useState<Mandat[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('kanban');
  const [showCreate, setShowCreate] = useState(false);

  const isAnalyst = role === 'analyst' || role === 'analyste';
  const isSenior = role === 'investment_manager';
  const isPartner = ['managing_director', 'owner', 'admin', 'partner'].includes(role || '');

  const stages = useMemo(
    () => resolveStagesForRole(role, workflow),
    [role, workflow],
  );

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    const { data: dealsData } = await supabase
      .from('pe_deals')
      .select('id, deal_ref, enterprise_id, stage, ticket_demande, currency, lead_analyst_id, lead_im_id, score_360, source, created_at, updated_at')
      .eq('organization_id', currentOrg.id)
      .eq('source', 'mandat_ba')
      .neq('stage', 'lost')
      .order('created_at', { ascending: false });

    const entIds = [...new Set(((dealsData || []) as any[]).map((d: any) => d.enterprise_id).filter(Boolean))] as string[];
    const userIds = [...new Set([
      ...((dealsData || []) as any[]).map((d: any) => d.lead_analyst_id),
      ...((dealsData || []) as any[]).map((d: any) => d.lead_im_id),
    ].filter(Boolean))] as string[];

    const [{ data: ents }, { data: profs }] = await Promise.all([
      entIds.length ? supabase.from('enterprises').select('id, name, sector, country').in('id', entIds) : Promise.resolve({ data: [] as any[] }),
      userIds.length ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const entMap = new Map((ents || []).map((e: any) => [e.id, e]));
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

    const initials = (name: string | null) => {
      if (!name) return '??';
      return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
    };

    setMandats(((dealsData || []) as any[]).map((d: any) => {
      const ent = d.enterprise_id ? entMap.get(d.enterprise_id) : null;
      const analystName = d.lead_analyst_id ? profMap.get(d.lead_analyst_id) ?? null : null;
      const imName = d.lead_im_id ? profMap.get(d.lead_im_id) ?? null : null;
      return {
        id: d.id,
        deal_ref: d.deal_ref,
        enterprise_id: d.enterprise_id,
        enterprise_name: ent?.name ?? null,
        sector: ent?.sector ?? null,
        country: ent?.country ?? null,
        stage: d.stage,
        ticket_demande: d.ticket_demande ?? null,
        currency: d.currency,
        lead_analyst_id: d.lead_analyst_id,
        lead_analyst_name: analystName,
        lead_analyst_initials: initials(analystName),
        lead_im_id: d.lead_im_id,
        lead_im_name: imName,
        score_360: d.score_360,
        progress_pct: undefined,
        sections_in_review: 0,
        created_at: d.created_at,
        updated_at: d.updated_at,
      } as Mandat;
    }));
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  if (loading || presetLoading) {
    return (
      <DashboardLayout title="Pipeline mandats">
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  const subtitle = currentOrg?.name
    ? `${currentOrg.name}${isAnalyst ? ' · Mes mandats' : isSenior ? ' · Vue Senior' : ' · Tous les mandats'}`
    : '';

  return (
    <DashboardLayout title="Pipeline mandats" subtitle={subtitle}>
      <MandatKpiHeader role={role} mandats={mandats} myUserId={user?.id} />

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{mandats.length}</span>{' '}
          mandat{mandats.length > 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-md p-0.5">
            <Button
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setView('table')}
            >
              <TableIcon className="h-3.5 w-3.5" /> Table
            </Button>
          </div>
          {(isPartner || isSenior) && (
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nouveau mandat
            </Button>
          )}
        </div>
      </div>

      {view === 'kanban' ? (
        <MandatKanban
          mandats={mandats}
          stages={stages}
          role={role}
          myUserId={user?.id}
          onMandatClick={(m) => {
            // Pour l'instant pas de page detail BA, on pointe vers le deal PE générique
            window.location.href = `/pe/deals/${m.id}`;
          }}
        />
      ) : (
        <MandatTable
          mandats={mandats}
          role={role}
          myUserId={user?.id}
          onMandatClick={(m) => { window.location.href = `/pe/deals/${m.id}`; }}
        />
      )}

      {isSenior && <SeniorConsoView mandats={mandats} />}

      <RecentActivity organizationId={currentOrg?.id} limit={8} />

      {currentOrg && user && (
        <CreateMandatDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          organizationId={currentOrg.id}
          currentUserId={user.id}
          firstStage={stages[0]?.code ?? 'recus'}
          onCreated={load}
        />
      )}
    </DashboardLayout>
  );
}
