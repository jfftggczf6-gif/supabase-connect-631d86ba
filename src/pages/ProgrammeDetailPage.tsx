import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProgrammeStatusBadge from '@/components/programmes/ProgrammeStatusBadge';
import CandidatureKanban from '@/components/programmes/CandidatureKanban';
import CandidatureDetailDrawer from '@/components/programmes/CandidatureDetailDrawer';
import ProgrammeDashboardTab from '@/components/programmes/ProgrammeDashboardTab';
import ProgrammeComparatifTab from '@/components/programmes/ProgrammeComparatifTab';
import ProgrammeReportingTab from '@/components/programmes/ProgrammeReportingTab';
import CohorteEnterprisesTab from '@/components/programmes/CohorteEnterprisesTab';
import ProgrammeImpactTab from '@/components/programmes/ProgrammeImpactTab';
import ProgrammeComplianceTab from '@/components/programmes/ProgrammeComplianceTab';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Copy, Bot, ExternalLink, Eye, CheckCircle2, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProgrammeDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'apercu';
  const [programme, setProgramme] = useState<any>(null);
  const [criteria, setCriteria] = useState<any>(null);
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCandidature, setSelectedCandidature] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProgramme = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from('programmes').select('*').eq('id', id).single();
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setProgramme(data);
    // Fetch criteria if linked
    if (data?.criteria_id) {
      const { data: crit } = await supabase.from('programme_criteria').select('*').eq('id', data.criteria_id).single();
      setCriteria(crit);
    }
  }, [id]);

  const fetchCandidatures = useCallback(async () => {
    if (!id) return;
    let query = supabase.from('candidatures').select('*').eq('programme_id', id).order('submitted_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setCandidatures(data || []);
  }, [id, search, statusFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProgramme(), fetchCandidatures()]).finally(() => setLoading(false));
  }, [fetchProgramme, fetchCandidatures]);

  // Realtime subscription for candidatures updates (screening scores)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`candidatures-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'candidatures',
        filter: `programme_id=eq.${id}`,
      }, () => {
        fetchCandidatures();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, fetchCandidatures]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    const { error } = await supabase.from('programmes').update({ status: 'open' }).eq('id', id!);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else { toast({ title: '✅ Programme publié' }); fetchProgramme(); }
    setPublishing(false);
  };

  const handleClose = async () => {
    if (!confirm(t('programme.close_candidatures_confirm'))) return;
    const { error } = await supabase.from('programmes').update({ status: 'closed' }).eq('id', id!);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else { toast({ title: '✅ Candidatures clôturées' }); fetchProgramme(); }
  };

  const handleStart = async () => {
    setStarting(true);
    const { error } = await supabase.from('programmes').update({ status: 'in_progress' }).eq('id', id!);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else { toast({ title: '✅ Programme démarré — les onglets de suivi sont maintenant disponibles' }); fetchProgramme(); }
    setStarting(false);
  };

  const handleScreen = async () => {
    setScreening(true);
    const { error } = await supabase.functions.invoke('screen-candidatures', { body: { programme_id: id } });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setScreening(false);
      return;
    }
    toast({ title: '🤖 Screening IA lancé', description: 'Les scores arriveront progressivement via Realtime.' });
    
    // Also poll as fallback
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => { await fetchCandidatures(); }, 5000);
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setScreening(false);
    }, 120000);
  };

  const openDetail = (cId: string) => { setSelectedCandidature(cId); setDrawerOpen(true); };

  const [coaches, setCoaches] = useState<{ id: string; name: string; count: number }[]>([]);

  // Fetch coaches list once on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: coachRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'coach');
        if (!coachRoles?.length) return;
        const coachIds = coachRoles.map(r => r.user_id);
        const [{ data: profiles }, { data: entCounts }, { data: ecCounts }] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name, email').in('user_id', coachIds),
          supabase.from('enterprises').select('coach_id').in('coach_id', coachIds),
          supabase.from('enterprise_coaches').select('coach_id').in('coach_id', coachIds).eq('is_active', true),
        ]);
        // Merge counts: N-to-N takes precedence
        const countMap: Record<string, number> = {};
        (entCounts || []).forEach((e: any) => { countMap[e.coach_id] = (countMap[e.coach_id] || 0) + 1; });
        // Override with enterprise_coaches counts if available
        const ecCountMap: Record<string, number> = {};
        (ecCounts || []).forEach((ec: any) => { ecCountMap[ec.coach_id] = (ecCountMap[ec.coach_id] || 0) + 1; });
        for (const cid of Object.keys(ecCountMap)) { countMap[cid] = ecCountMap[cid]; }
        setCoaches((profiles || []).filter(p => p.full_name).map(p => ({
          id: p.user_id,
          name: p.full_name || p.user_id.slice(0, 8),
          email: p.email || '',
          count: countMap[p.user_id] || 0,
        })));
      } catch (e) {
        console.error('[coaches] fetch error:', e);
      }
    })();
  }, []);

  const candidatureUrl = programme?.form_slug ? `${window.location.origin}/candidature/${programme.form_slug}` : null;

  if (loading) return <DashboardLayout title={t('programme.title')}><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!programme) return <DashboardLayout title={t('programme.not_found')}><p className="text-muted-foreground">{t('programme.not_found_desc')}</p></DashboardLayout>;

  const status = programme.status;
  const fmt = (d: string | null) => d ? format(new Date(d), 'd MMM yyyy', { locale: fr }) : '—';

  const isCohorte = programme.type === 'cohorte_directe';
  const tabs: string[] = ['apercu'];
  if (isCohorte) {
    tabs.push('enterprises', 'suivi', 'compliance', 'reporting', 'impact');
  } else {
    if (['open', 'closed'].includes(status)) {
      tabs.push('selection');
    }
    if (['in_progress', 'completed'].includes(status)) {
      tabs.push('suivi', 'compliance', 'reporting', 'impact');
    }
  }
  tabs.push('parametres');

  // Extract criteria details
  const customCriteria = criteria?.custom_criteria || {};
  const eligibilite: string[] = customCriteria.criteres_eligibilite || [];
  const selection: string[] = customCriteria.criteres_selection || [];
  const conditions: string[] = customCriteria.conditions_specifiques || [];

  return (
    <DashboardLayout title={programme.name} subtitle={programme.organization || ''}>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" onClick={() => nav('/programmes')} className="shrink-0 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour aux programmes
        </Button>
        <ProgrammeStatusBadge status={status} />
        {status === 'draft' && <Button onClick={handlePublish} disabled={publishing}>{publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} {t('programme.publish')}</Button>}
        {status === 'open' && <Button variant="outline" onClick={handleClose}>{t('programme.close_candidatures')}</Button>}
        {(status === 'open' || status === 'closed') && <Button onClick={handleStart} disabled={starting}>{starting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} {t('programme.start_programme')}</Button>}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
        <TabsList className="flex-wrap">
          {tabs.map(tab => <TabsTrigger key={tab} value={tab}>{
            { apercu: t('programme.overview'), enterprises: t('programme.enterprises'), selection: t('programme.selection'), suivi: t('programme.monitoring'), compliance: 'Compliance & IC', reporting: t('programme.reporting'), impact: t('programme.impact'), parametres: t('programme.settings') }[tab]
          }</TabsTrigger>)}
        </TabsList>

        {/* Aperçu */}
        <TabsContent value="apercu">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5 space-y-2">
              <h3 className="font-semibold">{t('programme_tabs.information')}</h3>
              <p className="text-sm"><strong>{t('programme_tabs.organization')} :</strong> {programme.organization || '—'}</p>
              <p className="text-sm"><strong>{t('programme_tabs.budget')} :</strong> {programme.budget?.toLocaleString() || '—'} {programme.currency || ''}</p>
              <p className="text-sm"><strong>{t('programme_tabs.places')} :</strong> {programme.nb_places || '—'}</p>
              <p className="text-sm"><strong>{t('programme_tabs.countries')} :</strong> {programme.country_filter?.join(', ') || '—'}</p>
              <p className="text-sm"><strong>{t('programme_tabs.sectors')} :</strong> {programme.sector_filter?.join(', ') || '—'}</p>
            </CardContent></Card>
            <Card><CardContent className="p-5 space-y-2">
              <h3 className="font-semibold">{t('programme_tabs.dates')}</h3>
              <p className="text-sm"><strong>{t('programme_tabs.candidatures_dates')} :</strong> {fmt(programme.start_date)} → {fmt(programme.end_date)}</p>
              <p className="text-sm"><strong>{t('programme_tabs.programme_dates')} :</strong> {fmt(programme.programme_start)} → {fmt(programme.programme_end)}</p>
              {programme.description && <><h3 className="font-semibold pt-2">{t('programme_tabs.description')}</h3><p className="text-sm text-muted-foreground">{programme.description}</p></>}
            </CardContent></Card>
          </div>

          {status === 'in_progress' && (
            <div className="mt-4">
              <Button variant="destructive" onClick={async () => {
                if (!confirm(t('programme.close_confirm', { name: programme.name }))) return;
                const { error } = await supabase.functions.invoke('manage-programme', {
                  body: { action: 'complete', id: id! }
                });
                if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                else { toast({ title: 'Programme clôturé' }); fetchProgramme(); }
              }}>{t('programme.close_programme')}</Button>
            </div>
          )}

          {/* Critères d'éligibilité, sélection, conditions */}
          {(eligibilite.length > 0 || selection.length > 0 || conditions.length > 0) && (
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {eligibilite.length > 0 && (
                <Card><CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-semibold">{t('programme_tabs.eligibility')}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {eligibilite.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-emerald-500 mt-0.5">✓</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent></Card>
              )}
              {selection.length > 0 && (
                <Card><CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">{t('programme_tabs.selection_criteria')}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {selection.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500 mt-0.5">◆</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent></Card>
              )}
              {conditions.length > 0 && (
                <Card><CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold">{t('programme_tabs.specific_conditions')}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {conditions.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-500 mt-0.5">⚠</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent></Card>
              )}
            </div>
          )}

          {candidatureUrl && status !== 'draft' && (
            <Card className="mt-4"><CardContent className="p-5 space-y-4">
              <h3 className="font-semibold">{t('programme.diffusion_title')}</h3>
              <div className="flex items-center gap-2">
                <Input value={candidatureUrl} readOnly className="flex-1" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(candidatureUrl); toast({ title: '📋 Lien copié' }); }}><Copy className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => window.open(candidatureUrl, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(candidatureUrl)}`}
                  alt="QR Code"
                  className="w-32 h-32 border rounded-lg p-1 cursor-pointer hover:opacity-80 transition-opacity"
                  title="Cliquer pour télécharger"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(candidatureUrl)}&format=png`;
                    link.download = `qr-${programme.form_slug}.png`;
                    link.click();
                  }}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('programme.qr_code')}</p>
                  <p className="text-xs text-muted-foreground">{t('programme.qr_scan')}</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    const link = document.createElement('a');
                    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(candidatureUrl)}&format=png`;
                    link.download = `qr-${programme.form_slug}.png`;
                    link.click();
                  }}>{t('programme.download_qr')}</Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>{t('programme.embed')} :</strong>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">{`<iframe src="${candidatureUrl}" width="600" height="800" frameborder="0"></iframe>`}</pre>
              </div>
              <p className="text-sm font-medium">{candidatures.length} {t('programme.candidatures_received')}</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Entreprises (cohorte) */}
        <TabsContent value="enterprises">
          <CohorteEnterprisesTab programmeId={id!} programmeName={programme.name} />
        </TabsContent>

        {/* Sélection (candidatures + kanban fusionnés) */}
        <TabsContent value="selection">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Input placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('common.status')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="received">{t('candidature.received')}</SelectItem>
                  <SelectItem value="pre_selected">{t('candidature.pre_selected')}</SelectItem>
                  <SelectItem value="selected">{t('candidature.selected')}</SelectItem>
                  <SelectItem value="rejected">{t('candidature.rejected')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={handleScreen} disabled={screening}>
                {screening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {screening ? t('programme.screening_running') : t('programme.screening_ia')}
              </Button>
            </div>
            <CandidatureKanban candidatures={candidatures} onCardClick={openDetail} onRefresh={fetchCandidatures} />
            <details className="mt-2">
              <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">{t('candidature.table_view')} ({candidatures.length})</summary>
              <Table className="mt-2">
                <TableHeader><TableRow>
                  <TableHead>{t('dashboard_programme.enterprises_short')}</TableHead><TableHead>{t('candidature.contact')}</TableHead><TableHead>{t('candidature.score_ia')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead>{t('common.date')}</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {candidatures.map(c => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c.id)}>
                      <TableCell className="font-medium">{c.company_name || '—'}</TableCell>
                      <TableCell className="text-sm">{c.contact_name || '—'}</TableCell>
                      <TableCell>{c.screening_score != null ? <Badge variant="outline">{c.screening_score}</Badge> : '—'}</TableCell>
                      <TableCell><ProgrammeStatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-xs">{fmt(c.submitted_at)}</TableCell>
                      <TableCell>
                        {c.enterprise_id && (
                          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); nav(`/programmes/${id}/enterprise/${c.enterprise_id}`); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {candidatures.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t('programme.no_candidatures')}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </details>
          </div>
        </TabsContent>

        {/* Suivi (dashboard + comparatif fusionnés) */}
        <TabsContent value="suivi">
          <div className="space-y-6">
            <ProgrammeDashboardTab programmeId={id!} />
            <details className="mt-2">
              <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">{t('dashboard_programme.comparative')}</summary>
              <div className="mt-3">
                <ProgrammeComparatifTab programmeId={id!} />
              </div>
            </details>
          </div>
        </TabsContent>

        {/* Reporting */}
        <TabsContent value="reporting">
          <ProgrammeReportingTab programmeId={id!} programmeName={programme.name} programmeStatus={programme.status} hideClotureButton />
        </TabsContent>

        {/* Compliance & IC */}
        <TabsContent value="compliance">
          <ProgrammeComplianceTab programmeId={id!} />
        </TabsContent>

        {/* Impact */}
        <TabsContent value="impact">
          <ProgrammeImpactTab programmeId={id!} />
        </TabsContent>

        {/* Paramètres */}
        <TabsContent value="parametres">
          <Card><CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">{t('programme.settings_title')}</h3>
            <p className="text-sm text-muted-foreground">{t('programme.settings_coming_soon')}</p>
            {['in_progress', 'closed'].includes(status) && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-red-900">{t('programme.close_programme')}</p>
                    <p className="text-xs text-muted-foreground">{t('programme.close_warning')}</p>
                  </div>
                  <Button variant="destructive" onClick={async () => {
                    if (!confirm(t('programme.close_confirm', { name: programme.name }))) return;
                    const { error } = await supabase.functions.invoke('manage-programme', {
                      body: { action: 'complete', id: id! }
                    });
                    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                    else { toast({ title: 'Programme clôturé' }); fetchProgramme(); }
                  }}>{t('programme.close_button')}</Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <CandidatureDetailDrawer
        candidatureId={selectedCandidature}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        coaches={coaches}
        onUpdated={fetchCandidatures}
        candidatureIds={candidatures.map(c => c.id)}
        onNavigate={(cId) => setSelectedCandidature(cId)}
      />
    </DashboardLayout>
  );
}
