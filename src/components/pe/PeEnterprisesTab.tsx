// PeEnterprisesTab — onglet "Entreprises" : tableau détaillé du portefeuille fonds
// Plan colonnes : Entreprise / Secteur / Pays / Status / Score IR / Source / Analyste /
//                 Responsable / Activité / menu 3-points / flèche
// Filtres : recherche nom, phase, lead, pays, secteur, source. Tri. Export CSV.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Loader2, AlertTriangle, ArrowRight, ChevronUp, ChevronDown, MoreHorizontal, Pencil, XCircle, Eye, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PeDealStatusBadge from '@/components/pe/PeDealStatusBadge';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useAuth } from '@/hooks/useAuth';
import CreateDealDialog from './CreateDealDialog';

interface Row {
  deal_id: string;
  deal_ref: string;
  enterprise_id: string | null;
  enterprise_name: string;
  sector: string | null;
  country: string | null;
  lead_analyst_id: string | null;
  lead_analyst_name: string | null;
  responsable_name: string | null;
  stage: string;
  score_360: number | null;
  score_ir: number | null;
  ticket_demande: number | null;
  currency: string | null;
  source: string | null;
  source_detail: string | null;
  created_at: string;
  updated_at: string;
  alerts_count: number;
}

type SortKey = 'enterprise_name' | 'stage' | 'score_ir' | 'updated_at' | 'alerts_count';
type SortDir = 'asc' | 'desc';

interface Props {
  organizationId: string;
}

function scoreBadge(score: number | null) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = score >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-red-50 text-red-700 border-red-200';
  return <Badge variant="outline" className={cls}>{score}</Badge>;
}

export default function PeEnterprisesTab({ organizationId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useCurrentRole();
  const canDelete = ['owner', 'admin', 'manager'].includes(role || '');
  const canCreate = ['owner', 'admin', 'manager', 'managing_director', 'investment_manager', 'analyst', 'analyste'].includes(role || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Récupère les deals + enterprise jointe
    const { data: dealsData } = await supabase
      .from('pe_deals')
      .select('id, deal_ref, enterprise_id, stage, score_360, ticket_demande, currency, lead_analyst_id, source, source_detail, created_at, updated_at, enterprises(name, sector, country, score_ir)')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false });

    if (!dealsData) { setRows([]); setLoading(false); return; }

    // 2. Récupère le "responsable" du fonds = premier owner/admin/manager de l'org
    //    (en attendant une colonne dédiée pe_deals.responsible_im_id)
    const { data: orgMgrs } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .in('role', ['owner', 'admin', 'manager'])
      .eq('is_active', true)
      .order('role');
    const responsableUserId = orgMgrs?.[0]?.user_id ?? null;

    const userIds = [...new Set([
      ...dealsData.map((d: any) => d.lead_analyst_id).filter(Boolean),
      ...(responsableUserId ? [responsableUserId] : []),
    ])] as string[];
    const dealIds = dealsData.map((d: any) => d.id);

    const [{ data: profs }, { data: alerts }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : Promise.resolve({ data: [] as any[] }),
      dealIds.length
        ? (supabase.from('pe_alert_signals' as any).select('deal_id').in('deal_id', dealIds).is('resolved_at', null) as any)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    const alertCounts: Record<string, number> = {};
    (alerts || []).forEach((a: any) => { alertCounts[a.deal_id] = (alertCounts[a.deal_id] || 0) + 1; });

    setRows(dealsData.map((d: any) => ({
      deal_id: d.id,
      deal_ref: d.deal_ref,
      enterprise_id: d.enterprise_id,
      enterprise_name: d.enterprises?.name ?? d.deal_ref,
      sector: d.enterprises?.sector ?? null,
      country: d.enterprises?.country ?? null,
      lead_analyst_id: d.lead_analyst_id,
      lead_analyst_name: profMap.get(d.lead_analyst_id) ?? null,
      responsable_name: responsableUserId ? (profMap.get(responsableUserId) ?? null) : null,
      stage: d.stage,
      score_360: d.score_360,
      score_ir: d.enterprises?.score_ir ?? null,
      ticket_demande: d.ticket_demande,
      currency: d.currency,
      source: d.source,
      source_detail: d.source_detail,
      created_at: d.created_at,
      updated_at: d.updated_at ?? d.created_at,
      alerts_count: alertCounts[d.id] ?? 0,
    })));
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  // Tri uniquement (pas de filtres — barre de filtres retirée).
  const filtered = useMemo(() => {
    const res = [...rows];
    res.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return res;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    col === sortKey ? (sortDir === 'asc' ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />) : null;

  const markAsLost = async (deal: Row) => {
    const reason = window.prompt(`Marquer "${deal.enterprise_name}" comme perdu. Motif (obligatoire) :`);
    if (!reason || !reason.trim()) return;
    const { error } = await supabase.functions.invoke('update-pe-deal-stage', {
      body: { deal_id: deal.deal_id, new_stage: 'lost', lost_reason: reason.trim() },
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Deal marqué comme perdu');
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* CTA Nouveau Deal — remplace la barre de filtres */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} deal{rows.length !== 1 ? 's' : ''} dans le portefeuille
        </p>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau Deal
          </Button>
        )}
      </div>

      {user?.id && (
        <CreateDealDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={organizationId}
          currentUserId={user.id}
          onCreated={load}
        />
      )}

      {/* Tableau */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('enterprise_name')}>
                  Entreprise <SortIcon col="enterprise_name" />
                </TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Pays</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('stage')}>
                  Status <SortIcon col="stage" />
                </TableHead>
                <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort('score_ir')}>
                  Score IR <SortIcon col="score_ir" />
                </TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Analyste</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('updated_at')}>
                  Activité <SortIcon col="updated_at" />
                </TableHead>
                <TableHead className="text-center">Alertes</TableHead>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    {rows.length === 0 ? 'Aucune entreprise dans ce fonds.' : 'Aucune entreprise ne correspond aux filtres.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.deal_id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div>{r.enterprise_name}</div>
                      <div className="text-xs text-muted-foreground">{r.deal_ref}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.sector ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{r.country ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><PeDealStatusBadge stage={r.stage} /></TableCell>
                    <TableCell className="text-center">{scoreBadge(r.score_ir)}</TableCell>
                    <TableCell className="text-sm">
                      {r.source ? (
                        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
                          {r.source}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{r.lead_analyst_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.responsable_name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {r.updated_at ? new Date(r.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.alerts_count > 0 ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                          <AlertTriangle className="h-3 w-3" /> {r.alerts_count}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/pe/deals/${r.deal_id}`)}>
                            <Eye className="h-4 w-4 mr-2" /> Voir le deal
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/pe/deals/${r.deal_id}?edit=1`)}>
                            <Pencil className="h-4 w-4 mr-2" /> Modifier
                          </DropdownMenuItem>
                          {canDelete && r.stage !== 'lost' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => markAsLost(r)} className="text-red-600 focus:text-red-700">
                                <XCircle className="h-4 w-4 mr-2" /> Marquer comme perdu
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/pe/deals/${r.deal_id}`)}>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
