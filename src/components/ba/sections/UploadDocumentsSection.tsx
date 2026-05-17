// src/components/ba/sections/UploadDocumentsSection.tsx
// Section "Documents du mandant" dans le MandatShell.
// Brief upload_documents (Ordre 7) — 12 critères.
//
// Composition : drop zone + liste docs uploadés + checklist 7 docs attendus +
// score qualité + rappel mandant (modal email) + panneau données extraites.

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Upload, FileText, Loader2, X, CheckCircle2, AlertCircle, MailWarning, Trash2,
  FileDown, Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORY_LABELS } from '@/lib/document-parser';
import { useBaDealDocuments, uploadAndParseBaDocument } from '@/hooks/useBaDealDocuments';
import type { BaDealDocument, ExpectedDocument } from '@/types/upload-documents-ba';

interface Props {
  dealId: string;
  organizationId: string;
}

const ACCEPTED = '.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.txt,.png,.jpg,.jpeg';
const MAX_FILES_PER_BATCH = 10;

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function QualityDot({ q }: { q: BaDealDocument['parse_quality'] }) {
  const map: Record<NonNullable<BaDealDocument['parse_quality']>, { color: string; label: string }> = {
    high:   { color: 'bg-emerald-500', label: 'Qualité élevée' },
    medium: { color: 'bg-amber-500',   label: 'Qualité moyenne' },
    low:    { color: 'bg-orange-500',  label: 'Qualité faible' },
    failed: { color: 'bg-rose-500',    label: 'Parsing échoué' },
  };
  if (!q) return <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />;
  return <span className={`inline-block h-2 w-2 rounded-full ${map[q].color}`} title={map[q].label} />;
}

export default function UploadDocumentsSection({ dealId, organizationId }: Props) {
  const { documents, checklist, quality, loading, reload } = useBaDealDocuments(dealId);
  const [uploading, setUploading] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, MAX_FILES_PER_BATCH);
    setUploading(prev => [...prev, ...arr]);
    setErrors({});

    await Promise.all(arr.map(async (file) => {
      try {
        await uploadAndParseBaDocument(file, dealId, organizationId);
        toast.success(`${file.name} uploadé`);
      } catch (e: any) {
        setErrors(prev => ({ ...prev, [file.name]: e?.message ?? 'Erreur' }));
        toast.error(`${file.name} : ${e?.message ?? 'Erreur'}`);
      } finally {
        setUploading(prev => prev.filter(f => f !== file));
      }
    }));
    await reload();
  }, [dealId, organizationId, reload]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (doc: BaDealDocument) => {
    if (!confirm(`Supprimer ${doc.filename} ?`)) return;
    const { error: stErr } = await supabase.storage.from('pe_deal_docs').remove([doc.storage_path]);
    if (stErr) toast.warning(`Storage : ${stErr.message}`);
    const { error: dbErr } = await supabase.from('pe_deal_documents').delete().eq('id', doc.id);
    if (dbErr) { toast.error(`Suppression échouée : ${dbErr.message}`); return; }
    toast.success('Document supprimé');
    reload();
  };

  const handleDownload = async (doc: BaDealDocument) => {
    const { data, error } = await supabase.storage.from('pe_deal_docs').createSignedUrl(doc.storage_path, 300);
    if (error || !data?.signedUrl) { toast.error('Lien indisponible'); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Score qualité dossier */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold">Qualité du dossier</h3>
            <p className="text-xs text-muted-foreground">
              {quality.received}/{quality.expected} documents reçus
            </p>
          </div>
          <div className={`text-3xl font-bold ${
            quality.pct === 100 ? 'text-emerald-600' :
            quality.pct >= 60 ? 'text-amber-600' : 'text-rose-600'
          }`}>{quality.pct}%</div>
        </div>
        <Progress value={quality.pct} className="h-2" />
        {quality.missing.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              {quality.missing.length} document{quality.missing.length > 1 ? 's' : ''} manquant{quality.missing.length > 1 ? 's' : ''}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => setReminderOpen(true)}
            >
              <MailWarning className="h-3.5 w-3.5" /> Rappel mandant
            </Button>
          </div>
        )}
      </Card>

      {/* Drop zone */}
      <Card
        className={`p-6 border-2 border-dashed transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-input'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center text-center">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <div className="text-sm font-medium mb-1">Glissez vos documents ici</div>
          <div className="text-[10px] text-muted-foreground mb-3">
            PDF · Word · Excel · PowerPoint · Images (max {MAX_FILES_PER_BATCH} fichiers / lot)
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Parcourir…
          </Button>
        </div>
        {uploading.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1">
            {uploading.map(f => (
              <div key={f.name} className="flex items-center gap-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground">{formatSize(f.size)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Checklist + Liste docs côte à côte */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Checklist */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Checklist documents attendus
          </h3>
          <ul className="space-y-2">
            {checklist.map(item => (
              <li key={item.expected.code} className="flex items-start gap-2 text-xs">
                {item.received ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${item.received ? '' : 'text-rose-700'}`}>
                    {item.expected.label}
                  </div>
                  {item.expected.hint && (
                    <div className="text-[10px] text-muted-foreground">{item.expected.hint}</div>
                  )}
                  {item.received && item.matched.length > 0 && (
                    <div className="text-[10px] text-emerald-700 mt-0.5 truncate">
                      ✓ {item.matched.length} fichier{item.matched.length > 1 ? 's' : ''} ({item.matched[0].filename}
                      {item.matched.length > 1 && ` +${item.matched.length - 1}`})
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Données extraites (résumé) */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Database className="h-4 w-4" /> Données extraites
          </h3>
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Aucun document uploadé pour le moment.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Total documents</span>
                <span className="font-semibold">{documents.length}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Caractères extraits</span>
                <span className="font-semibold">
                  {documents.reduce((sum, d) => sum + (d.chars_extracted || 0), 0).toLocaleString('fr-FR')}
                </span>
              </div>
              {Array.from(new Set(documents.map(d => d.category).filter(Boolean))).map(cat => {
                const count = documents.filter(d => d.category === cat).length;
                return (
                  <div key={cat} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                    </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                );
              })}
              <div className="pt-2 mt-2 border-t text-[10px] text-muted-foreground">
                Le contenu détaillé alimente l'IA (pre-screening, IM, valuation) automatiquement.
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Liste détaillée des documents uploadés */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">
          Documents uploadés ({documents.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground italic">
            Aucun document. Glissez vos fichiers ci-dessus pour commencer.
          </div>
        ) : (
          <ul className="divide-y">
            {documents.map(doc => (
              <li key={doc.id} className="py-2 flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{doc.filename}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <QualityDot q={doc.parse_quality} />
                    <span>{formatSize(doc.size_bytes)}</span>
                    {doc.category && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        {CATEGORY_LABELS[doc.category]}
                      </Badge>
                    )}
                    {doc.parse_error && (
                      <span className="text-rose-600">⚠ {doc.parse_error}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(doc)}>
                    <FileDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
            {Object.entries(errors).map(([fname, err]) => (
              <li key={`err-${fname}`} className="py-2 text-xs text-rose-600">
                ⚠ {fname} : {err}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        dealId={dealId}
        missing={quality.missing}
      />
    </div>
  );
}

// ─── Modal rappel mandant ────────────────────────────────────────
function ReminderDialog({
  open, onOpenChange, dealId, missing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
  missing: ExpectedDocument[];
}) {
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [subject, setSubject] = useState('Documents complémentaires demandés');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingContact, setLoadingContact] = useState(false);

  // Préchargement du contact depuis enterprise lié au deal
  useEffect(() => {
    if (!open || !dealId) return;
    let cancel = false;
    (async () => {
      setLoadingContact(true);
      const { data: deal } = await supabase
        .from('pe_deals')
        .select('enterprise_id')
        .eq('id', dealId)
        .maybeSingle();
      if (cancel) return;
      const entId = (deal as any)?.enterprise_id;
      if (entId) {
        const { data: ent } = await supabase
          .from('enterprises')
          .select('name, contact_email, contact_name')
          .eq('id', entId)
          .maybeSingle();
        if (cancel) return;
        if (ent) {
          setContactEmail((ent as any).contact_email ?? '');
          setContactName((ent as any).contact_name ?? '');
        }
      }
      setLoadingContact(false);
    })();
    return () => { cancel = true; };
  }, [open, dealId]);

  // Préremplir le corps du mail avec la liste des docs manquants
  useEffect(() => {
    if (!open) return;
    const list = missing.map(m => `  • ${m.label}${m.hint ? ` (${m.hint})` : ''}`).join('\n');
    setBody(
      `Bonjour${contactName ? ' ' + contactName : ''},\n\n` +
      `Dans le cadre de votre mandat, nous avons besoin des documents suivants pour avancer sur votre dossier :\n\n` +
      `${list}\n\n` +
      `Vous pouvez les transmettre par retour de mail ou via votre référent BA.\n\n` +
      `Cordialement,\nL'équipe ESONO`
    );
  }, [open, missing, contactName]);

  const handleSend = async () => {
    if (!contactEmail.trim() || !subject.trim() || !body.trim()) {
      toast.error('Email, sujet et message requis');
      return;
    }
    setSending(true);
    const html = body.replace(/\n/g, '<br>');
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to: contactEmail.trim(), subject: subject.trim(), html, text: body },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Envoi échoué');
      return;
    }
    toast.success(`Rappel envoyé à ${contactEmail}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rappel mandant — documents manquants</DialogTitle>
          <DialogDescription className="text-xs">
            {missing.length} document{missing.length > 1 ? 's' : ''} à demander. Le contact est pré-rempli depuis la fiche entreprise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nom contact</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nom du dirigeant"
                disabled={loadingContact || sending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@entreprise.ci"
                disabled={loadingContact || sending}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Sujet *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Message *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              disabled={sending}
              className="text-xs font-sans"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending || !contactEmail || !subject || !body}>
            {sending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Envoi…</> : 'Envoyer le rappel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
