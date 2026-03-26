import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Copy, Bot, ExternalLink, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [programme, setProgramme] = useState<any>(null);
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCandidature, setSelectedCandidature] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [starting, setStarting] = useState(false);

  const fetchProgramme = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.functions.invoke('manage-programme', { body: { action: 'get', id } });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setProgramme(data);
  }, [id]);

  const fetchCandidatures = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.functions.invoke('list-candidatures', { body: { programme_id: id, search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined } });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setCandidatures(data?.candidatures || data || []);
  }, [id, search, statusFilter]);

  useEffect(() => { setLoading(true); Promise.all([fetchProgramme(), fetchCandidatures()]).finally(() => setLoading(false)); }, [fetchProgramme, fetchCandidatures]);

  const handlePublish = async () => {
    setPublishing(true);
    const { error } = await supabase.functions.invoke('manage-programme', { body: { action: 'publish', id } });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '✅ Programme publié' }); fetchProgramme(); }
    setPublishing(false);
  };

  const handleStart = async () => {
    setStarting(true);
    const { error } = await supabase.functions.invoke('manage-programme', { body: { action: 'start', id } });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '✅ Programme démarré' }); fetchProgramme(); }
    setStarting(false);
  };

  const handleScreen = async () => {
    setScreening(true);
    const { error } = await supabase.functions.invoke('screen-candidatures', { body: { programme_id: id } });
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '🤖 Screening IA lancé', description: 'Les scores arriveront progressivement.' }); }
    setScreening(false);
    // Poll for updates
    const poll = setInterval(async () => { await fetchCandidatures(); }, 5000);
    setTimeout(() => clearInterval(poll), 120000);
  };

  const openDetail = (cId: string) => { setSelectedCandidature(cId); setDrawerOpen(true); };

  const candidatureUrl = programme?.form_slug ? `${window.location.origin}/candidature/${programme.form_slug}` : null;

  if (loading) return <DashboardLayout title="Programme"><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!programme) return <DashboardLayout title="Programme introuvable"><p className="text-muted-foreground">Ce programme n'existe pas.</p></DashboardLayout>;

  const status = programme.status;
  const fmt = (d: string | null) => d ? format(new Date(d), 'd MMM yyyy', { locale: fr }) : '—';

  const tabs: string[] = [];
  tabs.push('apercu');
  if (['open', 'closed', 'in_progress', 'completed'].includes(status)) tabs.push('candidatures', 'kanban');
  if (status === 'open') tabs.push('diffusion');
  if (['in_progress', 'completed'].includes(status)) tabs.push('dashboard', 'comparatif', 'reporting');
  tabs.push('parametres');

  const coaches: { id: string; name: string; count: number }[] = []; // TODO: fetch coaches

  return (
    <DashboardLayout title={programme.name} subtitle={programme.organization || ''}>
      <div className="flex items-center gap-3 mb-6">
        <ProgrammeStatusBadge status={status} />
        {status === 'draft' && <Button onClick={handlePublish} disabled={publishing}>{publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Publier</Button>}
        {status === 'closed' && <Button onClick={handleStart} disabled={starting}>{starting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Démarrer le programme</Button>}
      </div>

      <Tabs defaultValue="apercu">
        <TabsList className="flex-wrap">
          {tabs.includes('apercu') && <TabsTrigger value="apercu">Aperçu</TabsTrigger>}
          {tabs.includes('candidatures') && <TabsTrigger value="candidatures">Candidatures</TabsTrigger>}
          {tabs.includes('kanban') && <TabsTrigger value="kanban">Kanban</TabsTrigger>}
          {tabs.includes('diffusion') && <TabsTrigger value="diffusion">Diffusion</TabsTrigger>}
          {tabs.includes('dashboard') && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
          {tabs.includes('comparatif') && <TabsTrigger value="comparatif">Comparatif</TabsTrigger>}
          {tabs.includes('reporting') && <TabsTrigger value="reporting">Reporting</TabsTrigger>}
          {tabs.includes('parametres') && <TabsTrigger value="parametres">Paramètres</TabsTrigger>}
        </TabsList>

        {/* Aperçu */}
        <TabsContent value="apercu">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5 space-y-2">
              <h3 className="font-semibold">Informations</h3>
              <p className="text-sm"><strong>Organisation :</strong> {programme.organization || '—'}</p>
              <p className="text-sm"><strong>Budget :</strong> {programme.budget?.toLocaleString() || '—'} {programme.currency || 'XOF'}</p>
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
        </TabsContent>

        {/* Candidatures */}
        <TabsContent value="candidatures">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="submitted">Reçues</SelectItem>
                  <SelectItem value="in_review">En revue</SelectItem>
                  <SelectItem value="pre_selected">Pré-sélectionnées</SelectItem>
                  <SelectItem value="selected">Sélectionnées</SelectItem>
                  <SelectItem value="rejected">Rejetées</SelectItem>
                  <SelectItem value="waitlist">Liste d'attente</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={handleScreen} disabled={screening}>
                {screening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} Screening IA
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Entreprise</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead><TableHead>Score IA</TableHead><TableHead>Statut</TableHead><TableHead>Date</TableHead>
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
                  </TableRow>
                ))}
                {candidatures.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune candidature</TableCell></TableRow>}
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

                {/* QR Code */}
                <div className="flex items-center gap-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(candidatureUrl)}`}
                    alt="QR Code candidature"
                    className="w-32 h-32 border rounded-lg p-1"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">QR Code</p>
                    <p className="text-xs text-muted-foreground">Scannez pour accéder au formulaire de candidature</p>
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
          <Card><CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">📊 Dashboard en cours de développement</p>
            <p className="text-sm text-muted-foreground mt-1">Les données seront disponibles prochainement.</p>
          </CardContent></Card>
        </TabsContent>

        {/* Comparatif */}
        <TabsContent value="comparatif">
          <Card><CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">📊 Comparatif en cours de développement</p>
            <p className="text-sm text-muted-foreground mt-1">Les données seront disponibles prochainement.</p>
          </CardContent></Card>
        </TabsContent>

        {/* Reporting */}
        <TabsContent value="reporting">
          <Card><CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">📊 Reporting en cours de développement</p>
            <p className="text-sm text-muted-foreground mt-1">Les données seront disponibles prochainement.</p>
          </CardContent></Card>
        </TabsContent>

        {/* Paramètres */}
        <TabsContent value="parametres">
          <Card><CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">Paramètres du programme</h3>
            <p className="text-sm text-muted-foreground">La modification des paramètres sera disponible prochainement.</p>
            {['in_progress', 'closed'].includes(status) && (
              <Button variant="destructive" onClick={async () => {
                const { error } = await supabase.functions.invoke('manage-programme', { body: { action: 'close', id } });
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
        onUpdated={() => { fetchCandidatures(); }}
      />
    </DashboardLayout>
  );
}
