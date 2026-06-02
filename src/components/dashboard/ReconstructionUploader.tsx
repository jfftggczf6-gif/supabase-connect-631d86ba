import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { parseFile, buildParsingReport, type ParsedDocument, type ParsingReport } from '@/lib/document-parser';
import { DocumentConflictDialog, type ConflictChoice } from './DocumentConflictDialog';
import {
  Wand2, X, FileText, Loader2, CheckCircle2,
  AlertTriangle, RotateCcw, Download, Trash2
} from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.csv,.txt,.md,.xlsx,.xls,.docx,.doc,.pdf,.jpg,.jpeg,.png,.webp,.pptx,.ppt';
const MAX_FILES = 20;

interface ReconstructionUploaderProps {
  enterpriseId: string;
  session: any;
  navigate: (path: string) => void;
  onComplete: () => void;
}

interface ReconstructionResult {
  score_confiance: number;
  compte_resultat: Record<string, unknown>;
  bilan?: Record<string, unknown>;
  effectifs?: Record<string, unknown>;
  kpis?: Record<string, unknown>;
  reconstruction_report?: {
    source_documents: string[];
    hypotheses: string[];
    donnees_manquantes: string[];
    note_analyste: string;
  };
}

interface StorageFile {
  name: string;
  metadata?: { size?: number };
}

export default function ReconstructionUploader({ enterpriseId, session, navigate, onComplete }: ReconstructionUploaderProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<StorageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<ReconstructionResult | null>(null);
  const [parsedDocs, setParsedDocs] = useState<ParsedDocument[]>([]);
  const [, setParsingSummary] = useState<ParsingReport | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [conflictDialog, setConflictDialog] = useState<{ open: boolean; files: string[] }>({ open: false, files: [] });
  const conflictResolverRef = useRef<((c: ConflictChoice) => void) | null>(null);

  const askConflict = (conflicts: string[]) => new Promise<ConflictChoice>((resolve) => {
    conflictResolverRef.current = resolve;
    setConflictDialog({ open: true, files: conflicts });
  });

  const resolveConflict = (choice: ConflictChoice) => {
    setConflictDialog({ open: false, files: [] });
    const resolver = conflictResolverRef.current;
    conflictResolverRef.current = null;
    resolver?.(choice);
  };

  const fetchExistingFiles = useCallback(async () => {
    const { data } = await supabase.storage.from('documents').list(`${enterpriseId}/reconstruction/`);
    if (data && data.length > 0) {
      setExistingFiles(data.filter(f => f.name !== '.emptyFolderPlaceholder'));
    }
  }, [enterpriseId]);

  useEffect(() => {
    fetchExistingFiles();
  }, [fetchExistingFiles]);

  const handleDownloadExisting = async (filename: string) => {
    // Téléchargement via Blob + object URL : marche sur Safari (qui bloque
    // window.open après un await pour cause de "user gesture lost"), et garde
    // un nom de fichier propre (sans le préfixe timestamp ajouté à l'upload).
    const displayName = filename.replace(/^\d+_/, '');
    try {
      const { data: blob, error } = await supabase.storage
        .from('documents')
        .download(`${enterpriseId}/reconstruction/${filename}`);
      if (error || !blob) {
        console.error('[download] supabase error', error);
        toast.error('Téléchargement impossible : ' + (error?.message || 'fichier inaccessible'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Libération mémoire après laisser le browser le temps de démarrer le DL
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      console.error('[download] exception', e);
      toast.error('Erreur de téléchargement');
    }
  };

  const handleDeleteExisting = async (filename: string) => {
    if (!confirm(`Supprimer "${filename.replace(/^\d+_/, '')}" ?`)) return;
    const folder = `${enterpriseId}/reconstruction/`;
    const path = `${folder}${filename}`;

    const { error } = await supabase.storage.from('documents').remove([path]);
    if (error) {
      toast.error('Erreur de suppression : ' + error.message);
      return;
    }

    // Defensive: verify the file is actually gone (Supabase may silently no-op on RLS deny)
    const { data: after } = await supabase.storage.from('documents').list(folder);
    const stillThere = after?.some(f => f.name === filename);
    if (stillThere) {
      toast.error('Suppression refusée par le serveur (permission ou verrou). Contactez le support.');
      return;
    }

    // Rebuild document_content via EF — keep IA memory in sync with storage
    try {
      const token = await getValidAccessToken(session, navigate);
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rebuild-document-content`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enterprise_id: enterpriseId }),
        }
      );
    } catch (e) {
      console.warn('[delete] rebuild failed, file removed but content not reconciled:', e);
      // Non-fatal: next upload/delete will rebuild
    }

    toast.success('Document supprimé');
    await fetchExistingFiles();
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles(prev => {
      const combined = [...prev, ...arr].slice(0, MAX_FILES);
      if (prev.length + arr.length > MAX_FILES) {
        toast.warning(`Maximum ${MAX_FILES} fichiers`);
      }
      return combined;
    });
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleReconstruct = async () => {
    if (files.length === 0) {
      toast.error('Ajoutez au moins un fichier');
      return;
    }

    setUploading(true);
    setProgress(0);
    setProgressLabel('Upload des fichiers…');
    setResult(null);
    setParsedDocs([]);
    setParsingSummary(null);

    // AbortController pour bouton "Arrêter" — vérifié pendant le poll Railway
    abortRef.current = new AbortController();

    try {
      // 0. Ensure valid auth session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (!refreshed) {
          toast.error('Session expirée — veuillez vous reconnecter');
          navigate('/login');
          setUploading(false);
          return;
        }
      }

      const token = await getValidAccessToken(session, navigate);

      // === STEP 0: Detect conflicts with existing files ===
      // Normalize legacy filenames (Date.now()_prefix.ext → prefix.ext) so a re-upload
      // of "bilan.pdf" matches an existing "1780XXX_bilan.pdf" left over from before fix.
      const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_');
      const stripLegacyPrefix = (n: string) => n.replace(/^\d+_/, '');
      const safeNames = files.map(f => sanitize(f.name));

      // Map: normalized name → list of actual storage names (legacy can have multiple variants)
      const normalizedToStorage = new Map<string, string[]>();
      for (const f of existingFiles) {
        const key = stripLegacyPrefix(f.name);
        const arr = normalizedToStorage.get(key) || [];
        arr.push(f.name);
        normalizedToStorage.set(key, arr);
      }

      const conflicts = safeNames.filter(n => normalizedToStorage.has(n));

      let filesToUpload = files;
      let replacedCount = 0;
      let legacyPathsToDelete: string[] = [];
      if (conflicts.length > 0) {
        const choice = await askConflict(conflicts);
        if (choice === 'cancel') {
          setUploading(false);
          return;
        }
        if (choice === 'skip') {
          filesToUpload = files.filter((_, i) => !normalizedToStorage.has(safeNames[i]));
          if (filesToUpload.length === 0) {
            toast.info('Tous les fichiers étaient déjà présents — rien à uploader.');
            setUploading(false);
            return;
          }
        } else {
          // 'replace' — collect all legacy storage paths that match (could have multiple
          // variants like 1780A_bilan.pdf AND 1780B_bilan.pdf for the same logical file)
          // so we can delete them after successful upload.
          replacedCount = conflicts.length;
          for (const conflict of conflicts) {
            const storageNames = normalizedToStorage.get(conflict) || [];
            for (const sn of storageNames) {
              // Only mark legacy variants (those that differ from the new clean name)
              if (sn !== conflict) {
                legacyPathsToDelete.push(`${enterpriseId}/reconstruction/${sn}`);
              }
            }
          }
        }
      }

      const uploadSafeNames = filesToUpload.map(f => sanitize(f.name));

      // === STEP 1: Upload all files to storage (no timestamp prefix → dedup native via upsert) ===
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const filePath = `${enterpriseId}/reconstruction/${uploadSafeNames[i]}`;
        const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
        if (error) throw error;
        setProgress(Math.round(((i + 1) / filesToUpload.length) * 40));
        setProgressLabel(`Upload ${i + 1}/${filesToUpload.length}…`);
      }

      // === STEP 1b: Delete legacy variants (timestamp-prefixed) replaced by the new clean uploads ===
      if (legacyPathsToDelete.length > 0) {
        const { error: rmErr } = await supabase.storage.from('documents').remove(legacyPathsToDelete);
        if (rmErr) {
          console.error('Failed to delete legacy variants:', rmErr);
          // Non-fatal: new file is uploaded, EF rebuild will pick the latest by fileName.
          // But warn the user that cleanup didn't fully happen.
          toast.warning('Anciens fichiers conservés (erreur de nettoyage) — pas critique, mais à signaler au support si ça se reproduit.');
        }
      }

      // === STEP 2: Parse each file via Python micro-service ===
      setProgressLabel('Analyse des documents…');
      const docs: ParsedDocument[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        setProgressLabel(`Lecture de ${filesToUpload[i].name} (${i + 1}/${filesToUpload.length})…`);
        setProgress(Math.round(40 + (i / filesToUpload.length) * 35)); // 40-75%

        // Normalize fileName to match what storage list returns (sanitized)
        const parsed = await parseFile(filesToUpload[i]);
        parsed.fileName = uploadSafeNames[i];
        docs.push(parsed);
        setParsedDocs([...docs]);

        console.log(`[parser] ${filesToUpload[i].name}: ${parsed.quality} — ${parsed.summary}`);
      }

      // === STEP 3: Merge report.files (dedup by fileName) then ask EF to rebuild document_content ===
      setProgressLabel('Compilation du dossier…');
      setProgress(78);

      const newReport = buildParsingReport(docs, 0);
      setParsingSummary(newReport);

      const { data: existingEnt } = await supabase.from('enterprises')
        .select('document_parsing_report')
        .eq('id', enterpriseId)
        .single();

      const existingFilesReport = ((existingEnt?.document_parsing_report as any)?.files || []) as any[];
      // Dedup by NORMALIZED fileName (strip legacy timestamp prefix) so a re-upload
      // of "bilan.pdf" replaces the legacy entry "1780XXX_bilan.pdf" in the report.
      const newNormalized = new Set(docs.map(d => stripLegacyPrefix(d.fileName)));
      const mergedFiles = [
        ...existingFilesReport.filter((f: any) => !newNormalized.has(stripLegacyPrefix(f.fileName || ''))),
        ...newReport.files,
      ];

      const { error: updateReportErr } = await supabase.from('enterprises').update({
        document_parsing_report: { ...newReport, files: mergedFiles },
      } as any).eq('id', enterpriseId);
      if (updateReportErr) {
        console.error('Failed to update parsing report:', updateReportErr);
        throw new Error('Impossible de sauvegarder le rapport: ' + updateReportErr.message);
      }

      // Call EF to rebuild document_content from the merged report + storage truth
      const rebuildResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rebuild-document-content`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enterprise_id: enterpriseId }),
        }
      );
      if (!rebuildResp.ok) {
        const err = await rebuildResp.json().catch(() => ({ error: 'Erreur' }));
        console.error('Failed to rebuild document_content:', err);
        // Non-fatal: file is uploaded and report saved; next call will rebuild
        toast.warning('Documents enregistrés, réconciliation différée.');
      } else {
        const rebuildData = await rebuildResp.json();
        console.log('Document content rebuilt:', rebuildData);
      }

      // Toast truth: how many uploaded, how many replaced
      if (replacedCount > 0) {
        toast.success(`${docs.length} document(s) traité(s) — ${replacedCount} remplacé(s)`);
      }

      // === STEP 4: Dispatch reconstruction vers Railway worker (~2s) ===
      // Migration prod 2026-05-20 : l'EF retourne immédiatement un job_id,
      // le worker Railway tourne sans timeout proxy Supabase (150s).
      setProgressLabel('Dispatch IA en cours…');
      setProgress(82);
      const dispatchResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reconstruct-from-traces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enterprise_id: enterpriseId }),
        }
      );

      if (!dispatchResp.ok) {
        const err = await dispatchResp.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Erreur de dispatch');
      }

      const { job_id: jobId } = await dispatchResp.json();
      if (!jobId) throw new Error('Pas de job_id retourné');

      // === STEP 5: Poll ai_jobs toutes les 2s ===
      setProgressLabel('Reconstruction IA en cours… (peut prendre 1-5 min)');
      const POLL_INTERVAL_MS = 2000;
      const MAX_WAIT_MS = 15 * 60 * 1000; // 15 min hard limit
      const startedAt = Date.now();
      let resultData: any = null;
      let pollProgress = 82;

      while (Date.now() - startedAt < MAX_WAIT_MS) {
        // Token refresh sur poll long (au cas où la session expire)
        if (abortRef.current?.signal.aborted) throw new Error('Reconstruction annulée');

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        const { data: job, error: pollErr } = await supabase
          .from('ai_jobs')
          .select('status, result, error_message, error_kind, started_at, finished_at')
          .eq('id', jobId)
          .maybeSingle();

        if (pollErr) {
          console.warn('[reconstruct] poll error (continue):', pollErr.message);
          continue;
        }
        if (!job) {
          console.warn('[reconstruct] job introuvable, continue poll');
          continue;
        }

        // Progress visual : on monte de 82% jusqu'à 95% pendant le poll
        if (pollProgress < 95) {
          pollProgress = Math.min(95, pollProgress + 0.5);
          setProgress(Math.round(pollProgress));
        }
        if ((job as any).started_at && pollProgress < 90) {
          setProgressLabel('Claude analyse les documents… (~1-3 min)');
        }

        const status = (job as any).status;
        if (status === 'ready') {
          const r = (job as any).result || {};
          resultData = r.data || r;
          break;
        }
        if (status === 'error') {
          throw new Error((job as any).error_message || 'Reconstruction échouée côté worker');
        }
        // sinon: status 'pending' ou 'running' → continue
      }

      if (!resultData) {
        throw new Error('Reconstruction trop longue (>15 min). Réessayez avec moins de fichiers.');
      }

      const confidence = resultData.score_confiance || 0;

      // Le worker gère déjà operating_mode + data_room_enabled, mais le slug
      // doit être set côté front (worker n'a pas crypto.randomUUID dispo).
      if (confidence >= 70) {
        const { data: ent } = await supabase
          .from('enterprises')
          .select('data_room_slug')
          .eq('id', enterpriseId)
          .maybeSingle();
        if (!(ent as any)?.data_room_slug) {
          await supabase
            .from('enterprises')
            .update({ data_room_slug: crypto.randomUUID().substring(0, 12) })
            .eq('id', enterpriseId);
        }
      }

      setProgress(100);
      setProgressLabel('Terminé !');
      setResult(resultData);
      await fetchExistingFiles();
      toast.success(confidence >= 70
        ? 'Données solides — mode Due Diligence activé !'
        : 'Reconstruction terminée — ajoutez plus de documents pour améliorer la qualité.');

    } catch (err: any) {
      const message = err.name === 'AbortError'
        ? 'Reconstruction annulée.'
        : (err.message || 'Erreur');
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };


  const handleUseData = async () => {
    toast.success('Données intégrées au pipeline !');
    setResult(null);
    setFiles([]);
    setParsedDocs([]);
    setParsingSummary(null);
    onComplete();
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setUploading(false);
    setProgress(0);
    setProgressLabel('');
    toast.info('Reconstruction arrêtée');
  };

  const handleReset = () => {
    setResult(null);
    setFiles([]);
    setProgress(0);
    setParsedDocs([]);
    setParsingSummary(null);
    
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // Result view
  if (result) {
    const report = result.reconstruction_report;
    const confidence = result.score_confiance || 0;
    const confidenceColor = confidence >= 70 ? 'text-green-600' : confidence >= 40 ? 'text-amber-600' : 'text-red-600';

    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Reconstruction terminée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Confiance</p>
              <p className={`text-3xl font-display font-bold ${confidenceColor}`}>{confidence}%</p>
            </div>
            {report?.source_documents && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Documents analysés</p>
                <p className="text-xl font-bold">{report.source_documents.length}</p>
              </div>
            )}
          </div>

          {report?.note_analyste && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Note de l'analyste IA</p>
              <p className="text-sm">{report.note_analyste}</p>
            </div>
          )}

          {report?.hypotheses && report.hypotheses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Hypothèses utilisées
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {report.hypotheses.map((h, i) => <li key={i}>• {h}</li>)}
              </ul>
            </div>
          )}

          {report?.donnees_manquantes && report.donnees_manquantes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Données manquantes</p>
              <div className="flex flex-wrap gap-1">
                {report.donnees_manquantes.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}


          <div className="flex gap-2 pt-2">
            <Button onClick={handleUseData} className="flex-1">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Utiliser ces données
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Recommencer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <DocumentConflictDialog
      open={conflictDialog.open}
      conflicts={conflictDialog.files}
      onChoice={resolveConflict}
    />
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardContent className="py-6">
        {/* Existing files from storage */}
        {existingFiles.length > 0 && files.length === 0 && !uploading && (
          <div className="mb-4 space-y-1">
            <p className="text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {existingFiles.length} document(s) déjà intégré(s)
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">Les nouveaux fichiers viendront compléter ces documents. Rien n'est perdu.</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {existingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-1.5 group">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{f.name.replace(/^\d+_/, '')}</span>
                  {f.metadata?.size && (
                    <span className="text-muted-foreground/50 shrink-0 text-[10px]">{formatFileSize(f.metadata.size)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownloadExisting(f.name)}
                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                    aria-label="Télécharger"
                    title="Télécharger"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteExisting(f.name)}
                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    aria-label="Supprimer"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
            dragOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-primary/50'
          }`}
        >
          <Wand2 className="h-10 w-10 mx-auto text-primary/60 mb-3" />
          <p className="text-sm font-semibold">Uploadez tout ce que vous avez</p>
          <p className="text-xs text-muted-foreground mt-1">
            Relevés bancaires, factures, listes clients, photos de documents…
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            CSV, TXT, Excel, Word, PDF, Images, PowerPoint — max {MAX_FILES} fichiers
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
            {files.map((file, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-background rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground/50 shrink-0">{formatFileSize(file.size)}</span>
                </div>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive ml-2">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Parsing report — live during upload */}
        {parsedDocs.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Documents analysés :</p>
            {parsedDocs.map((doc, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 bg-muted/30 rounded">
                <span className="mt-0.5 text-base">
                  {doc.quality === 'high' ? '✅' : doc.quality === 'medium' ? '🟡' : doc.quality === 'low' ? '⚠️' : '❌'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{doc.fileName}</span>
                    {doc.category !== 'autre' && (
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] uppercase font-medium">
                        {doc.category.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5">{doc.summary}</p>
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {doc.charsExtracted > 0 ? `${(doc.charsExtracted / 1000).toFixed(1)}K` : '—'}
                </span>
              </div>
            ))}

            {parsedDocs.some(d => d.quality === 'failed') && (
              <p className="text-xs text-destructive mt-2">
                ⚠️ {parsedDocs.filter(d => d.quality === 'failed').length} fichier(s) n'ont pas pu être lu(s).
              </p>
            )}
          </div>
        )}

        {/* Progress */}
        {uploading && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> {progressLabel}
              </p>
              <Button variant="ghost" size="sm" onClick={handleStop} className="text-xs text-destructive h-6 px-2">
                <X className="h-3 w-3 mr-1" /> Arrêter
              </Button>
            </div>
          </div>
        )}

        {/* Action button */}
        {files.length > 0 && !uploading && (
          <Button onClick={handleReconstruct} className="w-full mt-4" size="lg">
            <Wand2 className="h-4 w-4 mr-2" />
            Lancer la reconstruction ({files.length} fichier{files.length > 1 ? 's' : ''})
          </Button>
        )}
      </CardContent>
    </Card>
    </>
  );
}
