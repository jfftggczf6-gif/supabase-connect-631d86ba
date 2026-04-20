import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users, Building2, Settings, UserPlus, Mail, RefreshCw } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { humanizeRole } from '@/hooks/useCurrentRole';

interface OrgDetail {
  id: string; name: string; slug: string; type: string;
  country: string | null; logo_url: string | null;
  primary_color: string | null; secondary_color: string | null;
  settings: any; is_active: boolean; created_at: string;
}

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'coach' });
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', country: '' });

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    const [orgRes, membersRes, enterprisesRes, invitationsRes] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', id).single(),
      supabase.from('organization_members')
        .select('id, user_id, role, joined_at, is_active, profiles:user_id(full_name, email)')
        .eq('organization_id', id).eq('is_active', true).order('joined_at'),
      supabase.from('enterprises')
        .select('id, name, sector, country, score_ir, phase, created_at')
        .eq('organization_id', id).order('name'),
      supabase.from('organization_invitations')
        .select('id, email, role, created_at, expires_at, accepted_at, revoked_at')
        .eq('organization_id', id).is('accepted_at', null).is('revoked_at', null)
        .order('created_at', { ascending: false }),
    ]);

    if (orgRes.data) {
      setOrg(orgRes.data as OrgDetail);
      setEditForm({ name: orgRes.data.name, country: orgRes.data.country || '' });
    }
    setMembers(membersRes.data || []);
    setEnterprises(enterprisesRes.data || []);
    setInvitations(invitationsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleInvite = async () => {
    if (!id) return;
    setInviting(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: inviteForm.email, role: inviteForm.role, organization_id: id }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast.success(`Invitation envoyée à ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: '', role: 'coach' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setInviting(false);
  };

  const handleSaveSettings = async () => {
    if (!id) return;
    const { error } = await supabase.from('organizations')
      .update({ name: editForm.name, country: editForm.country || null })
      .eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Organisation mise à jour'); setEditing(false); fetchData(); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <DashboardLayout title="Organisation" subtitle="">
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  if (!org) {
    return (
      <DashboardLayout title="Organisation" subtitle="">
        <p className="text-center text-muted-foreground py-16">Organisation non trouvée</p>
      </DashboardLayout>
    );
  }

  const ROLES = [
    { value: 'owner', label: 'Propriétaire' },
    { value: 'admin', label: 'Administrateur' },
    { value: 'manager', label: humanizeRole('manager', org.type) },
    { value: 'analyst', label: humanizeRole('analyst', org.type) },
    { value: 'coach', label: humanizeRole('coach', org.type) },
    { value: 'entrepreneur', label: 'Entrepreneur' },
  ];

  return (
    <DashboardLayout title={org.name} subtitle={`${org.type} — ${org.country || '—'}`}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate('/admin/organizations')}>
          <ArrowLeft className="h-4 w-4" /> Retour aux organisations
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-muted-foreground">Membres</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{enterprises.length}</p>
              <p className="text-xs text-muted-foreground">Entreprises</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{invitations.length}</p>
              <p className="text-xs text-muted-foreground">Invitations en attente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Membres ({members.length})</TabsTrigger>
          <TabsTrigger value="enterprises">Entreprises ({enterprises.length})</TabsTrigger>
          <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="gap-1.5" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4" /> Inviter un membre
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Depuis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{(m.profiles as any)?.full_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(m.profiles as any)?.email || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{humanizeRole(m.role, org.type)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(m.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enterprises" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead>Score IR</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Créée le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enterprises.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-sm">{e.sector || '—'}</TableCell>
                      <TableCell className="text-sm">{e.country || '—'}</TableCell>
                      <TableCell><Badge variant={e.score_ir >= 70 ? 'default' : 'outline'}>{e.score_ir ?? '—'}</Badge></TableCell>
                      <TableCell className="text-sm capitalize">{e.phase || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {!enterprises.length && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune entreprise</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Envoyée le</TableHead>
                    <TableHead>Expire le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><Badge variant="outline">{humanizeRole(inv.role, org.type)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.expires_at)}</TableCell>
                    </TableRow>
                  ))}
                  {!invitations.length && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune invitation</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" /> Paramètres de l'organisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nom</Label>
                  <Input value={editForm.name} onChange={e => { setEditForm(f => ({ ...f, name: e.target.value })); setEditing(true); }} />
                </div>
                <div>
                  <Label>Pays</Label>
                  <Input value={editForm.country} onChange={e => { setEditForm(f => ({ ...f, country: e.target.value })); setEditing(true); }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Input value={org.type} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={org.slug} disabled className="bg-muted" />
                </div>
              </div>
              <div>
                <Label>Créée le</Label>
                <Input value={formatDate(org.created_at)} disabled className="bg-muted" />
              </div>
              {editing && (
                <Button onClick={handleSaveSettings}>Enregistrer les modifications</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal invitation */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter un membre à {org.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="membre@example.com" />
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleInvite} disabled={!inviteForm.email || inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Envoyer l'invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
