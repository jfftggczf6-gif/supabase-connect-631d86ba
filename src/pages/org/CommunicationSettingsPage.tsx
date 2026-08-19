// Réglages d'organisation — section « Communication » (brief 2, critères 1-3).
// Accès owner/admin uniquement (garde de rôle sur la route). Identité d'émission :
// signature par défaut, nom d'expéditeur, adresse de réponse de repli, logo, avec
// aperçu d'un e-mail type. Les valeurs vides se CALCULENT au rendu (jamais en dur).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { computeSignature, computeSenderName, isValidEmail } from '@/lib/email-identity';
import { buildCommunicationEmail } from '@/lib/communication-email';

export default function CommunicationSettingsPage() {
  const { currentOrg, refreshOrganizations } = useOrganization();
  const [signature, setSignature] = useState('');
  const [senderName, setSenderName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    setSignature(currentOrg.email_signature ?? '');
    setSenderName(currentOrg.email_sender_name ?? '');
    setReplyTo(currentOrg.email_reply_to ?? '');
    setLogoUrl(currentOrg.logo_url ?? '');
  }, [currentOrg]);

  // Org « virtuelle » = valeurs du formulaire, pour un aperçu qui reflète la saisie.
  const orgApercu = {
    name: currentOrg?.name,
    email_signature: signature,
    email_sender_name: senderName,
    logo_url: logoUrl,
  };
  const apercu = useMemo(() => buildCommunicationEmail({
    subject: 'Exemple — annonce',
    body: 'Bonjour,\n\nCeci est un aperçu du rendu de vos e-mails.\n\nÀ bientôt.',
    closing: computeSignature(orgApercu),
    logoUrl: logoUrl || null,
  }), [signature, logoUrl, currentOrg]);

  const replyToInvalide = replyTo.trim() !== '' && !isValidEmail(replyTo);
  const nomDefaut = computeSenderName({ name: currentOrg?.name });
  const signatureDefaut = computeSignature({ name: currentOrg?.name });

  const save = async () => {
    if (!currentOrg) return;
    if (replyToInvalide) { toast({ title: 'Adresse de réponse invalide', description: 'Corrige le format avant d\'enregistrer.', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('organizations').update({
      email_signature: signature.trim() || null,
      email_sender_name: senderName.trim() || null,
      email_reply_to: replyTo.trim() || null,
      logo_url: logoUrl.trim() || null,
    }).eq('id', currentOrg.id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Réglages enregistrés' }); await refreshOrganizations(); }
    setSaving(false);
  };

  return (
    <DashboardLayout title="Communication" subtitle={currentOrg?.name || ''}>
      <div className="grid md:grid-cols-2 gap-4 max-w-5xl">
        <Card><CardContent className="p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4 text-violet-600" /> Identité d'émission</h3>
          <p className="text-sm text-muted-foreground">
            Ces réglages portent l'identité des e-mails envoyés aux candidats par votre organisation. Laissés vides, ils se calculent automatiquement — jamais de valeur d'une autre organisation.
          </p>

          <div className="space-y-1">
            <Label htmlFor="sender">Nom d'expéditeur affiché</Label>
            <Input id="sender" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder={nomDefaut} />
            <p className="text-xs text-muted-foreground">Vide → « {nomDefaut} ». Envoyé depuis noreply@esono.tech.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="signature">Signature par défaut (formule de clôture)</Label>
            <Textarea id="signature" value={signature} onChange={e => setSignature(e.target.value)} rows={2} placeholder={signatureDefaut} />
            <p className="text-xs text-muted-foreground">Vide → « {signatureDefaut} ». Reste modifiable à chaque envoi sans écraser ce réglage.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reply">Adresse de réponse de repli</Label>
            <Input id="reply" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="info@votre-organisation.org" aria-invalid={replyToInvalide} />
            {replyToInvalide && <p className="text-xs text-destructive">Format d'adresse invalide.</p>}
            <p className="text-xs text-muted-foreground">Utilisée si l'émetteur n'a pas d'adresse de correspondance sur son compte. Sans adresse ni ici ni sur le compte, l'envoi est bloqué.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="logo">Logo d'en-tête (URL)</Label>
            <Input id="logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
          </div>

          <Button onClick={save} disabled={saving || replyToInvalide} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </Button>
        </CardContent></Card>

        <Card><CardContent className="p-5 space-y-2">
          <h3 className="font-semibold">Aperçu d'un e-mail type</h3>
          <p className="text-xs text-muted-foreground">Expéditeur : <strong>{computeSenderName(orgApercu)}</strong> &lt;noreply@esono.tech&gt;</p>
          <p className="text-xs text-muted-foreground">Réponse : {replyTo.trim() || '(adresse de l\'émetteur)'}</p>
          {/* Sûr : apercu.html vient de buildCommunicationEmail, qui échappe tout. */}
          <div className="rounded border bg-white p-3 text-sm" dangerouslySetInnerHTML={{ __html: apercu.html }} />
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
