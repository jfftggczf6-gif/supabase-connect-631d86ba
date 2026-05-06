// PeTeamTab — onglet "Équipe" du workspace MD
// Tableau membres : Nom / Rôle / Responsable / Statut / Deals / Date / Actions (3-dots)
// Bouton "Inviter un membre" → modal Email + Rôle + bouton Envoyer (pas de message perso)
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Loader2, Mail, MoreHorizontal, Pencil, Trash2, UserPlus, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useAuth } from '@/hooks/useAuth';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface Props {
  organizationId: string;
}

interface MemberRow {
  kind: 'member';
  id: string;            // organization_members.id
  user_id: string;
  name: string;
  email: string;
  role: string;
  responsable_name: string | null;
  status: 'actif' | 'inactif';
  deals_count: number;
  joined_at: string;
}
interface InvitationRow {
  kind: 'invitation';
  id: string;
  name: string;
  email: string;
  role: string;
  responsable_name: null;
  status: 'invité';
  deals_count: 0;
  joined_at: string;
}
type Row = MemberRow | InvitationRow;

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  owner:              { label: 'Propriétaire',          cls: 'bg-violet-100 text-violet-700' },
  admin:              { label: 'Admin',                 cls: 'bg-violet-50 text-violet-700' },
  managing_director:  { label: 'MD',                    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  investment_manager: { label: 'IM',                    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  analyst:            { label: 'Analyste',              cls: 'bg-slate-100 text-slate-700' },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  actif:    { label: 'Actif',                cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactif:  { label: 'Inactif',              cls: 'bg-slate-100 text-slate-600' },
  invité:   { label: 'Invitation en attente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const INVITE_ROLES = [
  { value: 'managing_director',  label: 'MD' },
  { value: 'investment_manager', label: 'IM' },
  { value: 'analyst',            label: 'Analyste' },
];

export default function PeTeamTab({ organizationId }: Props) {
  const { role } = useCurrentRole();
  const { user } = useAuth();
  const canManage = ['owner', 'admin', 'managing_director', 'investment_manager'].includes(role || '');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('analyst');
  const [inviteResponsableId, setInviteResponsableId] = useState<string>('none');

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Membres actifs et inactifs
    const { data: members } = await supabase
      .from('organization_members')
      .select('id, user_id, role, is_active, joined_at')
      .eq('organization_id', organizationId);

    const userIds = (members ?? []).map((m: any) => m.user_id);

    // 2. Profils (nom, email)
    const { data: profs } = userIds.length
      ? await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
      : { data: [] as any[] };
    const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));

    // 3. Compte de deals par lead_analyst (deals non-lost)
    const { data: dealCounts } = userIds.length
      ? await supabase.from('pe_deals')
          .select('lead_analyst_id')
          .eq('organization_id', organizationId)
          .neq('stage', 'lost')
          .in('lead_analyst_id', userIds)
      : { data: [] as any[] };
    const dealsByUser: Record<string, number> = {};
    (dealCounts ?? []).forEach((d: any) => {
      if (d.lead_analyst_id) dealsByUser[d.lead_analyst_id] = (dealsByUser[d.lead_analyst_id] ?? 0) + 1;
    });

    // 4. Invitations en attente
    const { data: invitations } = await supabase
      .from('organization_invitations')
      .select('id, email, role, created_at, accepted_at, revoked_at, expires_at')
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .is('revoked_at', null);
    const pending = (invitations ?? []).filter((i: any) =>
      !i.expires_at || new Date(i.expires_at) > new Date()
    );

    // 5. "Responsable" : nom du premier MD du fonds (placeholder — pas de colonne dédiée)
    const md = (members ?? []).find((m: any) => m.role === 'managing_director' && m.is_active);
    const mdProfile = md ? profMap.get(md.user_id) : null;
    const responsableName = mdProfile?.full_name ?? null;

    const memberRows: MemberRow[] = (members ?? []).map((m: any) => {
      const p = profMap.get(m.user_id);
      return {
        kind: 'member',
        id: m.id,
        user_id: m.user_id,
        name: p?.full_name ?? p?.email?.split('@')[0] ?? '—',
        email: p?.email ?? '—',
        role: m.role,
        responsable_name: m.role === 'managing_director' || m.role === 'owner' || m.role === 'admin' ? null : responsableName,
        status: m.is_active ? 'actif' : 'inactif',
        deals_count: dealsByUser[m.user_id] ?? 0,
        joined_at: m.joined_at,
      };
    });

    const invitationRows: InvitationRow[] = pending.map((i: any) => ({
      kind: 'invitation',
      id: i.id,
      name: i.email.split('@')[0],
      email: i.email,
      role: i.role,
      responsable_name: null,
      status: 'invité',
      deals_count: 0,
      joined_at: i.created_at,
    }));

    setRows([...memberRows, ...invitationRows].sort((a, b) =>
      (b.joined_at ?? '').localeCompare(a.joined_at ?? '')
    ));
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter(r => r.status === statusFilter);
  }, [rows, statusFilter]);

  const activeCount = rows.filter(r => r.status === 'actif').length;
  const pendingCount = rows.filter(r => r.status === 'invité').length;

  // Liste des responsables potentiels (owner/admin/MD/IM actifs) pour le dropdown
  const responsableOptions = useMemo(() =>
    rows
      .filter((r): r is MemberRow => r.kind === 'member' && r.status === 'actif'
        && ['owner', 'admin', 'managing_director', 'investment_manager'].includes(r.role))
      .map(r => ({ user_id: r.user_id, name: r.name, role: r.role })),
    [rows]
  );

  const handleInvite = async () => {
    if (!inviteFullName.trim() || !inviteEmail.trim() || !inviteRole) {
      toast.error('Nom, email et rôle requis');
      return;
    }
    setInviting(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          organization_id: organizationId,
          full_name: inviteFullName.trim(),
          responsable_user_id: inviteResponsableId === 'none' ? null : inviteResponsableId,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);

      if (result.email_sent === false && result.invitation_url) {
        try { await navigator.clipboard.writeText(result.invitation_url); } catch { /* ignore */ }
        toast.warning(
          `Invitation créée mais email non envoyé. Lien copié — transmets-le à ${inviteEmail}.`,
          { duration: 12000 },
        );
      } else {
        toast.success(`Invitation envoyée à ${inviteEmail}`);
      }
      setShowInvite(false);
      setInviteFullName('');
      setInviteEmail('');
      setInviteRole('analyst');
      setInviteResponsableId('none');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setInviting(false);
  };

  const handleRemove = async (row: MemberRow) => {
    if (row.user_id === user?.id) { toast.error('Tu ne peux pas te retirer toi-même.'); return; }
    if (!confirm(`Retirer ${row.name} du fonds ? Le compte sera désactivé.`)) return;
    const { error } = await supabase
      .from('organization_members')
      .update({ is_active: false })
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${row.name} retiré du fonds`);
    load();
  };

  const handleRevokeInvitation = async (row: InvitationRow) => {
    if (!confirm(`Révoquer l'invitation envoyée à ${row.email} ?`)) return;
    const { error } = await supabase
      .from('organization_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Invitation révoquée');
    load();
  };

  const handleResendInvitation = async (row: InvitationRow) => {
    // Récupère le lien existant pour le ré-envoyer (placeholder — on relance via send-invitation)
    setInviteEmail(row.email);
    setInviteRole(row.role);
    setShowInvite(true);
  };

  const handleRoleChange = async (row: MemberRow, newRole: string) => {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rôle de ${row.name} mis à jour`);
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header : compteur + filtres + bouton inviter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Espace équipe & invitations</h2>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{activeCount}</span> actif{activeCount > 1 ? 's' : ''}
            {pendingCount > 0 && <> · <span className="font-medium text-foreground">{pendingCount}</span> invitation{pendingCount > 1 ? 's' : ''} en attente</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="actif">Actifs</SelectItem>
              <SelectItem value="invité">Invitations en attente</SelectItem>
              <SelectItem value="inactif">Inactifs</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={() => setShowInvite(true)} className="gap-2 bg-violet-600 hover:bg-violet-700">
              <UserPlus className="h-4 w-4" /> Inviter un membre
            </Button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Deals</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Aucun membre ne correspond aux filtres.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(r => {
                  const roleInfo = ROLE_LABELS[r.role] || { label: r.role, cls: 'bg-slate-100 text-slate-700' };
                  const statusInfo = STATUS_LABELS[r.status] || { label: r.status, cls: '' };
                  return (
                    <TableRow key={`${r.kind}-${r.id}`}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleInfo.cls}>{roleInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.responsable_name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusInfo.cls}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {r.kind === 'member' ? r.deals_count : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {r.joined_at ? new Date(r.joined_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {r.kind === 'member' ? (
                                <>
                                  {r.user_id === user?.id ? (
                                    <DropdownMenuItem disabled>
                                      <Pencil className="h-4 w-4 mr-2" /> Action désactivée pour soi-même
                                    </DropdownMenuItem>
                                  ) : (
                                    <>
                                      <div className="px-2 py-1 text-xs text-muted-foreground">Modifier le rôle</div>
                                      {INVITE_ROLES.map(opt => (
                                        <DropdownMenuItem
                                          key={opt.value}
                                          onClick={() => handleRoleChange(r, opt.value)}
                                          disabled={r.role === opt.value}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" /> {opt.label}
                                          {r.role === opt.value && <span className="ml-auto text-[10px] text-muted-foreground">actuel</span>}
                                        </DropdownMenuItem>
                                      ))}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleRemove(r)} className="text-red-600 focus:text-red-700">
                                        <Trash2 className="h-4 w-4 mr-2" /> Retirer du fonds
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => handleResendInvitation(r)}>
                                    <Send className="h-4 w-4 mr-2" /> Renvoyer l'invitation
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleRevokeInvitation(r)} className="text-red-600 focus:text-red-700">
                                    <Trash2 className="h-4 w-4 mr-2" /> Révoquer l'invitation
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* === Modal Inviter un membre === */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-violet-600" /> Inviter un membre
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="invite-name" className="text-xs">Nom et prénom *</Label>
              <Input
                id="invite-name"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="Prénom Nom"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email" className="text-xs">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="prenom.nom@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rôle *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsable</Label>
              <Select value={inviteResponsableId} onValueChange={setInviteResponsableId}>
                <SelectTrigger><SelectValue placeholder="Aucun (rapport direct au MD)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (rapport direct au MD)</SelectItem>
                  {responsableOptions.map(o => {
                    const roleLabel = ROLE_LABELS[o.role]?.label ?? o.role;
                    return (
                      <SelectItem key={o.user_id} value={o.user_id}>
                        {o.name} <span className="text-muted-foreground text-xs">({roleLabel})</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)} disabled={inviting}>
              Annuler
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-2 bg-violet-600 hover:bg-violet-700">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
