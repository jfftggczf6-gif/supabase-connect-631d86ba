// PeWorkspacePage — tableau de bord MD du fonds PE
// Layout type ProgrammeDetailPage : action bar top + onglets (Synthèse / Candidature /
// Entreprises / Reporting & Impact / Comité d'investissement / Équipe / Paramètres)
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, TrendingUp, BarChart3, MessageSquare, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import PePipelineKanban, { type KanbanDeal } from '@/components/pe/PePipelineKanban';
import PeDealStatusBadge from '@/components/pe/PeDealStatusBadge';
import PeIcCommitteeTab from '@/components/pe/PeIcCommitteeTab';
import PeEnterprisesTab from '@/components/pe/PeEnterprisesTab';
import PeCandidatureTab from '@/components/pe/PeCandidatureTab';
import PeReportingImpactTab from '@/components/pe/PeReportingImpactTab';
import PeParametersTab from '@/components/pe/PeParametersTab';
import PeTeamTab from '@/components/pe/PeTeamTab';
import StatCard from '@/components/shared/StatCard';

interface EnterpriseRow {
  deal_id: string;
  enterprise_id: string | null;
  enterprise_name: string;
  coach_name: string | null;
  score_ir: number | null;
  stage: string;
  alerts_count: number;
}

const TABS = [
  { value: 'synthese', label: 'Synthèse' },
  { value: 'candidature', label: 'Candidature' },
  { value: 'enterprises', label: 'Entreprises' },
  { value: 'reporting_impact', label: 'Reporting & Impact' },
  { value: 'ic_committee', label: 'Comité d\'investissement' },
  { value: 'equipe', label: 'Équipe' },
  { value: 'parametres', label: 'Paramètres' },
];

export default function PeWorkspacePage() {
  const { currentOrg } = useOrganization();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'synthese';

  const [deals, setDeals] = useState<KanbanDeal[]>([]);
  const [kpis, setKpis] = useState({
    enterprises: 0,
    avgScore: 0,
    completion: 0,
    coachingNotes: 0,
    alertsOpen: 0,
  });
  const [enterprisesTable, setEnterprisesTable] = useState<EnterpriseRow[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);

  // Recharge KPIs + tableau quand le pipeline charge ses deals
  const handleDealsLoaded = useCallback(async (loadedDeals: KanbanDeal[]) => {
    setDeals(loadedDeals);
    if (!currentOrg) return;

    // KPIs : enterprises actives = deals non-lost
    const totalDeals = loadedDeals.length;
    // Completion : % deals en portfolio ou exited / total
    const completed = loadedDeals.filter(d => ['portfolio', 'exit_prep', 'exited'].includes(d.stage)).length;
    const completion = totalDeals > 0 ? Math.round((completed / totalDeals) * 100) : 0;
    // Score moyen
    const scores = loadedDeals.map(d => d.score_360).filter(s => s != null) as number[];
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // Notes coaching count
    const dealIds = loadedDeals.map(d => d.id);
    const entIds = loadedDeals.map(d => d.enterprise_id).filter(Boolean) as string[];
    const [{ count: notesCount }, { count: alertsCount }] = await Promise.all([
      entIds.length
        ? supabase.from('coaching_notes').select('id', { count: 'exact', head: true }).in('enterprise_id', entIds)
        : Promise.resolve({ count: 0 }),
      dealIds.length
        ? supabase.from('pe_alert_signals').select('id', { count: 'exact', head: true })
            .in('deal_id', dealIds).is('resolved_at', null)
        : Promise.resolve({ count: 0 }),
    ]);

    setKpis({
      enterprises: totalDeals,
      avgScore,
      completion,
      coachingNotes: notesCount ?? 0,
      alertsOpen: alertsCount ?? 0,
    });
  }, [currentOrg]);

  // Charge le tableau "Entreprises du fonds" indépendamment du kanban
  const loadEnterprisesTable = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingTable(true);
    const { data: dealsData } = await supabase
      .from('pe_deals')
      .select('id, deal_ref, enterprise_id, stage, lead_analyst_id, enterprises(name, score_ir)')
      .eq('organization_id', currentOrg.id)
      .neq('stage', 'lost')
      .order('created_at', { ascending: false });

    if (!dealsData) { setLoadingTable(false); return; }

    const userIds = [...new Set(dealsData.map((d: any) => d.lead_analyst_id).filter(Boolean))] as string[];
    const dealIds = dealsData.map((d: any) => d.id);

    const [{ data: profs }, { data: alerts }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : Promise.resolve({ data: [] as any[] }),
      dealIds.length
        ? supabase.from('pe_alert_signals').select('deal_id').in('deal_id', dealIds).is('resolved_at', null)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    const alertCounts: Record<string, number> = {};
    (alerts || []).forEach((a: any) => { alertCounts[a.deal_id] = (alertCounts[a.deal_id] || 0) + 1; });

    setEnterprisesTable(dealsData.map((d: any) => ({
      deal_id: d.id,
      enterprise_id: d.enterprise_id,
      enterprise_name: d.enterprises?.name ?? d.deal_ref,
      coach_name: profMap.get(d.lead_analyst_id) ?? null,
      score_ir: d.enterprises?.score_ir ?? null,
      stage: d.stage,
      alerts_count: alertCounts[d.id] ?? 0,
    })));
    setLoadingTable(false);
  }, [currentOrg]);

  useEffect(() => { loadEnterprisesTable(); }, [loadEnterprisesTable]);

  if (!currentOrg) {
    return (
      <DashboardLayout title="Workspace PE">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Workspace PE" subtitle={currentOrg.name}>
      {/* Action bar — badge fonds actif uniquement, "+Nouveau deal" et "Équipe" gérés par le kanban */}
      <div className="flex items-center mb-4">
        <Badge variant="outline" className="gap-1 bg-violet-50 text-violet-700 border-violet-200">
          <span>🚀</span> Fonds actif
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
        <TabsList className="flex-wrap">
          {TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* === SYNTHÈSE === */}
        <TabsContent value="synthese" className="space-y-6 mt-4">
          {/* 1. Pipeline kanban en haut */}
          <PePipelineKanban onDealsLoaded={handleDealsLoaded} />

          {/* 2. KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard icon={Users} value={kpis.enterprises} label="Entreprises" iconColor="text-primary" />
            <StatCard icon={TrendingUp} value={kpis.avgScore || '—'} label="Score moyen" iconColor="text-emerald-500" />
            <StatCard icon={BarChart3} value={`${kpis.completion}%`} label="Completion" iconColor="text-violet-600" />
            <StatCard icon={MessageSquare} value={kpis.coachingNotes} label="Notes coaching" iconColor="text-purple-500" />
            <StatCard
              icon={AlertTriangle}
              value={kpis.alertsOpen}
              label="Alertes"
              iconColor="text-amber-500"
              highlight={kpis.alertsOpen > 0 ? 'amber' : undefined}
            />
          </div>

          {/* 3. Tableau "Entreprises du fonds" */}
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">Entreprises du fonds</h3>
              </div>
              {loadingTable ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : enterprisesTable.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Aucune entreprise active.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Lead analyste</TableHead>
                      <TableHead>Score IR</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-center">Alertes</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enterprisesTable.map(row => (
                      <TableRow key={row.deal_id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/pe/deals/${row.deal_id}`)}>
                        <TableCell className="font-medium">{row.enterprise_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.coach_name ?? '—'}</TableCell>
                        <TableCell>
                          {row.score_ir != null ? (
                            <Badge variant="outline" className={
                              row.score_ir >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : row.score_ir >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                            }>
                              {row.score_ir}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell><PeDealStatusBadge stage={row.stage} /></TableCell>
                        <TableCell className="text-center">
                          {row.alerts_count > 0 ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                              <AlertTriangle className="h-3 w-3" /> {row.alerts_count}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Autres onglets : placeholders pour MVP itératif === */}
        <TabsContent value="candidature" className="mt-4">
          <PeCandidatureTab organizationId={currentOrg.id} />
        </TabsContent>

        <TabsContent value="enterprises" className="mt-4">
          <PeEnterprisesTab organizationId={currentOrg.id} />
        </TabsContent>

        <TabsContent value="reporting_impact" className="mt-4">
          <PeReportingImpactTab organizationId={currentOrg.id} />
        </TabsContent>

        <TabsContent value="ic_committee" className="mt-4">
          <PeIcCommitteeTab organizationId={currentOrg.id} />
        </TabsContent>

        <TabsContent value="equipe" className="mt-4">
          <PeTeamTab organizationId={currentOrg.id} />
        </TabsContent>

        <TabsContent value="parametres" className="mt-4">
          <PeParametersTab organizationId={currentOrg.id} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
