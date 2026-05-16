// src/components/ba/MemberActionsMenu.tsx
// Menu dropdown actions par membre OU invitation (page Équipe BA).
//
// Membre actif/désactivé :
//   - Désactiver / Réactiver (UPDATE is_active)
//   - Supprimer (DELETE org_members, AlertDialog confirmation)
//
// Invitation en attente :
//   - Renvoyer l'invitation (relance send-invitation, copie le lien si email KO)
//   - Révoquer l'invitation (UPDATE revoked_at)
//
// Protections :
//   - Pas d'actions sur soi-même
//   - MD/Partner ne peut pas désactiver/supprimer un owner
import { useState } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, UserX, UserCheck, Trash2, Mail, XCircle } from 'lucide-react';
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
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState(false);

  const isInvitation = member.status === 'invited';
  const isSelf = !isInvitation && member.user_id === currentUserId;
  const isOwnerTarget = member.role === 'owner';
  const currentIsOwnerOrAdmin = currentUserOrgRole === 'owner' || currentUserOrgRole === 'admin';
  const cannotTouch = isSelf || (isOwnerTarget && !currentIsOwnerOrAdmin);

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

  const handleResendInvite = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('send-invitation', {
      body: {
        organization_id: organizationId,
        email: member.email,
        role: member.role,
        full_name: member.full_name ?? undefined,
      },
    });
    setBusy(false);

    let realError: string | null = null;
    if (error) {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try { realError = (await ctx.json())?.error ?? null; } catch {}
      }
      if (!realError) realError = error.message;
    } else if ((data as any)?.error) {
      realError = (data as any).error;
    }
    if (realError) {
      toast.error(realError);
      return;
    }

    // Si email pas envoyé mais invitation OK, copie le lien en presse-papier.
    if ((data as any)?.email_sent === false && (data as any)?.invitation_url) {
      try { await navigator.clipboard.writeText((data as any).invitation_url); } catch {}
      toast.warning(
        `Lien copié dans le presse-papier (email non envoyé). Transmets-le à ${member.email}.`,
        { duration: 10000 },
      );
    } else {
      toast.success(`Invitation renvoyée à ${member.email}`);
    }
    onChanged();
  };

  const handleRevokeInvite = async () => {
    if (!member.invitation_id) return;
    setBusy(true);
    const { error } = await supabase
      .from('organization_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', member.invitation_id);
    setBusy(false);
    setConfirmRevoke(false);
    if (error) {
      toast.error(error.message || 'Révocation refusée');
      return;
    }
    toast.success(`Invitation à ${member.email} révoquée`);
    onChanged();
  };

  // ─── Menu invitation ───────────────────────────────────────────
  if (isInvitation) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={busy}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleResendInvite} className="gap-2">
              <Mail className="h-3.5 w-3.5" /> Renvoyer l'invitation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setConfirmRevoke(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <XCircle className="h-3.5 w-3.5" /> Révoquer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Révoquer l'invitation à {member.email} ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le lien d'invitation envoyé ne sera plus valide. Tu pourras toujours envoyer une
                nouvelle invitation à cette adresse plus tard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevokeInvite}
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Révoquer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ─── Menu membre (actif ou désactivé) ──────────────────────────
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
