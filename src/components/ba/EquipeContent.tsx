// src/components/ba/EquipeContent.tsx
// Contenu pur de l'onglet Équipe BA (sans DashboardLayout) — réutilisable
// dans EquipePage (standalone deep link) et BaWorkspacePage (tab Équipe).
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Loader2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBaTeamMembers } from '@/hooks/useBaTeamMembers';
import InviteMemberDialog from '@/components/ba/InviteMemberDialog';
import ImAnalystBindings from '@/components/ba/ImAnalystBindings';
import type { BaTeamMember } from '@/types/equipe-ba';

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

function MemberRow({ member }: { member: BaTeamMember }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span>{member.full_name || '—'}</span>
          {member.status === 'invited' && (
            <Badge variant="outline" className="text-[10px]">Invité</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">{member.role_label}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{member.email || '—'}</TableCell>
      <TableCell className="text-right font-medium">
        {member.role === 'analyst' || member.role === 'analyste' ? member.mandates_count : '—'}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {member.status === 'invited' ? `Invité ${timeAgo(member.invited_at)}` : timeAgo(member.last_activity_at)}
      </TableCell>
    </TableRow>
  );
}

export default function EquipeContent() {
  const { currentOrg, currentRole: orgRole } = useOrganization();
  const { members, loading, reload } = useBaTeamMembers(currentOrg?.id);
  const [showInvite, setShowInvite] = useState(false);

  const activeCount = useMemo(() => members.filter(m => m.status === 'active').length, [members]);
  const invitedCount = useMemo(() => members.filter(m => m.status === 'invited').length, [members]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{activeCount}</span>{' '}
          membre{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}
          {invitedCount > 0 && (
            <> · {invitedCount} invitation{invitedCount > 1 ? 's' : ''} en cours</>
          )}
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Inviter un membre
        </Button>
      </div>

      <Card className="overflow-hidden mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Mandats</TableHead>
              <TableHead className="text-right">Dernière activité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground italic py-6">
                  Aucun membre
                </TableCell>
              </TableRow>
            ) : (
              members.map(m => <MemberRow key={m.user_id} member={m} />)
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
