import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import ProgrammeODDPortfolioTab from '@/components/programmes/ProgrammeODDPortfolioTab';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Copy, Bot, ExternalLink, Eye, CheckCircle2, AlertTriangle, ShieldCheck, ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
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

  // Form Paramètres : programme
  type ProgrammeForm = {
    name: string;
    organization: string;
    description: string;
    budget: string;
    currency: string;
    nb_places: string;
    countries: string;
    sectors: string;
    start_date: string;
    end_date: string;
    programme_start: string;
    programme_end: string;
  };
  const [progForm, setProgForm] = useState<ProgrammeForm>({
    name: '', organization: '', description: '',
    budget: '', currency: '', nb_places: '',
    countries: '', sectors: '',
    start_date: '', end_date: '',
    programme_start: '', programme_end: '',
  });
  const [savingProg, setSavingProg] = useState(false);

  // Form Paramètres : critères (utilisés par le pré-screening IA)
  const [critEligibility, setCritEligibility] = useState<string[]>([]);
  const [critSelection, setCritSelection] = useState<string[]>([]);
  const [critConditions, setCritConditions] = useState<string[]>([]);
  const [savingCrit, setSavingCrit] = useState(false);
  const [creatingCrit, setCreatingCrit] = useState(false);

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

  // Initialise les forms Paramètres dès que programme/criteria sont chargés
  useEffect(() => {
    if (!programme) return;
    setProgForm({
      name: programme.name || '',
      organization: programme.organization || '',
      description: programme.description || '',
      budget: programme.budget != null ? String(programme.budget) : '',
      currency: programme.currency || '',
      nb_places: programme.nb_places != null ? String(programme.nb_places) : '',
      countries: (programme.country_filter || []).join(', '),
      sectors: (programme.sector_filter || []).join(', '),
      start_date: programme.start_date ? programme.start_date.slice(0, 10) : '',
      end_date: programme.end_date ? programme.end_date.slice(0, 10) : '',
      programme_start: programme.programme_start ? programme.programme_start.slice(0, 10) : '',
      programme_end: programme.programme_end ? programme.programme_end.slice(0, 10) : '',
    });
  }, [programme]);

  useEffect(() => {
    const cc = criteria?.custom_criteria || {};
    setCritEligibility(Array.isArray(cc.criteres_eligibilite) ? cc.criteres_eligibilite : []);
    setCritSelection(Array.isArray(cc.criteres_selection) ? cc.criteres_selection : []);
    setCritConditions(Array.isArray(cc.conditions_specifiques) ? cc.conditions_specifiques : []);
  }, [criteria]);

  const splitList = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

  const handleSaveProgramme = async () => {
    if (!progForm.name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    setSavingProg(true);
    const payload = {
      name: progForm.name.trim(),
      organization: progForm.organization.trim() || null,
      description: progForm.description.trim() || null,
      budget: progForm.budget ? Number(progForm.budget) : null,
      currency: progForm.currency.trim() || null,
      nb_places: progForm.nb_places ? Number(progForm.nb_places) : null,
      country_filter: splitList(progForm.countries),
      sector_filter: splitList(progForm.sectors),
      start_date: progForm.start_date || null,
      end_date: progForm.end_date || null,
      programme_start: progForm.programme_start || null,
      programme_end: progForm.programme_end || null,
    };
    const { error } = await supabase.from('programmes').update(payload).eq('id', id!);
    setSavingProg(false);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Paramètres enregistrés' });
    fetchProgramme();
  };

  const handleSaveCriteria = async () => {
    if (!programme?.criteria_id) {
      toast({ title: 'Aucun critères lié à ce programme', variant: 'destructive' });
      return;
    }
    setSavingCrit(true);
    const newCustom = {
      ...(criteria?.custom_criteria || {}),
      criteres_eligibilite: critEligibility,
      criteres_selection: critSelection,
      conditions_specifiques: critConditions,
    };
    const { error } = await supabase
      .from('programme_criteria')
      .update({ custom_criteria: newCustom })
      .eq('id', programme.criteria_id);
    setSavingCrit(false);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Critères enregistrés' });
    fetchProgramme();
  };

  const handleCreateCriteria = async () => {
    if (!programme) return;
    if (!programme.organization_id) {
      toast({ title: 'Erreur', description: 'Programme sans organisation, impossible de créer le jeu de critères.', variant: 'destructive' });
      return;
    }
    setCreatingCrit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: pc, error: pcErr } = await supabase
        .from('programme_criteria')
        .insert({
          name: programme.name,
          organization_id: programme.organization_id,
          created_by: user?.id || null,
          is_active: true,
          country_filter: programme.country_filter || [],
          sector_filter: programme.sector_filter || [],
          custom_criteria: {},
        } as any)
        .select('id')
        .single();
      if (pcErr) throw pcErr;
      const { error: linkErr } = await supabase
        .from('programmes')
        .update({ criteria_id: (pc as any).id })
        .eq('id', programme.id);
      if (linkErr) throw linkErr;
      toast({ title: '✅ Jeu de critères créé', description: 'Tu peux maintenant remplir les seuils, livrables, document source.' });
      fetchProgramme();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible de créer le jeu de critères', variant: 'destructive' });
    } finally {
      setCreatingCrit(false);
    }
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
                    <ShieldCheck className="h-5 w-5 text-violet-600" />
                    <h3 className="font-semibold">{t('programme_tabs.selection_criteria')}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {selection.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-violet-600 mt-0.5">◆</span>
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
          <ProgrammeODDPortfolioTab programmeId={id!} />
          <div className="mt-8">
            <ProgrammeImpactTab programmeId={id!} />
          </div>
        </TabsContent>

        {/* Paramètres */}
        <TabsContent value="parametres">
          <div className="space-y-6">
            {/* Section 1 : Informations du programme */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Informations du programme</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nom *</Label>
                    <Input value={progForm.name} onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Organisation</Label>
                    <Input value={progForm.organization} onChange={e => setProgForm(f => ({ ...f, organization: e.target.value }))} placeholder="OVO, ESONO..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={3} value={progForm.description} onChange={e => setProgForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Budget</Label>
                    <Input type="number" value={progForm.budget} onChange={e => setProgForm(f => ({ ...f, budget: e.target.value }))} placeholder="250000000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Devise</Label>
                    <Input value={progForm.currency} onChange={e => setProgForm(f => ({ ...f, currency: e.target.value }))} placeholder="FCFA / EUR / USD" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nombre de places</Label>
                    <Input type="number" value={progForm.nb_places} onChange={e => setProgForm(f => ({ ...f, nb_places: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Pays ciblés</Label>
                    <Input value={progForm.countries} onChange={e => setProgForm(f => ({ ...f, countries: e.target.value }))} placeholder="Côte d'Ivoire, Sénégal, RDC" />
                    <p className="text-[11px] text-muted-foreground">Séparer les valeurs par des virgules</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Secteurs ciblés</Label>
                    <Input value={progForm.sectors} onChange={e => setProgForm(f => ({ ...f, sectors: e.target.value }))} placeholder="Agro-industrie, BTP, Services" />
                    <p className="text-[11px] text-muted-foreground">Séparer les valeurs par des virgules</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Période de candidatures</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Début</Label>
                        <Input type="date" value={progForm.start_date} onChange={e => setProgForm(f => ({ ...f, start_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Fin</Label>
                        <Input type="date" value={progForm.end_date} onChange={e => setProgForm(f => ({ ...f, end_date: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Période du programme</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Début</Label>
                        <Input type="date" value={progForm.programme_start} onChange={e => setProgForm(f => ({ ...f, programme_start: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Fin</Label>
                        <Input type="date" value={progForm.programme_end} onChange={e => setProgForm(f => ({ ...f, programme_end: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProgramme} disabled={savingProg || !progForm.name.trim()} className="gap-2">
                    {savingProg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Section 2 : Critères qualitatifs du programme */}
            {programme?.criteria_id ? (
              <Card>
                <CardContent className="p-5 space-y-5">
                  <div>
                    <h3 className="font-semibold">Critères qualitatifs</h3>
                    <p className="text-xs text-muted-foreground">
                      Affichés sur la page de candidature et utilisés par le pré-screening IA.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {([
                      { label: "Critères d'éligibilité", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, items: critEligibility, setItems: setCritEligibility, placeholder: 'Ex : entreprise enregistrée, CA < 500M FCFA' },
                      { label: 'Critères de sélection', icon: <ShieldCheck className="h-4 w-4 text-violet-600" />, items: critSelection, setItems: setCritSelection, placeholder: 'Ex : impact social, scalabilité' },
                      { label: 'Conditions spécifiques', icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, items: critConditions, setItems: setCritConditions, placeholder: 'Ex : engagement de 12 mois minimum' },
                    ] as const).map(({ label, icon, items, setItems, placeholder }) => (
                      <div key={label} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {icon} {label}
                        </div>
                        <div className="space-y-2">
                          {items.map((value, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input
                                value={value}
                                onChange={e => {
                                  const next = [...items];
                                  next[idx] = e.target.value;
                                  setItems(next);
                                }}
                                placeholder={placeholder}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setItems([...items, ''])}
                          >
                            <Plus className="h-3.5 w-3.5" /> Ajouter un critère
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <Button onClick={handleSaveCriteria} disabled={savingCrit} className="gap-2">
                      {savingCrit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Enregistrer les critères
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-semibold">Critères du programme</h3>
                  <p className="text-sm text-muted-foreground">
                    Ce programme n'a pas encore de jeu de critères. Sans critères configurés,
                    le pré-screening IA ne peut pas évaluer la conformité des candidatures (
                    <code className="text-[11px]">programme_match</code> = null).
                  </p>
                  <div>
                    <Button onClick={handleCreateCriteria} disabled={creatingCrit} className="gap-2">
                      {creatingCrit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Créer le jeu de critères
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 3 : Zone dangereuse */}
            <Card className="border-red-200">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-semibold text-red-900">Zone dangereuse</h3>
                {['in_progress', 'closed'].includes(status) ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{t('programme.close_programme')}</p>
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
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Les actions destructives (clôture définitive) seront disponibles une fois le programme démarré.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
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
