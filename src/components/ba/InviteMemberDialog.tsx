// src/components/ba/InviteMemberDialog.tsx
// Formulaire d'invitation d'un nouveau membre BA via l'EF send-invitation.
//
// Brief : champs email, full_name, rôle (select analyst / IM / MD).
// Le Partner (MD) peut inviter analyst et IM. Pour inviter un autre MD, il
// faut être owner. La matrice est appliquée par l'EF (retour 403 si non).
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { BA_ROLE_LABELS, type BaInviteRole } from '@/types/equipe-ba';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  /** Rôle org de l'utilisateur courant — filtre les options invitables. */
  inviterOrgRole: string | null | undefined;
  onSent: () => void;
}

const ROLE_OPTIONS: { value: BaInviteRole; label: string }[] = [
  { value: 'analyst', label: BA_ROLE_LABELS.analyst },
  { value: 'investment_manager', label: BA_ROLE_LABELS.investment_manager },
  { value: 'managing_director', label: BA_ROLE_LABELS.managing_director },
];

/** Matrice front (mirror EF) : qui peut inviter quel rôle.
 *  Source : INVITE_PERMISSIONS dans send-invitation/index.ts. */
function allowedInvitableRoles(inviterOrgRole: string | null | undefined): BaInviteRole[] {
  if (inviterOrgRole === 'owner' || inviterOrgRole === 'admin') {
    return ['analyst', 'investment_manager', 'managing_director'];
  }
  if (inviterOrgRole === 'managing_director') {
    return ['analyst', 'investment_manager'];
  }
  return [];
}

export default function InviteMemberDialog({
  open, onOpenChange, organizationId, inviterOrgRole, onSent,
}: Props) {
  const invitableRoles = allowedInvitableRoles(inviterOrgRole);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BaInviteRole>(invitableRoles[0] ?? 'analyst');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFullName('');
    setEmail('');
    setRole(invitableRoles[0] ?? 'analyst');
    setMessage('');
  };

  const handleSend = async () => {
    const trimEmail = email.trim();
    if (!trimEmail) {
      toast.error("L'email est requis");
      return;
    }
    if (!invitableRoles.includes(role)) {
      toast.error("Vous n'avez pas la permission d'inviter ce rôle");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('send-invitation', {
      body: {
        organization_id: organizationId,
        email: trimEmail,
        role,
        full_name: fullName.trim() || undefined,
        personal_message: message.trim() || undefined,
      },
    });
    setSubmitting(false);

    // supabase-js wrap les 4xx/5xx en FunctionsHttpError dont le body
    // n'est PAS automatiquement exposé. On le récupère via error.context
    // (Response), ou on lit data?.error si la réponse est 2xx mais flaggée.
    let realError: string | null = null;
    if (error) {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const body = await ctx.json();
          realError = body?.error ?? null;
        } catch { /* body non-JSON, ignore */ }
      }
      if (!realError) realError = error.message;
    } else if ((data as any)?.error) {
      realError = (data as any).error;
    }

    if (realError) {
      toast.error(realError);
      return;
    }
    toast.success('Invitation envoyée');
    reset();
    onSent();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter un membre</DialogTitle>
          <DialogDescription>
            Un email d'invitation sera envoyé. Le compte sera créé après acceptation et premier login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nom complet</Label>
            <Input
              id="invite-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex : A. Diallo"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">
              Email professionnel <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@cabinet-ba.com"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as BaInviteRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.filter(o => invitableRoles.includes(o.value)).map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invitableRoles.length === 0 && (
              <p className="text-[11px] text-destructive">
                Votre rôle ne permet pas d'inviter d'autres membres.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-msg">
              Message personnel <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <Textarea
              id="invite-msg"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex : Rejoins l'équipe pour le mandat PharmaCi."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { reset(); onOpenChange(false); }}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={submitting || !email.trim() || invitableRoles.length === 0}
          >
            {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Envoi…</> : "Envoyer l'invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
