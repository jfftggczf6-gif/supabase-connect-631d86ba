import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import PeDealSidebar from '@/components/pe/PeDealSidebar';
import PeOverviewHub from '@/components/pe/PeOverviewHub';
import PeSingleSectionView from '@/components/pe/PeSingleSectionView';
import MemoSectionsViewer from '@/components/pe/MemoSectionsViewer';
import PeDealDocumentsUploader from '@/components/pe/PeDealDocumentsUploader';
import DealHistoryTimeline from '@/components/pe/DealHistoryTimeline';
import PeBenchmarkSourcesView from '@/components/pe/PeBenchmarkSourcesView';
import PreScreening360Dashboard from '@/components/pe/PreScreening360Dashboard';
import DueDiligenceSection from '@/components/pe/DueDiligenceSection';
import PeValuationView from '@/components/pe/PeValuationView';
import MemoVersionsView from '@/components/pe/MemoVersionsView';
import ClosingSection from '@/components/pe/ClosingSection';
import Plan100DaysSection from '@/components/pe/Plan100DaysSection';
import MonitoringDashboard from '@/components/pe/MonitoringDashboard';
import ValuationHistorySection from '@/components/pe/ValuationHistorySection';
import ExitPrepSection from '@/components/pe/ExitPrepSection';

interface AnalystOpt { user_id: string; full_name: string | null; email: string | null; role: string; }
interface HistoryRow { id: string; from_stage: string | null; to_stage: string; reason: string | null; created_at: string; }

export default function PeDealDetailPage() {
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId: string }>();
  const { role: orgRole, isSuperAdmin } = useCurrentRole();
  const { currentOrg } = useOrganization();
  const [deal, setDeal] = useState<any>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [analysts, setAnalysts] = useState<AnalystOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string>('overview');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState({
    ticket_demande: '', currency: 'EUR', source: 'autre', source_detail: '', lead_analyst_id: '',
  });

  const isAnalyst = orgRole === 'analyste' || orgRole === 'analyst';
  const isMd = orgRole === 'owner' || orgRole === 'admin' || orgRole === 'managing_director' || isSuperAdmin;

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    const { data: d } = await supabase.from('pe_deals').select('*, enterprises(name, sector, country)').eq('id', dealId).maybeSingle();
    if (!d) { setDeal(null); setLoading(false); return; }
    let leadName: string | null = null;
    if (d.lead_analyst_id) {
      const { data: p } = await supabase.from('profiles').select('full_name, email').eq('user_id', d.lead_analyst_id).maybeSingle();
      leadName = p?.full_name || p?.email || null;
    }
    setDeal({ ...d, enterprise_name: (d.enterprises as any)?.name ?? null, lead_analyst_name: leadName });
    setForm({
      ticket_demande: d.ticket_demande != null ? String(d.ticket_demande / 1_000_000) : '',
      currency: d.currency || 'EUR',
      source: d.source || 'autre',
      source_detail: d.source_detail || '',
      lead_analyst_id: d.lead_analyst_id || '',
    });

    const { data: hist } = await supabase
      .from('pe_deal_history')
      .select('id, from_stage, to_stage, reason, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    setHistory((hist || []) as any);

    if (currentOrg) {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', currentOrg.id)
        .eq('is_active', true)
        .in('role', ['analyst', 'analyste', 'investment_manager', 'managing_director', 'owner', 'admin']);
      const ids = (members || []).map((m: any) => m.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
        const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
        setAnalysts((members || []).map((m: any) => ({
          ...m,
          full_name: profMap.get(m.user_id)?.full_name || null,
          email: profMap.get(m.user_id)?.email || null,
        })));
      }
    }
    setLoading(false);
  }, [dealId, currentOrg]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!deal) return;
    setSaving(true);
    const { error } = await supabase
      .from('pe_deals')
      .update({
        ticket_demande: form.ticket_demande ? Number(form.ticket_demande) * 1_000_000 : null,
        currency: form.currency,
        source: form.source as any,
        source_detail: form.source === 'autre' ? form.source_detail.trim() || null : null,
        lead_analyst_id: form.lead_analyst_id || null,
      })
      .eq('id', deal.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Deal mis à jour');
    load();
  };

  const handleMarkLost = async () => {
    const reason = prompt('Raison du rejet ?');
    if (!reason || !reason.trim()) return;
    const { error, data } = await supabase.functions.invoke('update-pe-deal-stage', {
      body: { deal_id: deal.id, new_stage: 'lost', lost_reason: reason.trim() },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Deal marqué comme perdu');
    navigate('/pe/pipeline');
  };

  if (loading) return <DashboardLayout title="Deal"><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></DashboardLayout>;
  if (!deal) return <DashboardLayout title="Deal"><p>Deal introuvable</p></DashboardLayout>;

  // Décompose selectedItem : 'overview' | 'settings' | 'documents' | 'history' | 'pre_screening' | 'pre_screening:executive_summary' | etc.
  const renderRightPanel = () => {
    if (selectedItem === 'overview') {
      return <PeOverviewHub dealId={deal.id} deal={deal} onSelectItem={setSelectedItem} />;
    }
    if (selectedItem === 'benchmark') {
      return <PeBenchmarkSourcesView dealId={deal.id} />;
    }
    if (selectedItem === 'documents') {
      return currentOrg ? <PeDealDocumentsUploader dealId={deal.id} organizationId={currentOrg.id} /> : null;
    }
    if (selectedItem === 'history') {
      return (
        <div className="space-y-3">
          <DealHistoryTimeline dealId={deal.id} />
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b text-sm font-medium">Transitions de stage</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Transition</th>
                  <th className="text-left p-3">Raison</th>
                </tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b">
                      <td className="p-3 text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('fr-FR')}</td>
                      <td className="p-3">{h.from_stage || '—'} → <span className="font-medium">{h.to_stage}</span></td>
                      <td className="p-3 text-xs">{h.reason || '—'}</td>
                    </tr>
                  ))}
                  {!history.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Aucune transition enregistrée.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      );
    }
    // Living document : keys 'memo' (long scroll) et 'memo:<section_code>' (section seule).
    // Les anciens formats <stage>:<section> restent supportés en fallback (rétrocompat).
    if (selectedItem.includes(':')) {
      const [scope, code] = selectedItem.split(':');
      const isMemoScope = scope === 'memo' || ['pre_screening', 'note_ic1', 'note_ic_finale'].includes(scope);
      if (isMemoScope) {
        return <PeSingleSectionView dealId={deal.id} sectionCode={code} />;
      }
    }
    // Pré-screening : dashboard compact 13 blocs (pas le long scroll des 12 sections)
    if (selectedItem === 'pre_screening') {
      return <PreScreening360Dashboard dealId={deal.id} />;
    }
    // Memo d'investissement : phase entière (long scroll des 12 sections de la version active)
    if (selectedItem === 'memo' || ['note_ic1', 'note_ic_finale'].includes(selectedItem)) {
      return <MemoSectionsViewer dealId={deal.id} />;
    }
    // Due Diligence
    if (selectedItem === 'valuation') {
      return <PeValuationView dealId={deal.id} />;
    }
    if (selectedItem === 'dd') {
      return currentOrg ? <DueDiligenceSection dealId={deal.id} organizationId={currentOrg.id} /> : null;
    }
    if (selectedItem === 'closing') {
      return currentOrg ? <ClosingSection dealId={deal.id} organizationId={currentOrg.id} /> : null;
    }
    if (selectedItem === 'plan_100j') {
      return currentOrg ? <Plan100DaysSection dealId={deal.id} organizationId={currentOrg.id} /> : null;
    }
    if (selectedItem === 'monitoring') {
      return currentOrg ? <MonitoringDashboard dealId={deal.id} organizationId={currentOrg.id} /> : null;
    }
    if (selectedItem === 'valuation_history') {
      return currentOrg ? <ValuationHistorySection dealId={deal.id} organizationId={currentOrg.id} /> : null;
    }
    if (selectedItem === 'exit_prep') {
      return currentOrg ? <ExitPrepSection dealId={deal.id} organizationId={currentOrg.id} /> : null;
    }
    // Versions du memo (live + snapshots) avec vue comparatif
    if (selectedItem === 'memo_versions') {
      return <MemoVersionsView dealId={deal.id} />;
    }
    return <div className="text-muted-foreground">Sélectionne un item dans le menu.</div>;
  };

  return (
    <DashboardLayout title={deal.deal_ref} subtitle={deal.enterprise_name || '—'} fullscreen>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Action bar : back + stage + settings (fixe au-dessus du workspace) */}
        <div className="flex-none px-6 py-2 border-b bg-card/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate('/pe/pipeline')}>
              <ArrowLeft className="h-4 w-4" /> Retour au pipeline
            </Button>
            <Badge variant="outline">{deal.stage}</Badge>
            {deal.lead_analyst_name && <span className="text-sm text-muted-foreground">Lead : {deal.lead_analyst_name}</span>}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="h-4 w-4" /> Paramètres
          </Button>
        </div>

        {/* Workspace 2 colonnes — sidebar fixe + contenu scrollable */}
        <div className="flex-1 min-h-0 flex bg-card overflow-hidden">
          <div className="shrink-0 overflow-y-auto border-r bg-card">
            <PeDealSidebar
              dealId={deal.id}
              selectedItem={selectedItem}
              onSelectItem={setSelectedItem}
            />
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="p-6">
              {renderRightPanel()}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Paramètres (sortie de la sidebar) */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Paramètres du deal</SheetTitle>
            <SheetDescription>Métadonnées et lead analyst.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ticket (M)</Label>
                <Input type="number" step="0.1" value={form.ticket_demande}
                  onChange={e => setForm(f => ({ ...f, ticket_demande: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="FCFA">FCFA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reseau_pe">Réseau PE</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="dfi">DFI</SelectItem>
                  <SelectItem value="banque">Banque</SelectItem>
                  <SelectItem value="mandat_ba">Mandat BA</SelectItem>
                  <SelectItem value="conference">Conférence</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.source === 'autre' && (
              <div className="space-y-1.5">
                <Label>Précision</Label>
                <Input value={form.source_detail} onChange={e => setForm(f => ({ ...f, source_detail: e.target.value }))} />
              </div>
            )}
            {!isAnalyst && (
              <div className="space-y-1.5">
                <Label>Lead analyst</Label>
                <Select value={form.lead_analyst_id} onValueChange={v => setForm(f => ({ ...f, lead_analyst_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {analysts.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button onClick={async () => { await handleSave(); setSettingsOpen(false); }} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enregistrer
              </Button>
              {isMd && deal.stage !== 'lost' && (
                <Button variant="destructive" onClick={handleMarkLost} className="gap-2">
                  <Trash2 className="h-4 w-4" /> Marquer comme perdu
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
