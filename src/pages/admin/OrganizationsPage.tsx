import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Building2, Search, Loader2 } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { useOrganization } from '@/contexts/OrganizationContext';
import { LogIn } from 'lucide-react';

interface OrgRow {
  id: string; name: string; slug: string; type: string;
  country: string | null; is_active: boolean; member_count: number;
  enterprise_count: number; created_at: string;
}

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const { refreshOrganizations, switchOrganization, memberships } = useOrganization();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  const fetchOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_all_organizations_for_admin');
    if (error) {
      toast.error(error.message);
    } else {
      setOrgs((data || []) as OrgRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrgs(); }, []);

  const filtered = orgs.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.includes(search.toLowerCase())
  );

  // Wizard state
  const [wizStep, setWizStep] = useState(1);
  const [wizLoading, setWizLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', type: 'programme' as string, country: '',
    owner_email: '', owner_name: '', send_invitation: true,
  });

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

  const handleCreate = async () => {
    setWizLoading(true);
    try {
      const token = await getValidAccessToken(null);
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast.success(`Organisation "${form.name}" créée !`);
      setShowWizard(false);
      await refreshOrganizations(); // Mettre à jour le sélecteur d'org
      setWizStep(1);
      setForm({ name: '', slug: '', type: 'programme', country: '', owner_email: '', owner_name: '', send_invitation: true });
      fetchOrgs();
    } catch (err: any) {
      toast.error(err.message);
    }
    setWizLoading(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // Aggregate KPIs
  const kpis = {
    total: orgs.length,
    active: orgs.filter(o => o.is_active).length,
    members: orgs.reduce((s, o) => s + (o.member_count || 0), 0),
    enterprises: orgs.reduce((s, o) => s + (o.enterprise_count || 0), 0),
    byType: {
      programme: orgs.filter(o => o.type === 'programme').length,
      pe: orgs.filter(o => o.type === 'pe').length,
      mixed: orgs.filter(o => o.type === 'mixed').length,
    },
  };

  return (
    <DashboardLayout title="Organisations" subtitle="Gestion des espaces clients">
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate('/dashboard')}>
        ← Retour au dashboard
      </Button>

      {/* KPIs aggregate */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Organisations</p>
          <p className="text-2xl font-bold mt-1">{kpis.total}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.active} actives</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Membres totaux</p>
          <p className="text-2xl font-bold mt-1">{kpis.members}</p>
          <p className="text-[10px] text-muted-foreground">tous rôles confondus</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Entreprises</p>
          <p className="text-2xl font-bold mt-1">{kpis.enterprises}</p>
          <p className="text-[10px] text-muted-foreground">à travers la plateforme</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Répartition</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-[10px]">Prog: {kpis.byType.programme}</Badge>
            <Badge variant="outline" className="text-[10px]">PE: {kpis.byType.pe}</Badge>
            <Badge variant="outline" className="text-[10px]">Mixte: {kpis.byType.mixed}</Badge>
          </div>
        </CardContent></Card>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button className="gap-2" onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4" /> Créer une organisation
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pays</TableHead>
                <TableHead>Membres</TableHead>
                <TableHead>Entreprises</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.map(o => {
                const isMember = memberships.some(m => m.organization.id === o.id);
                return (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/organizations/${o.id}`)}>
                  <TableCell className="font-medium">{o.name}<br /><span className="text-xs text-muted-foreground">{o.slug}</span></TableCell>
                  <TableCell><Badge variant="outline">{o.type}</Badge></TableCell>
                  <TableCell className="text-sm">{o.country || '—'}</TableCell>
                  <TableCell className="text-sm">{o.member_count}</TableCell>
                  <TableCell className="text-sm">{o.enterprise_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                  <TableCell><Badge variant={o.is_active ? 'default' : 'secondary'}>{o.is_active ? 'Actif' : 'Inactif'}</Badge></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isMember ? (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => { switchOrganization(o.id); navigate('/dashboard'); }} title="Entrer dans cet espace">
                        <LogIn className="h-3 w-3" /> Entrer
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">non-membre</span>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
              {!loading && !filtered.length && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune organisation</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Wizard création */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer une organisation</DialogTitle>
          </DialogHeader>

          {wizStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) })); }} placeholder="Enabel Côte d'Ivoire" />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="enabel-ci" />
              </div>
              <div>
                <Label>Type *</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { value: 'programme', label: 'Programme', desc: 'Bailleur, incubateur' },
                    { value: 'pe', label: 'Private Equity', desc: 'Fonds, family office' },
                    { value: 'mixed', label: 'Mixte', desc: 'Les deux' },
                  ].map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${form.type === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Pays</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Côte d'Ivoire" />
              </div>
              <Button className="w-full" onClick={() => setWizStep(2)} disabled={!form.name || !form.slug}>
                Suivant
              </Button>
            </div>
          )}

          {wizStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Email du propriétaire</Label>
                <Input type="email" value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} placeholder="directeur@enabel.be" />
              </div>
              <div>
                <Label>Nom du propriétaire</Label>
                <Input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} placeholder="Jean Dupont" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.send_invitation} onChange={e => setForm(f => ({ ...f, send_invitation: e.target.checked }))} />
                Envoyer l'invitation par email
              </label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setWizStep(1)}>Retour</Button>
                <Button className="flex-1" onClick={handleCreate} disabled={wizLoading}>
                  {wizLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Créer l'organisation
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
