// CompletionLinkDialog — génère un lien de complétion (recovery) pour une
// candidature incomplète, l'envoie par email au candidat (Resend via send-email)
// et affiche le lien pour copie manuelle en secours.
//
// Réutilise l'infrastructure existante :
//   - candidature-recovery (action: generate) → token 7j + URL publique
//   - send-email → envoi Resend
//   - buildCompletionEmail → contenu de l'email (helper pur testé)
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Copy, CheckCircle2, Mail, AlertTriangle, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { extractEdgeError } from '@/lib/edge-error';
import { buildCompletionEmail } from '@/lib/completion-email';
import { COMMON_REQUESTED_DOCUMENTS } from '@/lib/common-documents';

interface Props {
  candidatureId: string | null;
  contactEmail: string | null;
  contactName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CompletionLinkDialog({ candidatureId, contactEmail, contactName, open, onOpenChange }: Props) {
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requested, setRequested] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  const reset = () => {
    setLink(null); setEmailSent(false); setCopied(false); setSending(false);
    setRequested([]); setCustomInput('');
  };

  const toggleDoc = (label: string) =>
    setRequested(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);

  const addCustom = () => {
    const l = customInput.trim();
    if (l && !requested.includes(l)) setRequested(prev => [...prev, l]);
    setCustomInput('');
  };

  const customSelected = requested.filter(l => !COMMON_REQUESTED_DOCUMENTS.includes(l));

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleGenerate = async () => {
    if (!candidatureId) return;
    setSending(true);

    // 1. Génère le lien (permission vérifiée côté EF)
    const { data, error } = await supabase.functions.invoke('candidature-recovery', {
      body: { action: 'generate', candidature_id: candidatureId, origin: window.location.origin, requested_docs: requested },
    });
    const errMsg = await extractEdgeError(error, data);
    if (errMsg || !data?.recovery_url) {
      toast({ title: 'Erreur', description: errMsg || 'Lien non généré', variant: 'destructive' });
      setSending(false);
      return;
    }
    setLink(data.recovery_url);

    // 2. Envoie l'email au candidat (si on a une adresse)
    const to = data.contact_email || contactEmail;
    if (to) {
      const mail = buildCompletionEmail({
        companyName: data.company_name ?? null,
        contactName: data.contact_name ?? contactName ?? null,
        programmeName: data.programme_name ?? null,
        recoveryUrl: data.recovery_url,
        expiresAt: data.expires_at ?? null,
      });
      const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-email', {
        body: { to, subject: mail.subject, html: mail.html, text: mail.text },
      });
      const emailErrMsg = await extractEdgeError(emailErr, emailData);
      if (emailErrMsg) {
        toast({ title: 'Lien généré, mais email non envoyé', description: `${emailErrMsg}. Copiez le lien et envoyez-le manuellement.`, variant: 'destructive' });
      } else {
        setEmailSent(true);
        toast({ title: 'Lien envoyé', description: `Email envoyé à ${to}.` });
      }
    } else {
      toast({ title: 'Lien généré', description: "Aucun email candidat connu — copiez le lien et envoyez-le manuellement." });
    }
    setSending(false);
  };

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const to = contactEmail;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-violet-600" />
            Lien pour compléter le dossier
          </DialogTitle>
        </DialogHeader>

        {!link ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Génère un lien sécurisé (valable 7 jours) permettant au candidat de
              re-déposer ses documents manquants. Le lien lui sera envoyé par email.
            </p>
            {to ? (
              <p className="flex items-center gap-2 bg-muted/50 rounded p-2 text-xs">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>Sera envoyé à <strong>{to}</strong></span>
              </p>
            ) : (
              <p className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Aucun email candidat connu — le lien sera juste affiché pour copie.</span>
              </p>
            )}

            {/* Documents à demander en plus du formulaire */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium">Documents à demander en plus (optionnel)</p>
              <p className="text-[11px] text-muted-foreground">
                Les documents déjà demandés par le formulaire sont inclus automatiquement.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REQUESTED_DOCUMENTS.map(d => {
                  const on = requested.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDoc(d)}
                      className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
                        on ? 'bg-violet-600 text-white border-violet-600' : 'bg-background hover:bg-muted border-input'
                      }`}
                    >
                      {on ? '✓ ' : '+ '}{d}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                  placeholder="Autre document…"
                  className="text-xs h-8"
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={!customInput.trim()} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Ajouter
                </Button>
              </div>
              {customSelected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customSelected.map(l => (
                    <span key={l} className="inline-flex items-center gap-1 text-xs rounded-full bg-violet-100 text-violet-800 px-2.5 py-1">
                      {l}
                      <button type="button" onClick={() => toggleDoc(l)} className="hover:text-violet-950">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {emailSent ? 'Lien envoyé par email au candidat.' : 'Lien généré.'}
            </p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Lien (copie de secours) :</p>
              <div className="flex gap-2">
                <Input readOnly value={link} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button size="icon" variant="outline" onClick={copyLink} title="Copier">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!link ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={sending}>Annuler</Button>
              <Button onClick={handleGenerate} disabled={sending || !candidatureId} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Envoi...' : to ? 'Générer et envoyer' : 'Générer le lien'}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>Fermer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
