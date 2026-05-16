// src/components/ba/EquipeContent.tsx
// Contenu pur de l'onglet Équipe BA (sans DashboardLayout) — réutilisable
// dans EquipePage (standalone deep link) et BaWorkspacePage (tab Équipe).
//
// Pattern aligné PE (PeTeamTab) : filtre statut + sort par date desc
// + actions Renvoyer/Révoquer sur les invitations.
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Loader2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { useBaTeamMembers } from '@/hooks/useBaTeamMembers';
import InviteMemberDialog from '@/components/ba/InviteMemberDialog';
import ImAnalystBindings from '@/components/ba/ImAnalystBindings';
import MemberActionsMenu from '@/components/ba/MemberActionsMenu';
import type { BaTeamMember, MemberStatus } from '@/types/equipe-ba';

type StatusFilter = 'all' | MemberStatus;

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface MemberRowProps {
  member: BaTeamMember;
  organizationId: string;
  currentUserId: string;
  currentUserOrgRole: string | null | undefined;
  onChanged: () => void;
}

function MemberRow({ member, organizationId, currentUserId, currentUserOrgRole, onChanged }: MemberRowProps) {
  const isInvitation = member.status === 'invited';
  const isDisabled = member.status === 'disabled';

  return (
    <TableRow className={isDisabled ? 'opacity-60' : ''}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {isInvitation ? (
            <span className="text-muted-foreground italic">— invité —</span>
          ) : (
            <span>{member.full_name || '—'}</span>
          )}
          {isInvitation && <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700">Invité</Badge>}
          {isDisabled && (
            <Badge variant="outline" className="text-[10px] border-muted-foreground/40 text-muted-foreground">
              Désactivé
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{member.email || '—'}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">{member.role_label}</Badge>
      </TableCell>
      <TableCell className="text-right font-medium">
        {member.role === 'analyst' || member.role === 'analyste' ? member.mandates_count : '—'}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {isInvitation
          ? `Invité ${timeAgo(member.invited_at)}`
          : member.last_activity_at
            ? timeAgo(member.last_activity_at)
            : `Membre depuis ${formatDate(member.joined_at)}`}
      </TableCell>
      <TableCell className="text-right">
        <MemberActionsMenu
          member={member}
          organizationId={organizationId}
          currentUserId={currentUserId}
          currentUserOrgRole={currentUserOrgRole}
          onChanged={onChanged}
        />
      </TableCell>
    </TableRow>
  );
}

export default function EquipeContent() {
  const { currentOrg, currentRole: orgRole } = useOrganization();
  const { user } = useAuth();
  const { members, loading, reload } = useBaTeamMembers(currentOrg?.id);
  const [showInvite, setShowInvite] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => ({
    active: members.filter(m => m.status === 'active').length,
    invited: members.filter(m => m.status === 'invited').length,
    disabled: members.filter(m => m.status === 'disabled').length,
  }), [members]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return members;
    return members.filter(m => m.status === statusFilter);
  }, [members, statusFilter]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{counts.active}</span>{' '}
          actif{counts.active > 1 ? 's' : ''}
          {counts.invited > 0 && (
            <> · <span className="font-medium text-amber-700">{counts.invited}</span> invitation{counts.invited > 1 ? 's' : ''} en attente</>
          )}
          {counts.disabled > 0 && (
            <> · <span className="font-medium text-muted-foreground">{counts.disabled}</span> désactivé{counts.disabled > 1 ? 's' : ''}</>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous ({members.length})</SelectItem>
              <SelectItem value="active">Actifs ({counts.active})</SelectItem>
              <SelectItem value="invited">Invitations ({counts.invited})</SelectItem>
              <SelectItem value="disabled">Désactivés ({counts.disabled})</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Inviter un membre
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead className="text-right">Mandats</TableHead>
              <TableHead className="text-right">Activité</TableHead>
              <TableHead className="text-right w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground italic py-6">
                  {statusFilter === 'all' ? 'Aucun membre' : 'Aucun résultat pour ce filtre'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(m => (
                <MemberRow
                  key={m.user_id}
                  member={m}
                  organizationId={currentOrg!.id}
                  currentUserId={user?.id || ''}
                  currentUserOrgRole={orgRole}
                  onChanged={reload}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {currentOrg && (
        <ImAnalystBindings organizationId={currentOrg.id} members={members} />
      )}

      {currentOrg && (
        <InviteMemberDialog
          open={showInvite}
          onOpenChange={setShowInvite}
          organizationId={currentOrg.id}
          inviterOrgRole={orgRole}
          onSent={reload}
        />
      )}
    </>
  );
}
