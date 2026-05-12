import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { parseFile, buildDocumentContent, buildParsingReport, type ParsedDocument, type ParsingReport } from '@/lib/document-parser';
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
    // `download: true` ajoute Content-Disposition: attachment côté Supabase
    // → le browser télécharge au lieu d'essayer d'afficher inline (sinon les
    // .pptx, .docx, .xlsx ouvrent un onglet vide).
    // On passe aussi un displayName propre (sans le préfixe timestamp Date.now()
    // qu'on ajoute à l'upload) pour que l'utilisateur retrouve le nom original.
    const displayName = filename.replace(/^\d+_/, '');
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(`${enterpriseId}/reconstruction/${filename}`, 600, {
        download: displayName,
      });
    if (error || !data) {
      toast.error('Impossible de générer le lien de téléchargement');
      return;
    }
    // Crée un <a> temporaire pour déclencher le download via attribute "download"
    // (plus fiable que window.open quand Content-Disposition est attachment)
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDeleteExisting = async (filename: string) => {
    if (!confirm(`Supprimer "${filename.replace(/^\d+_/, '')}" ?`)) return;
    const { error } = await supabase.storage
      .from('documents')
      .remove([`${enterpriseId}/reconstruction/${filename}`]);
    if (error) {
      toast.error('Erreur de suppression : ' + error.message);
      return;
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

      // === STEP 1: Upload all files to storage ===
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${enterpriseId}/reconstruction/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
        if (error) throw error;
        setProgress(Math.round(((i + 1) / files.length) * 40));
        setProgressLabel(`Upload ${i + 1}/${files.length}…`);
      }

      // === STEP 2: Parse each file via Python micro-service ===
      setProgressLabel('Analyse des documents…');
      const docs: ParsedDocument[] = [];

      for (let i = 0; i < files.length; i++) {
        setProgressLabel(`Lecture de ${files[i].name} (${i + 1}/${files.length})…`);
        setProgress(Math.round(40 + (i / files.length) * 35)); // 40-75%

        const parsed = await parseFile(files[i]);
        docs.push(parsed);
        setParsedDocs([...docs]);

        console.log(`[parser] ${files[i].name}: ${parsed.quality} — ${parsed.summary}`);
      }

      // === STEP 3: Build and cache document content (ADDITIVE — append, don't replace) ===
      setProgressLabel('Compilation du dossier…');
      setProgress(78);

      const newContent = buildDocumentContent(docs);
      const parsingReport = buildParsingReport(docs, newContent.length);
      setParsingSummary(parsingReport);

      // Load existing document_content and APPEND new content
      const { data: existingEnt } = await supabase.from('enterprises')
        .select('document_content')
        .eq('id', enterpriseId)
        .single();

      const existingContent = (existingEnt?.document_content as string) || '';
      const separator = `\n\n══════ DOCUMENTS AJOUTÉS LE ${new Date().toLocaleDateString('fr-FR')} ══════\n`;
      const mergedContent = existingContent + separator + newContent;

      // Truncate if too long (keep the most recent 300K chars)
      const MAX_CONTENT = 300_000;
      const finalContent = mergedContent.length > MAX_CONTENT
        ? mergedContent.slice(mergedContent.length - MAX_CONTENT)
        : mergedContent;

      const { error: updateErr } = await supabase.from('enterprises').update({
        document_content: finalContent,
        document_content_updated_at: new Date().toISOString(),
        document_files_count: docs.filter(d => d.quality !== 'failed').length,
        document_parsing_report: parsingReport,
      } as any).eq('id', enterpriseId);
      if (updateErr) {
        console.error('Failed to cache document content:', updateErr);
        throw new Error('Impossible de sauvegarder le contenu documentaire: ' + updateErr.message);
      }

      console.log('Document content cached:', finalContent.length, 'chars from', docs.length, 'files');

      // === STEP 4: Reconstruction (reads cache — fast) ===
      setProgressLabel('Reconstruction IA en cours…');
      setProgress(82);
      const abortController = new AbortController();
      abortRef.current = abortController;
      const timeoutId = setTimeout(() => abortController.abort(), 180000);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reconstruct-from-traces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enterprise_id: enterpriseId }),
          signal: abortController.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Erreur de reconstruction');
      }

      const data = await response.json();
      const resultData = data.data || data;
      const confidence = resultData.score_confiance || 0;

      // Auto-detect operating mode based on confidence score
      const autoMode = confidence >= 70 ? 'due_diligence' : 'reconstruction';
      const modeUpdates: Record<string, unknown> = { operating_mode: autoMode };
      if (autoMode === 'due_diligence') {
        modeUpdates.data_room_enabled = true;
        modeUpdates.data_room_slug = crypto.randomUUID().substring(0, 12);
      }
      await supabase.from('enterprises').update(modeUpdates).eq('id', enterpriseId);

      setProgress(95);

      setProgress(100);
      setProgressLabel('Terminé !');
      setResult(resultData);
      await fetchExistingFiles();
      toast.success(confidence >= 70
        ? 'Données solides — mode Due Diligence activé !'
        : 'Reconstruction terminée — ajoutez plus de documents pour améliorer la qualité.');

    } catch (err: any) {
      const message = err.name === 'AbortError'
        ? 'La reconstruction a pris trop de temps. Essayez avec moins de fichiers.'
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
  );
}
