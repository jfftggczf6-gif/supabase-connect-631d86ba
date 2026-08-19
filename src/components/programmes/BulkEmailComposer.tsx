// Composeur d'e-mail GROUPÉ (brief 1) — deux types : Relance documentaire et
// Communication libre. Ouvert depuis la vue liste sur une sélection de candidats.
//
// - N e-mails distincts : chaque destinataire est construit individuellement,
//   variables résolues ; l'EF candidature-email-send envoie un e-mail par candidat.
// - Relance : documents PAR destinataire (défaut = pièces manquantes ; zéro-manquant
//   retiré par défaut, réincluable ; bandeau commun). Lien via placeholder — l'EF
//   génère le token (échéance commune) et remplace. Pré-vol checkRelanceLinks.
// - Communication : corps 100 % utilisateur + variables.
// - Aperçu par destinataire nommé et changeable ; alertes variables vides + contacts
//   suspects (retirer / corriger / envoyer quand même) ; test vers soi ; reliquat.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Mail, ChevronDown, ChevronRight, AlertTriangle, Beaker, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractEdgeError } from '@/lib/edge-error';
import { buildCompletionEmail, completionEmailDefaults } from '@/lib/completion-email';
import { buildCommunicationEmail } from '@/lib/communication-email';
import {
  EMAIL_VARIABLES, resolveRecipientVariables, applyVariables,
  extractUsedVariables, findEmptyVariables, inspectContact,
} from '@/lib/email-variables';
import { checkRelanceLinks, RECOVERY_URL_PLACEHOLDER } from '@/lib/relance-link-guard';
import { missingDocLabels } from '@/lib/candidature-missing-docs';
import { COMMON_REQUESTED_DOCUMENTS } from '@/lib/common-documents';

export interface ComposerRecipient {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  form_data?: Record<string, any> | null;
  documents?: any[] | null;
  status: string;
}

type EmailType = 'communication' | 'relance';
interface SendResult { candidature_id: string; to: string | null; statut: 'sent' | 'failed' | 'refused' | 'skipped'; error?: string }

export default function BulkEmailComposer({
  open, onOpenChange, recipients, programme, onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipients: ComposerRecipient[];
  programme: any;
  onSent?: () => void;
}) {
  const { user } = useAuth();
  const programmeName: string | null = programme?.name ?? null;

  const [type, setType] = useState<EmailType>('communication');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');            // communication
  const [intro, setIntro] = useState('');          // relance
  const [personalNote, setPersonalNote] = useState('');
  const [closing, setClosing] = useState('');
  const [operationExpiresAt, setOperationExpiresAt] = useState('');

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [reincludedZero, setReincludedZero] = useState<Set<string>>(new Set());
  const [contactOverride, setContactOverride] = useState<Record<string, string>>({});
  const [docsByRecipient, setDocsByRecipient] = useState<Record<string, string[]>>({});
  const [commonExtra, setCommonExtra] = useState<string[]>([]);
  const [commonExtraInput, setCommonExtraInput] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = completionEmailDefaults({ companyName: null, programmeName });
    setType('communication');
    setSubject(''); setBody('');
    setIntro(d.intro); setPersonalNote(''); setClosing(d.closing);
    setOperationExpiresAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    setExcluded(new Set()); setReincludedZero(new Set()); setContactOverride({});
    const docsInit: Record<string, string[]> = {};
    for (const r of recipients) docsInit[r.id] = missingDocLabels(programme?.form_fields, r.documents);
    setDocsByRecipient(docsInit);
    setCommonExtra([]); setCommonExtraInput(''); setExpanded(null);
    setPreviewId(recipients[0]?.id ?? null);
    setBatchId(null); setResults(null);
  }, [open, recipients, programmeName]);

  // ── Résolution / construction par destinataire ────────────────────────────
  const effectiveContact = (r: ComposerRecipient) => contactOverride[r.id] ?? (r.contact_name ?? '');
  const varsFor = (r: ComposerRecipient) => resolveRecipientVariables({
    contact_name: effectiveContact(r),
    company_name: r.company_name,
    programme_name: programmeName,
    pays: r.form_data?.pays ?? null,
  });
  const docsFor = (r: ComposerRecipient) => [...new Set([...(docsByRecipient[r.id] ?? []), ...commonExtra])];

  const buildFor = (r: ComposerRecipient) => {
    const vars = varsFor(r);
    if (type === 'communication') {
      return buildCommunicationEmail({
        subject: applyVariables(subject, vars),
        body: applyVariables(body, vars),
        closing: applyVariables(closing, vars),
      });
    }
    return buildCompletionEmail({
      companyName: r.company_name, contactName: effectiveContact(r), programmeName,
      recoveryUrl: RECOVERY_URL_PLACEHOLDER, expiresAt: operationExpiresAt,
      requestedDocs: docsFor(r),
      fields: {
        subject: applyVariables(subject, vars),
        intro: applyVariables(intro, vars),
        personalNote: applyVariables(personalNote, vars),
        closing: applyVariables(closing, vars),
      },
    });
  };

  // ── Inclusion ──────────────────────────────────────────────────────────────
  // Zéro-manquant (relance) : retiré par défaut, réincluable. Retrait manuel : les deux types.
  const isZeroMissing = (r: ComposerRecipient) => type === 'relance' && docsFor(r).length === 0;
  const isIncluded = (r: ComposerRecipient) => {
    if (excluded.has(r.id)) return false;
    if (isZeroMissing(r) && !reincludedZero.has(r.id)) return false;
    return true;
  };
  const included = recipients.filter(isIncluded);

  const combinedTemplate = type === 'communication'
    ? [subject, body, closing].join('\n')
    : [subject, intro, personalNote, closing].join('\n');
  const usedVars = extractUsedVariables(combinedTemplate);

  // ── Alertes pré-envoi (variables vides + contacts suspects) ─────────────────
  interface Probleme { r: ComposerRecipient; empties: string[]; contact?: ReturnType<typeof inspectContact> }
  const problemes: Probleme[] = useMemo(() => {
    const out: Probleme[] = [];
    for (const r of included) {
      const vars = varsFor(r);
      const empties = findEmptyVariables(combinedTemplate, vars);
      const contact = usedVars.includes('contact') ? inspectContact(effectiveContact(r)) : undefined;
      if (empties.length > 0 || contact?.suspect) out.push({ r, empties, contact });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [included, combinedTemplate, contactOverride, commonExtra, docsByRecipient, type]);

  const previewRecipient = included.find((r) => r.id === previewId) ?? included[0] ?? null;
  const previewHtml = useMemo(() => {
    if (!previewRecipient) return '';
    const built = buildFor(previewRecipient);
    // En aperçu, on remplace le placeholder par une URL factice (même forme).
    return built.html.split(RECOVERY_URL_PLACEHOLDER).join(`${window.location.origin}/candidature/recovery/apercu`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRecipient, type, subject, body, intro, personalNote, closing, contactOverride, docsByRecipient, commonExtra, operationExpiresAt]);

  const insertVariable = (key: string) => {
    // Insère {{key}} à la fin du champ corps (communication) ou intro (relance).
    if (type === 'communication') setBody((b) => `${b}{{${key}}}`);
    else setIntro((i) => `${i}{{${key}}}`);
  };

  // ── Envoi ────────────────────────────────────────────────────────────────
  const construirePayload = (rs: ComposerRecipient[]) => {
    const payload: any[] = [];
    for (const r of rs) {
      const email = buildFor(r);
      if (type === 'relance') {
        const g = checkRelanceLinks({ html: email.html, text: email.text });
        if (!g.ok) throw new Error(`Lien relance non conforme pour ${r.company_name || r.contact_name || r.id} : ${g.raison}`);
      }
      payload.push({
        candidature_id: r.id, subject: email.subject, html: email.html, text: email.text,
        ...(type === 'relance' ? { requested_docs: docsFor(r) } : {}),
      });
    }
    return payload;
  };

  const envoyer = async (cibles: ComposerRecipient[], bidExistant?: string) => {
    if (!subject.trim()) { toast({ title: 'Objet manquant', description: "L'objet est obligatoire.", variant: 'destructive' }); return; }
    if (cibles.length === 0) { toast({ title: 'Aucun destinataire', variant: 'destructive' }); return; }
    let payload: any[];
    try { payload = construirePayload(cibles); }
    catch (e: any) { toast({ title: 'Construction bloquée', description: e.message, variant: 'destructive' }); return; }

    setSending(true);
    const bid = bidExistant ?? batchId ?? crypto.randomUUID();
    setBatchId(bid);
    const { data, error } = await supabase.functions.invoke('candidature-email-send', {
      body: {
        type, batch_id: bid,
        ...(type === 'relance' ? { operation_expires_at: operationExpiresAt } : {}),
        recipients: payload,
      },
    });
    const msg = await extractEdgeError(error, data);
    if (msg) {
      toast({ title: 'Envoi refusé', description: msg, variant: 'destructive' });
      setSending(false);
      return;
    }
    const res: SendResult[] = data?.results ?? [];
    // Fusionne avec un éventuel envoi précédent (reliquat) : on garde le dernier statut par candidat.
    setResults((prev) => {
      const map = new Map<string, SendResult>((prev ?? []).map((x) => [x.candidature_id, x]));
      for (const x of res) map.set(x.candidature_id, x);
      return [...map.values()];
    });
    const b = data?.bilan ?? {};
    toast({ title: 'Envoi effectué', description: `${b.envoyes ?? 0} envoyé(s), ${b.echecs ?? 0} échec(s), ${b.refuses ?? 0} refusé(s).` });
    setSending(false);
    onSent?.();
  };

  const envoyerTest = async () => {
    if (!previewRecipient) { toast({ title: 'Aucun destinataire à prévisualiser', variant: 'destructive' }); return; }
    if (!user?.email) { toast({ title: 'Adresse émetteur inconnue', variant: 'destructive' }); return; }
    if (!subject.trim()) { toast({ title: 'Objet manquant', variant: 'destructive' }); return; }
    setTesting(true);
    const built = buildFor(previewRecipient);
    const previewUrl = `${window.location.origin}/candidature/recovery/apercu`;
    const html = built.html.split(RECOVERY_URL_PLACEHOLDER).join(previewUrl);
    const text = (built.text || '').split(RECOVERY_URL_PLACEHOLDER).join(previewUrl);
    // Chemin GÉNÉRIQUE (pas de candidature_id) → vers l'adresse de l'utilisateur connecté,
    // sans consommer la sélection, sans journalisation candidat.
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to: user.email, subject: `[TEST] ${built.subject}`, html, text },
    });
    const msg = await extractEdgeError(error, data);
    if (msg) toast({ title: 'Test non envoyé', description: msg, variant: 'destructive' });
    else toast({ title: 'Test envoyé', description: `Envoyé à ${user.email} (aperçu de ${previewRecipient.company_name || previewRecipient.contact_name}).` });
    setTesting(false);
  };

  const reliquat = (results ?? []).filter((x) => x.statut === 'failed' || x.statut === 'refused');
  const renvoyerReliquat = () => {
    const ids = new Set(reliquat.map((x) => x.candidature_id));
    envoyer(recipients.filter((r) => ids.has(r.id) && isIncluded(r)), batchId ?? undefined);
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const RecipientDocs = ({ r }: { r: ComposerRecipient }) => {
    const missing = missingDocLabels(programme?.form_fields, r.documents);
    const options = [...new Set([...missing, ...COMMON_REQUESTED_DOCUMENTS])];
    const current = new Set(docsByRecipient[r.id] ?? []);
    const toggleDoc = (label: string) => setDocsByRecipient((prev) => {
      const set = new Set(prev[r.id] ?? []);
      set.has(label) ? set.delete(label) : set.add(label);
      return { ...prev, [r.id]: [...set] };
    });
    return (
      <div className="pl-8 pr-3 py-2 space-y-1.5 bg-muted/30">
        <p className="text-[11px] text-muted-foreground">Pièces demandées à ce destinataire (défaut = manquantes) :</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((label) => {
            const on = current.has(label);
            const isMissing = missing.includes(label);
            return (
              <button
                key={label} type="button" onClick={() => toggleDoc(label)}
                className={`text-xs rounded-full border px-2.5 py-1 ${on ? 'bg-violet-600 text-white border-violet-600' : 'bg-background border-input'}`}
              >
                {on ? '✓ ' : '+ '}{label}{isMissing ? '' : ' (extra)'}
              </button>
            );
          })}
          {options.length === 0 && <span className="text-xs text-muted-foreground">Aucune pièce fichier au formulaire.</span>}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-violet-600" />
            Envoi groupé — {recipients.length} destinataire{recipients.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {results ? (
          /* ── Écran résultats / reliquat ──────────────────────────────── */
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-emerald-300 text-emerald-700">{results.filter((r) => r.statut === 'sent').length} envoyé(s)</Badge>
              <Badge variant="outline" className="border-red-300 text-red-700">{results.filter((r) => r.statut === 'failed').length} échec(s)</Badge>
              <Badge variant="outline" className="border-amber-300 text-amber-700">{results.filter((r) => r.statut === 'refused').length} refusé(s)</Badge>
              {results.some((r) => r.statut === 'skipped') && <Badge variant="outline">{results.filter((r) => r.statut === 'skipped').length} déjà servi(s)</Badge>}
            </div>
            {reliquat.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                <p className="font-medium text-amber-800">Non servis ({reliquat.length}) — reliquat</p>
                <ul className="text-xs space-y-1">
                  {reliquat.map((x) => {
                    const r = recipients.find((rr) => rr.id === x.candidature_id);
                    return <li key={x.candidature_id}>{r?.company_name || r?.contact_name || x.candidature_id} — {x.to} · {x.error || x.statut}</li>;
                  })}
                </ul>
                <Button size="sm" onClick={renvoyerReliquat} disabled={sending} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Renvoyer au reliquat uniquement
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          /* ── Composition ─────────────────────────────────────────────── */
          <div className="space-y-4 text-sm">
            {/* Type d'envoi (critère 1) */}
            <div className="space-y-1">
              <Label className="text-xs">Type d'envoi</Label>
              <div className="flex gap-2">
                {(['communication', 'relance'] as EmailType[]).map((t) => (
                  <button
                    key={t} type="button" onClick={() => setType(t)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${type === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-background border-input'}`}
                  >
                    {t === 'communication' ? 'Communication' : 'Relance documentaire'}
                  </button>
                ))}
              </div>
              {type === 'communication'
                ? <p className="text-[11px] text-muted-foreground">Message libre, sans bouton ni lien de dépôt.</p>
                : <p className="text-[11px] text-muted-foreground">Chaque destinataire reçoit son propre lien de dépôt (échéance commune).</p>}
            </div>

            {/* Objet + variables */}
            <div className="space-y-1">
              <Label htmlFor="bulk-subject" className="text-xs">Objet — l'intitulé seul, sans « Objet : »</Label>
              <Input id="bulk-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex. : Visite de terrain — {{programme}}" />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Variables :</span>
              {EMAIL_VARIABLES.map((v) => (
                <button key={v.key} type="button" onClick={() => insertVariable(v.key)}
                  className="text-[11px] rounded-full border border-input px-2 py-0.5 hover:bg-muted" title={v.description}>
                  {'{{'}{v.key}{'}}'}
                </button>
              ))}
            </div>

            {type === 'communication' ? (
              <div className="space-y-1">
                <Label htmlFor="bulk-body" className="text-xs">Message</Label>
                <Textarea id="bulk-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Bonjour {{contact}},&#10;&#10;…" />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="bulk-intro" className="text-xs">Message d'introduction</Label>
                  <Textarea id="bulk-intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bulk-note" className="text-xs">Mot personnel (optionnel)</Label>
                  <Textarea id="bulk-note" value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} rows={2} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label htmlFor="bulk-closing" className="text-xs">Formule de clôture</Label>
              <Input id="bulk-closing" value={closing} onChange={(e) => setClosing(e.target.value)} />
            </div>

            {/* Relance : bandeau commun + tableau des destinataires avec docs */}
            {type === 'relance' && (
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Demander à tous une pièce en plus</Label>
                    <Input value={commonExtraInput} onChange={(e) => setCommonExtraInput(e.target.value)}
                      placeholder="Ex. : Attestation fiscale"
                      onKeyDown={(e) => { if (e.key === 'Enter' && commonExtraInput.trim()) { e.preventDefault(); setCommonExtra((p) => [...new Set([...p, commonExtraInput.trim()])]); setCommonExtraInput(''); } }} />
                  </div>
                  <Button type="button" variant="outline" onClick={() => { if (commonExtraInput.trim()) { setCommonExtra((p) => [...new Set([...p, commonExtraInput.trim()])]); setCommonExtraInput(''); } }}>Ajouter à tous</Button>
                </div>
                {commonExtra.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {commonExtra.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 text-xs rounded-full bg-violet-100 text-violet-800 px-2.5 py-1">
                        {d}<button type="button" onClick={() => setCommonExtra((p) => p.filter((x) => x !== d))}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Destinataires : inclusion + (relance) docs par destinataire */}
            <div className="rounded-lg border">
              <div className="px-3 py-2 border-b bg-muted/40 text-xs font-medium flex items-center justify-between">
                <span>Destinataires · {included.length} inclus / {recipients.length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y">
                {recipients.map((r) => {
                  const inc = isIncluded(r);
                  const zero = isZeroMissing(r);
                  const missing = type === 'relance' ? missingDocLabels(programme?.form_fields, r.documents).length : 0;
                  return (
                    <div key={r.id}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Checkbox
                          checked={inc}
                          onCheckedChange={(v) => {
                            if (zero) { // réinclure / retirer un zéro-manquant
                              setReincludedZero((prev) => { const n = new Set(prev); v ? n.add(r.id) : n.delete(r.id); return n; });
                            } else {
                              setExcluded((prev) => { const n = new Set(prev); v ? n.delete(r.id) : n.add(r.id); return n; });
                            }
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.company_name || '—'}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.contact_name || '—'} · {r.contact_email || 'sans e-mail'}</p>
                        </div>
                        {type === 'relance' && (
                          <>
                            <Badge variant="outline" className={missing > 0 ? 'border-amber-300 text-amber-700' : 'text-muted-foreground'}>
                              {missing} manq.
                            </Badge>
                            {zero && !reincludedZero.has(r.id) && <span className="text-[11px] text-muted-foreground">rien à demander</span>}
                            <button type="button" onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="p-1 text-muted-foreground">
                              {expanded === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                      </div>
                      {type === 'relance' && expanded === r.id && <RecipientDocs r={r} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alertes pré-envoi */}
            {problemes.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                <p className="flex items-center gap-2 font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" /> {problemes.length} destinataire(s) à vérifier avant envoi
                </p>
                <ul className="space-y-1.5 text-xs">
                  {problemes.map(({ r, empties, contact }) => (
                    <li key={r.id} className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.company_name || r.contact_name || r.id}</span>
                      {empties.length > 0 && <span className="text-amber-700">variable(s) vide(s) : {empties.join(', ')}</span>}
                      {contact?.suspect && <span className="text-amber-700">contact suspect ({contact.raisons.join(', ')})</span>}
                      {contact?.valeurNettoyee && (
                        <button type="button" className="underline" onClick={() => setContactOverride((p) => ({ ...p, [r.id]: contact.valeurNettoyee! }))}>
                          utiliser « {contact.valeurNettoyee} »
                        </button>
                      )}
                      <button type="button" className="underline" onClick={() => setExcluded((p) => new Set(p).add(r.id))}>retirer</button>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">Aucun blocage : vous pouvez corriger, retirer, ou envoyer quand même.</p>
              </div>
            )}

            {/* Aperçu par destinataire changeable */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Aperçu du destinataire</Label>
                <Select value={previewRecipient?.id ?? ''} onValueChange={setPreviewId}>
                  <SelectTrigger className="w-[280px] h-8"><SelectValue placeholder="Choisir un destinataire" /></SelectTrigger>
                  <SelectContent>
                    {included.map((r) => <SelectItem key={r.id} value={r.id}>{r.company_name || r.contact_name || r.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {previewRecipient ? (
                /* Sûr : previewHtml vient de buildCommunicationEmail / buildCompletionEmail,
                   qui échappent (esc/escMultiline) le corps final APRÈS substitution des
                   variables — aucune donnée candidat non échappée n'atteint le DOM. */
                <div className="rounded border bg-white p-3 [&_a]:pointer-events-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : <p className="text-xs text-muted-foreground">Aucun destinataire inclus.</p>}
            </div>

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={envoyerTest} disabled={testing || sending || !previewRecipient} className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Beaker className="h-4 w-4" />}
                Test vers moi
              </Button>
              <Button onClick={() => envoyer(included)} disabled={sending || included.length === 0} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer à {included.length} destinataire{included.length > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
