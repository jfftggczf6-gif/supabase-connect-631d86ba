// src/components/ba/MemberActionsMenu.tsx
// Menu dropdown actions par membre (page Équipe BA).
//   - Désactiver / Réactiver le compte (UPDATE is_active)
//   - Supprimer (DELETE organization_members, avec AlertDialog confirmation)
//
// Protections :
//   - Pas d'actions sur soi-même
//   - Pas d'action sur les invitations (status='invited' = pas encore en org_members)
//   - Owner intouchable pour MD/Partner (RLS bloquera de toute façon)
import { useState } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, UserX, UserCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BaTeamMember } from '@/types/equipe-ba';

interface Props {
  member: BaTeamMember;
  organizationId: string;
  /** ID du user courant — sert à bloquer les actions sur soi-même. */
  currentUserId: string;
  /** Rôle org du user courant — sert à bloquer les actions sur owner. */
  currentUserOrgRole: string | null | undefined;
  onChanged: () => void;
}

export default function MemberActionsMenu({
  member, organizationId, currentUserId, currentUserOrgRole, onChanged,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSelf = member.user_id === currentUserId;
  const isOwnerTarget = member.role === 'owner';
  const currentIsOwnerOrAdmin = currentUserOrgRole === 'owner' || currentUserOrgRole === 'admin';
  // MD/Partner ne peut pas désactiver/supprimer un owner. Owner/admin peuvent tout.
  const cannotTouch = isSelf || (isOwnerTarget && !currentIsOwnerOrAdmin);

  // Pas de menu pour les invitations (pas encore dans org_members).
  if (member.status === 'invited') return null;

  const toggleActive = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('organization_members')
      .update({ is_active: member.status === 'active' ? false : true })
      .eq('organization_id', organizationId)
      .eq('user_id', member.user_id);
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Action refusée');
      return;
    }
    toast.success(
      member.status === 'active'
        ? `${member.full_name || member.email} désactivé`
        : `${member.full_name || member.email} réactivé`,
    );
    onChanged();
  };

  const handleDelete = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', member.user_id);
    setBusy(false);
    setConfirmDelete(false);
    if (error) {
      toast.error(error.message || 'Suppression refusée');
      return;
    }
    toast.success(`${member.full_name || member.email} retiré de l'équipe`);
    onChanged();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={cannotTouch || busy}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {member.status === 'active' ? (
            <DropdownMenuItem onClick={toggleActive} className="gap-2">
              <UserX className="h-3.5 w-3.5" /> Désactiver
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={toggleActive} className="gap-2">
              <UserCheck className="h-3.5 w-3.5" /> Réactiver
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {member.full_name || member.email} de l'équipe ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action retire le membre de l'organisation. Ses mandats actifs resteront
              assignés mais il n'aura plus accès. Le compte utilisateur Supabase reste actif —
              il peut être réinvité plus tard.
              <br /><br />
              <strong>Cette action est irréversible côté équipe.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
