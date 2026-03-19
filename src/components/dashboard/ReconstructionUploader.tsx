import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { parseFile, buildDocumentContent, buildParsingReport, fileToBase64, type ParsedDocument, type ParsingReport } from '@/lib/document-parser';
import {
  Wand2, X, FileText, Loader2, CheckCircle2,
  AlertTriangle, RotateCcw
} from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.csv,.txt,.md,.xlsx,.xls,.docx,.doc,.pdf,.jpg,.jpeg,.png,.webp';
const MAX_FILES = 20;
const MAX_VISION_FILES = 5;

interface ReconstructionUploaderProps {
  enterpriseId: string;
  session: any;
  navigate: (path: string) => void;
  onComplete: () => void;
  onPreScreeningDone?: (data: any) => void;
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

export default function ReconstructionUploader({ enterpriseId, session, navigate, onComplete, onPreScreeningDone }: ReconstructionUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<ReconstructionResult | null>(null);
  const [parsingSummary, setParsingSummary] = useState<ParsingReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

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
        const filePath = `${enterpriseId}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
        if (error) throw error;
        setProgress(Math.round(((i + 1) / files.length) * 40));
        setProgressLabel(`Upload ${i + 1}/${files.length}…`);
      }

      // === STEP 2: Parse files client-side ===
      setProgressLabel('Analyse des documents…');
      const parsedDocs: ParsedDocument[] = [];
      const needsVision: { file: File; parsed: ParsedDocument }[] = [];

      for (let i = 0; i < files.length; i++) {
        setProgressLabel(`Lecture de ${files[i].name}…`);
        setProgress(Math.round(40 + (i / files.length) * 20)); // 40-60%

        const parsed = await parseFile(files[i]);
        parsedDocs.push(parsed);

        if (parsed.method === 'needs_vision') {
          needsVision.push({ file: files[i], parsed });
        }
      }

      // Show initial parsing summary to user
      setParsingSummary(buildParsingReport(parsedDocs, 0));

      // === STEP 3: Send scanned PDFs/images to Vision API (one by one) ===
      const visionCount = Math.min(needsVision.length, MAX_VISION_FILES);
      for (let i = 0; i < visionCount; i++) {
        const { file, parsed } = needsVision[i];
        setProgressLabel(`OCR de ${file.name} (${i + 1}/${visionCount})…`);
        setProgress(Math.round(60 + (i / visionCount) * 15)); // 60-75%

        try {
          const base64 = await fileToBase64(file);

          const visionResp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-vision-file`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                file_base64: base64,
                file_name: file.name,
                media_type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
              }),
            }
          );

          if (visionResp.ok) {
            const visionData = await visionResp.json();
            parsed.content = visionData.text || '';
            parsed.method = 'client_pdf_text';
          }
        } catch (err) {
          console.warn('Vision parsing failed for', file.name, err);
          parsed.content = `[OCR échoué pour ${file.name}]`;
        }
      }

      if (needsVision.length > MAX_VISION_FILES) {
        for (let i = MAX_VISION_FILES; i < needsVision.length; i++) {
          needsVision[i].parsed.content = `[OCR ignoré — limite de ${MAX_VISION_FILES} fichiers vision atteinte]`;
        }
      }

      // === STEP 4: Build, classify, and cache document content ===
      setProgressLabel('Compilation du dossier…');
      setProgress(78);

      // Update summaries after vision
      setParsingSummary(buildParsingReport(parsedDocs, 0));

      const documentContent = buildDocumentContent(parsedDocs);
      const parsingReport = buildParsingReport(parsedDocs, documentContent.length);
      setParsingSummary(parsingReport);

      await supabase.from('enterprises').update({
        document_content: documentContent,
        document_content_updated_at: new Date().toISOString(),
        document_files_count: parsedDocs.length,
        document_parsing_report: parsingReport,
      } as any).eq('id', enterpriseId);

      console.log('Document content cached:', documentContent.length, 'chars from', parsingReport.files_parsed_ok, 'files');

      // === STEP 5: Reconstruction (reads cache — fast) ===
      setProgressLabel('Reconstruction IA en cours…');
      setProgress(82);
      const abortController = new AbortController();
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

      // === STEP 6: Auto-launch pre-screening ===
      setProgressLabel('Analyse du dossier en cours…');
      setProgress(90);
      try {
        const preScreenResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pre-screening`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ enterprise_id: enterpriseId }),
          }
        );
        if (preScreenResp.ok) {
          const preScreenData = await preScreenResp.json();
          onPreScreeningDone?.(preScreenData.data);
        }
      } catch (e) {
        console.warn('Pre-screening failed (non-blocking):', e);
      }

      setProgress(100);
      setProgressLabel('Terminé !');
      setResult(resultData);
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
    onComplete();
  };

  const handleReset = () => {
    setResult(null);
    setFiles([]);
    setProgress(0);
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
            CSV, TXT, Excel, Word, PDF, Images — max {MAX_FILES} fichiers
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

        {/* Parsing report */}
        {parsingSummary && uploading && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Rapport d'extraction</h4>
              <span className="text-xs text-muted-foreground">
                {parsingSummary.total_chars_extracted > 0
                  ? `${(parsingSummary.total_chars_extracted / 1000).toFixed(0)}K caractères`
                  : 'Analyse en cours…'}
              </span>
            </div>

            {parsingSummary.files.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs border-b border-border/50 pb-2">
                <span className="mt-0.5">
                  {f.extractionQuality === 'high' ? '✅' : f.extractionQuality === 'medium' ? '🟡' : f.extractionQuality === 'low' ? '⚠️' : '❌'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{f.fileName}</span>
                    <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] uppercase shrink-0">
                      {f.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{f.summary}</p>
                </div>
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {f.charsExtracted > 0 ? `${(f.charsExtracted / 1000).toFixed(1)}K` : '—'}
                </span>
              </div>
            ))}

            {parsingSummary.files_failed > 0 && (
              <p className="text-xs text-destructive">
                ⚠️ {parsingSummary.files_failed} fichier(s) n'ont pas pu être lu(s).
              </p>
            )}
          </div>
        )}

        {/* Progress */}
        {uploading && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {progressLabel}
            </p>
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
