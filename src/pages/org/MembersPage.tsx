import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { humanizeRole, getInvitableRoles } from '@/lib/roles';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail, Trash2, Clock } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

type Row =
  | {
      kind: 'member';
      id: string;
      user_id: string;
      name: string;
      email: string;
      role: string;
      date: string;
      status: 'active';
    }
  | {
      kind: 'invitation';
      id: string;
      email: string;
      role: string;
      date: string;
      expires_at: string;
      status: 'pending' | 'expired';
    };

export default function MembersPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { canInviteMembers, canManageOrg, role: myRole, isSuperAdmin } = useCurrentRole();
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'coach', message: '' });
  const [inviting, setInviting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

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

      // L'edge function indique si l'email a vraiment été envoyé (Resend up vs down).
      // Si non envoyé : on conserve l'invitation en DB et on propose le lien à copier
      // pour que le manager puisse le transmettre manuellement.
      if (result.email_sent === false && result.invitation_url) {
        try { await navigator.clipboard.writeText(result.invitation_url); } catch { /* clipboard refusé */ }
        toast.warning(
          `Invitation créée mais email pas envoyé (${result.email_error || 'erreur inconnue'}). Lien copié dans le presse-papier — transmets-le manuellement à ${inviteForm.email}.`,
          { duration: 12000 },
        );
      } else {
        toast.success(`Invitation envoyée à ${inviteForm.email}`);
      }

      setShowInvite(false);
      setInviteForm({ email: '', role: 'coach', message: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setInviting(false);
  };

  const handleRemoveMember = async (member: { id: string; user_id: string; name: string }) => {
    if (member.user_id === currentUserId) {
      toast.error('Tu ne peux pas te retirer toi-même.');
      return;
    }
    if (!confirm(`Retirer ${member.name} de l'organisation ? Le compte sera désactivé.`)) return;
    setActingId(member.id);
    const { error } = await supabase
      .from('organization_members')
      .update({ is_active: false })
      .eq('id', member.id);
    setActingId(null);
    if (error) {
      toast.error(`Échec : ${error.message}`);
      return;
    }
    toast.success(`${member.name} retiré·e de l'organisation`);
    fetchData();
  };

  const handleRevokeInvitation = async (inv: { id: string; email: string }) => {
    if (!confirm(`Révoquer l'invitation envoyée à ${inv.email} ?`)) return;
    setActingId(inv.id);
    const { error } = await supabase
      .from('organization_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inv.id);
    setActingId(null);
    if (error) {
      toast.error(`Échec : ${error.message}`);
      return;
    }
    toast.success(`Invitation révoquée`);
    fetchData();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // Liste filtrée selon le type d'org (pas d'analyste pour Programme, pas de coach pour PE)
  // et selon la hiérarchie (un manager ne peut pas inviter un admin par exemple).
  const INVITABLE_ROLES = getInvitableRoles(currentOrg?.type, myRole, isSuperAdmin);

  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    const memberRows: Row[] = members.map((m: any) => ({
      kind: 'member',
      id: m.id,
      user_id: m.user_id,
      name: (m.profiles as any)?.full_name || '—',
      email: (m.profiles as any)?.email || '—',
      role: m.role,
      date: m.joined_at,
      status: 'active',
    }));
    const invRows: Row[] = invitations.map((inv: any) => ({
      kind: 'invitation',
      id: inv.id,
      email: inv.email,
      role: inv.role,
      date: inv.created_at,
      expires_at: inv.expires_at,
      status: new Date(inv.expires_at).getTime() < now ? 'expired' : 'pending',
    }));
    // Members first (active, sorted by join date), then invitations (most recent first)
    return [...memberRows, ...invRows];
  }, [members, invitations]);

  const activeCount = members.length;
  const pendingCount = invitations.length;

  return (
    <DashboardLayout title="Membres" subtitle={currentOrg?.name || ''}>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate('/dashboard')}>
        ← Retour au dashboard
      </Button>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{activeCount}</span> actif{activeCount > 1 ? 's' : ''}
          {' · '}
          <span className="font-medium text-foreground">{pendingCount}</span> invitation{pendingCount > 1 ? 's' : ''} en attente
        </div>
        {canInviteMembers && (
          <Button className="gap-2" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" /> Inviter un membre
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                {canManageOrg && <TableHead className="w-[60px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canManageOrg ? 6 : 5} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageOrg ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    Aucun membre ni invitation pour le moment.
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => {
                const isMember = row.kind === 'member';
                const isSelf = isMember && row.user_id === currentUserId;
                const acting = actingId === row.id;
                return (
                  <TableRow key={`${row.kind}-${row.id}`}>
                    <TableCell className="font-medium">
                      {isMember ? row.name : <span className="text-muted-foreground italic">— invité —</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{humanizeRole(row.role, currentOrg?.type || null)}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.status === 'active' && (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                          Actif
                        </Badge>
                      )}
                      {row.status === 'pending' && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 gap-1">
                          <Mail className="h-3 w-3" /> Invitation envoyée
                        </Badge>
                      )}
                      {row.status === 'expired' && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                          <Clock className="h-3 w-3" /> Expirée
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(row.date)}</TableCell>
                    {canManageOrg && (
                      <TableCell className="text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-muted-foreground italic">vous</span>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={acting}
                            title={isMember ? 'Retirer ce membre' : 'Révoquer cette invitation'}
                            onClick={() => isMember
                              ? handleRemoveMember({ id: row.id, user_id: row.user_id, name: row.name })
                              : handleRevokeInvitation({ id: row.id, email: row.email })
                            }
                          >
                            {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
