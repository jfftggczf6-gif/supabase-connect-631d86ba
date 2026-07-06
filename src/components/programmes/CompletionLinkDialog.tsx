// CompletionLinkDialog — génère un lien de complétion (recovery) pour une
// candidature incomplète, l'envoie par email au candidat (Resend via send-email)
// et affiche le lien pour copie manuelle en secours.
//
// Flux en 2 étapes :
//   1. Composer — choix des docs + 4 champs éditables (objet, intro, mot
//      personnel, clôture) préremplis avec les défauts du gabarit.
//   2. Aperçu — rendu FIDÈLE de l'email tel qu'il partira (même buildCompletionEmail).
//      Le lien signé n'est généré QU'au clic « Envoyer ».
//
// Garantie « aperçu = envoi » PAR CONSTRUCTION : l'objet email est construit une
// seule fois à partir des données LOCALES (props + champs saisis + docs). À
// l'envoi, on n'injecte que le vrai recoveryUrl + expiresAt renvoyés par l'EF ;
// company_name / programme_name renvoyés par l'EF sont ignorés.
//
// Réutilise l'infra existante :
//   - candidature-recovery (action: generate) → token 7j + URL publique
//   - send-email → envoi Resend
//   - buildCompletionEmail / completionEmailDefaults → contenu (helper pur testé)
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Copy, CheckCircle2, Mail, AlertTriangle, Plus, X, Eye, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { extractEdgeError } from '@/lib/edge-error';
import { buildCompletionEmail, completionEmailDefaults } from '@/lib/completion-email';
import { COMMON_REQUESTED_DOCUMENTS } from '@/lib/common-documents';

interface Props {
  candidatureId: string | null;
  contactEmail: string | null;
  contactName: string | null;
  companyName: string | null;
  programmeName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// URL factice pour l'aperçu — même forme que la vraie (${origin}/candidature/
// recovery/${token}) pour que le rendu du bouton et les retours à la ligne
// soient identiques à l'email final (critère 10).
const previewRecoveryUrl = () => `${window.location.origin}/candidature/recovery/apercu`;

export default function CompletionLinkDialog({
  candidatureId, contactEmail, contactName, companyName, programmeName, open, onOpenChange,
}: Props) {
  const [step, setStep] = useState<'compose' | 'preview'>('compose');
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requested, setRequested] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  // Champs éditables (préremplis avec les défauts du gabarit à l'ouverture).
  const [subject, setSubject] = useState('');
  const [intro, setIntro] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [closing, setClosing] = useState('');

  // (Ré)initialise tout à l'ouverture avec les défauts calculés par le MÊME
  // helper que le fallback côté buildCompletionEmail → prérempli = message complet.
  useEffect(() => {
    if (!open) return;
    const d = completionEmailDefaults({ companyName, programmeName });
    setSubject(d.subject);
    setIntro(d.intro);
    setPersonalNote('');
    setClosing(d.closing);
    setStep('compose');
    setLink(null); setEmailSent(false); setCopied(false); setSending(false);
    setRequested([]); setCustomInput('');
  }, [open, companyName, programmeName]);

  const toggleDoc = (label: string) =>
    setRequested(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);

  const addCustom = () => {
    const l = customInput.trim();
    if (l && !requested.includes(l)) setRequested(prev => [...prev, l]);
    setCustomInput('');
  };

  const customSelected = requested.filter(l => !COMMON_REQUESTED_DOCUMENTS.includes(l));

  const handleClose = (o: boolean) => onOpenChange(o);

  // Entrées communes à l'aperçu et à l'envoi — construites une seule fois à
  // partir des données LOCALES. Seuls recoveryUrl + expiresAt changent ensuite.
  const emailBaseInput = {
    companyName,
    contactName,
    programmeName,
    requestedDocs: requested,
    fields: { subject, intro, personalNote, closing },
  };

  // Aperçu : même buildCompletionEmail, URL placeholder, pas d'expiration connue.
  const previewEmail = buildCompletionEmail({
    ...emailBaseInput,
    recoveryUrl: previewRecoveryUrl(),
    expiresAt: null,
  });

  const handleSend = async () => {
    if (!candidatureId) return;
    setSending(true);

    // 1. Génère le lien signé — SEULEMENT ici, au clic « Envoyer ».
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

    // 2. Reconstruit l'email en n'injectant QUE recovery_url + expires_at.
    //    company_name / programme_name renvoyés par l'EF sont volontairement ignorés
    //    → le contenu envoyé est littéralement celui de l'aperçu, seul le lien change.
    const to = contactEmail;
    if (to) {
      const mail = buildCompletionEmail({
        ...emailBaseInput,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-violet-600" />
            Lien pour compléter le dossier
          </DialogTitle>
        </DialogHeader>

        {/* ── État final : lien généré / envoyé ─────────────────────────── */}
        {link ? (
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
        ) : step === 'preview' ? (
          /* ── Étape 2 : Aperçu (lecture seule) ────────────────────────── */
          <div className="space-y-3 text-sm">
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
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Objet</p>
              <p className="rounded border bg-background px-3 py-2 text-sm font-medium">{previewEmail.subject}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Aperçu de l'email</p>
              {/* Sûr : le HTML est produit par buildCompletionEmail, qui esc() tous
                  les champs saisis + nom contact/entreprise avant assemblage. */}
              <div
                className="rounded border bg-white p-3 text-sm [&_a]:pointer-events-none"
                dangerouslySetInnerHTML={{ __html: previewEmail.html }}
              />
            </div>
          </div>
        ) : (
          /* ── Étape 1 : Composer ──────────────────────────────────────── */
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Génère un lien sécurisé (valable 7 jours) permettant au candidat de
              re-déposer ses documents manquants. Ajustez le message, prévisualisez, puis envoyez.
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

            {/* Champs éditables du message */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label htmlFor="cl-subject" className="text-xs">Objet</Label>
                <Input id="cl-subject" value={subject} onChange={e => setSubject(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cl-intro" className="text-xs">Message d'introduction</Label>
                <Textarea id="cl-intro" value={intro} onChange={e => setIntro(e.target.value)} rows={3} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cl-note" className="text-xs">Mot personnel <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
                <Textarea
                  id="cl-note"
                  value={personalNote}
                  onChange={e => setPersonalNote(e.target.value)}
                  rows={2}
                  placeholder="Ex. : Suite à notre échange, il nous manque…"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cl-closing" className="text-xs">Formule de clôture</Label>
                <Input id="cl-closing" value={closing} onChange={e => setClosing(e.target.value)} className="text-sm" />
              </div>
            </div>

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
        )}

        <DialogFooter>
          {link ? (
            <Button onClick={() => handleClose(false)}>Fermer</Button>
          ) : step === 'preview' ? (
            <>
              <Button variant="outline" onClick={() => setStep('compose')} disabled={sending} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <Button onClick={handleSend} disabled={sending || !candidatureId} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Envoi...' : to ? 'Envoyer' : 'Générer le lien'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={sending}>Annuler</Button>
              <Button onClick={() => setStep('preview')} disabled={!candidatureId} className="gap-2">
                <Eye className="h-4 w-4" /> Aperçu
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
