// CandidatureRecovery — page publique de complétion du dossier de candidature.
//
// Le candidat voit une checklist structurée :
//   1. Documents demandés (champs "document" du formulaire + demandes sur-mesure
//      du chef de programme), avec statut fourni / manquant et upload par pièce.
//   2. Documents supplémentaires libres (drag & drop).
//
// À la soumission, la liste FUSIONNÉE (existant + nouveaux) est renvoyée :
// les documents déjà fournis ne sont jamais perdus (voir mergeDocuments).
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileText, Send, X, Paperclip } from 'lucide-react';
import { mergeDocuments, FREE_DOC_LABEL, type CandidatureDoc } from '@/lib/merge-documents';
import { buildRequestedDocuments } from '@/lib/requested-documents';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

interface RecoveryInfo {
  candidature_id: string;
  company_name: string;
  contact_name: string | null;
  programme_name: string | null;
  form_file_labels: string[];
  custom_requested_labels: string[];
  existing_documents: CandidatureDoc[];
  expires_at: string | null;
}

function api(body: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/functions/v1/candidature-recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
}

export default function CandidatureRecovery() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<RecoveryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Un fichier sélectionné par pièce demandée (clé = libellé du slot).
  const [slotFiles, setSlotFiles] = useState<Record<string, File>>({});
  // Documents supplémentaires libres.
  const [freeFiles, setFreeFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const slotInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const freeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setError('Lien invalide'); setLoading(false); return; }
    (async () => {
      try {
        const resp = await api({ action: 'info', token });
        const data = await resp.json();
        if (!resp.ok) { setError(data.error || 'Lien invalide'); setLoading(false); return; }
        setInfo(data);
      } catch (e: any) {
        setError(e.message || 'Erreur de connexion');
      }
      setLoading(false);
    })();
  }, [token]);

  const requested = info
    ? buildRequestedDocuments({
        formFileLabels: info.form_file_labels || [],
        customLabels: info.custom_requested_labels || [],
        existingDocs: info.existing_documents || [],
      })
    : [];

  const setSlotFile = (label: string, file: File | null) => {
    setSlotFiles(prev => {
      const next = { ...prev };
      if (file) next[label] = file; else delete next[label];
      return next;
    });
  };

  const addFreeFiles = (files: File[]) => setFreeFiles(prev => [...prev, ...files]);

  const handleSubmit = async () => {
    if (!info || !token) return;
    const staged: { label: string; file: File }[] = [
      ...Object.entries(slotFiles).map(([label, file]) => ({ label, file })),
      ...freeFiles.map(file => ({ label: FREE_DOC_LABEL, file })),
    ];
    if (staged.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const newDocs: CandidatureDoc[] = [];
      const failedUploads: string[] = [];

      for (const { label, file } of staged) {
        const urlRes = await api({ action: 'upload_url', token, filename: file.name });
        const urlData = await urlRes.json();
        if (!urlRes.ok || !urlData.signed_url) { failedUploads.push(file.name); continue; }

        const putRes = await fetch(urlData.signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putRes.ok) { failedUploads.push(file.name); continue; }

        newDocs.push({
          field_label: label,
          file_name: file.name,
          file_size: file.size,
          storage_path: urlData.storage_path,
        });
      }

      if (failedUploads.length > 0) {
        setError(`Échec d'upload pour ${failedUploads.length} fichier(s) : ${failedUploads.join(', ')}.`);
        setUploading(false);
        return;
      }

      // Fusion avec l'existant → on ne perd jamais les documents déjà fournis.
      const finalDocs = mergeDocuments(info.existing_documents || [], newDocs);

      const submitRes = await api({ action: 'submit', token, documents: finalDocs });
      const data = await submitRes.json();
      if (!submitRes.ok) {
        setError(data.error || "Erreur lors de l'enregistrement");
        setUploading(false);
        return;
      }
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
    }
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h1 className="text-xl font-semibold">Lien invalide</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              Contacte ton chef de programme pour obtenir un nouveau lien.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-semibold">Dossier complété ✓</h1>
            <p className="text-sm text-muted-foreground">
              Merci ! Tes documents ont bien été transmis et sont maintenant
              attachés à ta candidature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stagedCount = Object.keys(slotFiles).length + freeFiles.length;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-violet-600" />
              <h1 className="text-xl font-semibold">Compléter mon dossier</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {info?.company_name ? <>Candidature de <strong>{info.company_name}</strong>. </> : null}
              Merci de déposer les documents demandés ci-dessous.
            </p>
            {info?.expires_at && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⏳ Ce lien expire le {new Date(info.expires_at).toLocaleDateString('fr-FR')} à {new Date(info.expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Documents demandés (formulaire + sur-mesure) */}
        {requested.length > 0 && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="font-semibold text-sm">Documents demandés</h2>
              <ul className="space-y-2">
                {requested.map(doc => {
                  const staged = slotFiles[doc.label];
                  const filled = !!staged || doc.provided;
                  return (
                    <li key={doc.label} className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
                      <FileText className={`h-4 w-4 shrink-0 ${filled ? 'text-emerald-500' : 'text-amber-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{doc.label}</p>
                          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                            {doc.source === 'form' ? 'Formulaire' : 'Sur-mesure'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {staged
                            ? `${staged.name} · ${Math.round(staged.size / 1024)} KB`
                            : doc.provided
                              ? `✓ Déjà fourni : ${doc.fileName}`
                              : '⚠ Manquant'}
                        </p>
                      </div>
                      <input
                        ref={el => { slotInputRefs.current[doc.label] = el; }}
                        type="file"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setSlotFile(doc.label, f); e.currentTarget.value = ''; }}
                      />
                      {staged ? (
                        <button type="button" onClick={() => setSlotFile(doc.label, null)} className="text-muted-foreground hover:text-red-500 p-1">
                          <X className="h-4 w-4" />
                        </button>
                      ) : (
                        <Button size="sm" variant={doc.provided ? 'ghost' : 'outline'} className="shrink-0" onClick={() => slotInputRefs.current[doc.label]?.click()}>
                          {doc.provided ? 'Remplacer' : 'Ajouter'}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Documents supplémentaires libres */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Documents supplémentaires {requested.length === 0 ? '' : '(optionnel)'}
            </h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = Array.from(e.dataTransfer.files); if (f.length) addFreeFiles(f); }}
              onClick={() => freeInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-violet-500 bg-violet-50' : 'border-muted-foreground/30 hover:border-violet-400 hover:bg-muted/30'
              }`}
            >
              <Upload className="h-8 w-8 text-violet-600 mx-auto mb-2" />
              <p className="text-sm font-medium">{isDragging ? 'Dépose tes fichiers ici' : 'Glisse d\'autres fichiers ici ou clique'}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, images — tous formats acceptés</p>
              <input ref={freeInputRef} type="file" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) addFreeFiles(f); if (freeInputRef.current) freeInputRef.current.value = ''; }} />
            </div>

            {freeFiles.length > 0 && (
              <ul className="space-y-1.5">
                {freeFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-violet-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{Math.round(f.size / 1024)} KB</p>
                    </div>
                    <button type="button" onClick={() => setFreeFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500 p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</p>
            )}

            <Button onClick={handleSubmit} disabled={stagedCount === 0 || uploading} className="w-full bg-violet-600 hover:bg-violet-700 gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {uploading
                ? 'Envoi en cours...'
                : stagedCount === 0
                  ? 'Ajoute des documents pour envoyer'
                  : `Envoyer ${stagedCount} document${stagedCount > 1 ? 's' : ''}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
