import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole, humanizeRole } from '@/hooks/useCurrentRole';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Loader2, UserPlus, Mail } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

export default function MembersPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { canInviteMembers, canManageOrg } = useCurrentRole();
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'coach', message: '' });
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    if (!currentOrg) return;
    setLoading(true);

    const [membersRes, invitationsRes] = await Promise.all([
      supabase
        .from('organization_members')
        .select('id, user_id, role, joined_at, is_active, profiles:user_id(full_name, email)')
        .eq('organization_id', currentOrg.id)
        .eq('is_active', true)
        .order('joined_at'),
      supabase
        .from('organization_invitations')
        .select('id, email, role, created_at, expires_at, accepted_at, revoked_at, invited_by')
        .eq('organization_id', currentOrg.id)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false }),
    ]);

    setMembers(membersRes.data || []);
    setInvitations(invitationsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [currentOrg?.id]);

  const handleInvite = async () => {
    if (!currentOrg) return;
    setInviting(true);
    try {
      const token = await getValidAccessToken(null);
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          email: inviteForm.email,
          role: inviteForm.role,
          organization_id: currentOrg.id,
          personal_message: inviteForm.message || undefined,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast.success(`Invitation envoyée à ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: '', role: 'coach', message: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setInviting(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const INVITABLE_ROLES = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'manager', label: humanizeRole('manager', currentOrg?.type || null) },
    { value: 'analyst', label: humanizeRole('analyst', currentOrg?.type || null) },
    { value: 'coach', label: humanizeRole('coach', currentOrg?.type || null) },
    { value: 'entrepreneur', label: 'Entrepreneur' },
  ];

  return (
    <DashboardLayout title="Membres" subtitle={currentOrg?.name || ''}>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate('/dashboard')}>
        ← Retour au dashboard
      </Button>
      <Tabs defaultValue="members">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="members">Membres actifs ({members.length})</TabsTrigger>
            <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
          </TabsList>
          {canInviteMembers && (
            <Button className="gap-2" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4" /> Inviter un membre
            </Button>
          )}
        </div>

        <TabsContent value="members">
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
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : members.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{(m.profiles as any)?.full_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(m.profiles as any)?.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{humanizeRole(m.role, currentOrg?.type || null)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(m.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations">
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
                      <TableCell><Badge variant="outline">{humanizeRole(inv.role, currentOrg?.type || null)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.expires_at)}</TableCell>
                    </TableRow>
                  ))}
                  {!invitations.length && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune invitation en attente</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal invitation */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter un membre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="coach@example.com" />
            </div>
            <div>
              <Label>Rôle *</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message personnel (optionnel)</Label>
              <Textarea rows={3} value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} placeholder="Bienvenue dans l'équipe..." />
            </div>
            <Button className="w-full gap-2" onClick={handleInvite} disabled={!inviteForm.email || inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Envoyer l'invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
