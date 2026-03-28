import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Copy, Bot, ExternalLink, Eye, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
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

  const handleStart = async () => {
    setStarting(true);
    const { error } = await supabase.from('programmes').update({ status: 'in_progress' }).eq('id', id!);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else { toast({ title: '✅ Programme démarré' }); fetchProgramme(); }
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
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', coachIds);
        setCoaches((profiles || []).map(p => ({
          id: p.user_id,
          name: p.full_name || p.user_id.slice(0, 8),
          count: 0,
        })));
      } catch (e) {
        console.error('[coaches] fetch error:', e);
      }
    })();
  }, []);

  const candidatureUrl = programme?.form_slug ? `${window.location.origin}/candidature/${programme.form_slug}` : null;

  if (loading) return <DashboardLayout title="Programme"><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!programme) return <DashboardLayout title="Programme introuvable"><p className="text-muted-foreground">Ce programme n'existe pas.</p></DashboardLayout>;

  const status = programme.status;
  const fmt = (d: string | null) => d ? format(new Date(d), 'd MMM yyyy', { locale: fr }) : '—';

  const tabs: string[] = ['apercu'];
  if (['open', 'closed', 'in_progress', 'completed'].includes(status)) tabs.push('candidatures', 'kanban');
  if (status === 'open') tabs.push('diffusion');
  if (['in_progress', 'completed'].includes(status)) tabs.push('dashboard', 'comparatif', 'reporting');
  tabs.push('parametres');

  // Extract criteria details
  const customCriteria = criteria?.custom_criteria || {};
  const eligibilite: string[] = customCriteria.criteres_eligibilite || [];
  const selection: string[] = customCriteria.criteres_selection || [];
  const conditions: string[] = customCriteria.conditions_specifiques || [];

  return (
    <DashboardLayout title={programme.name} subtitle={programme.organization || ''}>
      <div className="flex items-center gap-3 mb-6">
        <ProgrammeStatusBadge status={status} />
        {status === 'draft' && <Button onClick={handlePublish} disabled={publishing}>{publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Publier</Button>}
        {status === 'closed' && <Button onClick={handleStart} disabled={starting}>{starting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Démarrer le programme</Button>}
      </div>

      <Tabs defaultValue="apercu">
        <TabsList className="flex-wrap">
          {tabs.map(t => <TabsTrigger key={t} value={t}>{
            { apercu: 'Aperçu', candidatures: 'Candidatures', kanban: 'Kanban', diffusion: 'Diffusion', dashboard: 'Dashboard', comparatif: 'Comparatif', reporting: 'Reporting', parametres: 'Paramètres' }[t]
          }</TabsTrigger>)}
        </TabsList>

        {/* Aperçu */}
        <TabsContent value="apercu">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5 space-y-2">
              <h3 className="font-semibold">Informations</h3>
              <p className="text-sm"><strong>Organisation :</strong> {programme.organization || '—'}</p>
              <p className="text-sm"><strong>Budget :</strong> {programme.budget?.toLocaleString() || '—'} {programme.currency || ''}</p>
              <p className="text-sm"><strong>Places :</strong> {programme.nb_places || '—'}</p>
              <p className="text-sm"><strong>Pays :</strong> {programme.country_filter?.join(', ') || '—'}</p>
              <p className="text-sm"><strong>Secteurs :</strong> {programme.sector_filter?.join(', ') || '—'}</p>
            </CardContent></Card>
            <Card><CardContent className="p-5 space-y-2">
              <h3 className="font-semibold">Dates</h3>
              <p className="text-sm"><strong>Candidatures :</strong> {fmt(programme.start_date)} → {fmt(programme.end_date)}</p>
              <p className="text-sm"><strong>Programme :</strong> {fmt(programme.programme_start)} → {fmt(programme.programme_end)}</p>
              {programme.description && <><h3 className="font-semibold pt-2">Description</h3><p className="text-sm text-muted-foreground">{programme.description}</p></>}
            </CardContent></Card>
          </div>

          {/* Critères d'éligibilité, sélection, conditions */}
          {(eligibilite.length > 0 || selection.length > 0 || conditions.length > 0) && (
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {eligibilite.length > 0 && (
                <Card><CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-semibold">Critères d'éligibilité</h3>
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
                    <h3 className="font-semibold">Critères de sélection</h3>
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
                    <h3 className="font-semibold">Conditions spécifiques</h3>
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
        </TabsContent>

        {/* Candidatures */}
        <TabsContent value="candidatures">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="received">Reçues</SelectItem>
                  <SelectItem value="in_review">En revue</SelectItem>
                  <SelectItem value="pre_selected">Pré-sélectionnées</SelectItem>
                  <SelectItem value="selected">Sélectionnées</SelectItem>
                  <SelectItem value="rejected">Rejetées</SelectItem>
                  <SelectItem value="waitlisted">Liste d'attente</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={handleScreen} disabled={screening}>
                {screening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {screening ? 'Screening en cours...' : 'Screening IA'}
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Entreprise</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead><TableHead>Score IA</TableHead><TableHead>Statut</TableHead><TableHead>Date</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {candidatures.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c.id)}>
                    <TableCell className="font-medium">{c.company_name || '—'}</TableCell>
                    <TableCell>{c.contact_name || '—'}</TableCell>
                    <TableCell>{c.contact_email || '—'}</TableCell>
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
                {candidatures.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune candidature</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Kanban */}
        <TabsContent value="kanban">
          <CandidatureKanban candidatures={candidatures} onCardClick={openDetail} onRefresh={fetchCandidatures} />
        </TabsContent>

        {/* Diffusion */}
        <TabsContent value="diffusion">
          <Card><CardContent className="p-5 space-y-4">
            <h3 className="font-semibold">Diffusion de l'appel</h3>
            {candidatureUrl ? (
              <>
                <div className="flex items-center gap-2">
                  <Input value={candidatureUrl} readOnly className="flex-1" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(candidatureUrl); toast({ title: '📋 Lien copié' }); }}><Copy className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => window.open(candidatureUrl, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                </div>
                <div className="flex items-center gap-4">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(candidatureUrl)}`} alt="QR Code" className="w-32 h-32 border rounded-lg p-1" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">QR Code</p>
                    <p className="text-xs text-muted-foreground">Scannez pour accéder au formulaire</p>
                    <Button variant="outline" size="sm" onClick={() => {
                      const link = document.createElement('a');
                      link.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(candidatureUrl)}&format=png`;
                      link.download = `qr-${programme.form_slug}.png`;
                      link.click();
                    }}>Télécharger le QR</Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Embed :</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">{`<iframe src="${candidatureUrl}" width="600" height="800" frameborder="0"></iframe>`}</pre>
                </div>
                <p className="text-sm font-medium">{candidatures.length} candidatures reçues</p>
              </>
            ) : <p className="text-sm text-muted-foreground">Le lien sera disponible après publication.</p>}
          </CardContent></Card>
        </TabsContent>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <ProgrammeDashboardTab programmeId={id!} />
        </TabsContent>

        {/* Comparatif */}
        <TabsContent value="comparatif">
          <ProgrammeComparatifTab programmeId={id!} />
        </TabsContent>

        {/* Reporting */}
        <TabsContent value="reporting">
          <ProgrammeReportingTab programmeId={id!} programmeName={programme.name} programmeStatus={programme.status} />
        </TabsContent>

        {/* Paramètres */}
        <TabsContent value="parametres">
          <Card><CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">Paramètres du programme</h3>
            <p className="text-sm text-muted-foreground">La modification des paramètres sera disponible prochainement.</p>
            {['in_progress', 'closed'].includes(status) && (
              <Button variant="destructive" onClick={async () => {
                const { error } = await supabase.from('programmes').update({ status: 'completed' }).eq('id', id!);
                if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                else { toast({ title: '✅ Programme clôturé' }); fetchProgramme(); }
              }}>Clôturer le programme</Button>
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
      />
    </DashboardLayout>
  );
}
