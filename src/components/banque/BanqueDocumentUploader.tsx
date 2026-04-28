// BanqueDocumentUploader — upload de pièces du dossier crédit (segment Banque).
//
// Version simplifiée du ReconstructionUploader (Programme) : pas de reconstruction
// d'inputs, pas de score de confiance. Les documents parsés viennent enrichir
// enterprise.document_content qui est ensuite lu par tous les générateurs CR.
//
// Flow :
//   1. drag-and-drop / sélection fichiers
//   2. upload Supabase Storage (bucket 'documents', path 'banque/')
//   3. parsing Railway via proxy-parser (parseFile)
//   4. APPEND à enterprise.document_content (additif — accumule entre sessions)
//   5. liste les pièces déjà chargées dans le dossier

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { parseFile, buildDocumentContent, buildParsingReport, type ParsedDocument } from '@/lib/document-parser';
import { Upload, FileText, Loader2, X, CheckCircle2, FileWarning } from 'lucide-react';

const ACCEPTED = '.csv,.txt,.md,.xlsx,.xls,.docx,.doc,.pdf,.jpg,.jpeg,.png,.webp,.pptx,.ppt';
const MAX_FILES = 20;

interface Props {
  enterpriseId: string;
  onComplete?: () => void;
}

interface StorageFile {
  name: string;
  metadata?: { size?: number };
  created_at?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function BanqueDocumentUploader({ enterpriseId, onComplete }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<StorageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [parsedDocs, setParsedDocs] = useState<ParsedDocument[]>([]);
  const [contentLength, setContentLength] = useState<number>(0);
  const [filesCount, setFilesCount] = useState<number>(0);

  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const refreshExisting = useCallback(async () => {
    const [{ data: storage }, { data: ent }] = await Promise.all([
      supabase.storage.from('documents').list(`${enterpriseId}/banque/`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
      supabase.from('enterprises').select('document_content, document_files_count').eq('id', enterpriseId).single(),
    ]);
    if (storage) setExisting(storage.filter(f => f.name !== '.emptyFolderPlaceholder'));
    setContentLength((ent?.document_content as string)?.length || 0);
    setFilesCount(ent?.document_files_count || 0);
  }, [enterpriseId]);

  useEffect(() => { refreshExisting(); }, [refreshExisting]);

  const addFiles = useCallback((next: FileList | File[]) => {
    const arr = Array.from(next);
    setFiles(prev => {
      const combined = [...prev, ...arr].slice(0, MAX_FILES);
      if (prev.length + arr.length > MAX_FILES) toast.warning(`Maximum ${MAX_FILES} fichiers`);
      return combined;
    });
  }, []);

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  async function handleProcess() {
    if (files.length === 0) {
      toast.error('Ajoutez au moins un fichier');
      return;
    }

    setUploading(true);
    setProgress(0);
    setParsedDocs([]);

    try {
      // STEP 1: upload to Storage
      setProgressLabel('Upload des pièces…');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${enterpriseId}/banque/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
        if (error) throw error;
        setProgress(Math.round(((i + 1) / files.length) * 40));
      }

      // STEP 2: parse via Railway (through proxy-parser)
      const docs: ParsedDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgressLabel(`Lecture de ${files[i].name} (${i + 1}/${files.length})…`);
        setProgress(Math.round(40 + (i / files.length) * 50));
        const parsed = await parseFile(files[i]);
        docs.push(parsed);
        setParsedDocs([...docs]);
      }

      // STEP 3: APPEND to enterprise.document_content (additive)
      setProgressLabel('Compilation du dossier…');
      setProgress(92);

      const newContent = buildDocumentContent(docs);
      const parsingReport = buildParsingReport(docs, newContent.length);

      const { data: ent } = await supabase.from('enterprises')
        .select('document_content, document_files_count')
        .eq('id', enterpriseId)
        .single();

      const existingContent = (ent?.document_content as string) || '';
      const separator = `\n\n══════ PIÈCES AJOUTÉES LE ${new Date().toLocaleDateString('fr-FR')} ══════\n`;
      const merged = existingContent + separator + newContent;
      const MAX_CONTENT = 300_000;
      const finalContent = merged.length > MAX_CONTENT ? merged.slice(merged.length - MAX_CONTENT) : merged;

      const newCount = (ent?.document_files_count || 0) + docs.filter(d => d.quality !== 'failed').length;

      const { error: updErr } = await supabase.from('enterprises').update({
        document_content: finalContent,
        document_content_updated_at: new Date().toISOString(),
        document_files_count: newCount,
        document_parsing_report: parsingReport,
      } as any).eq('id', enterpriseId);
      if (updErr) throw updErr;

      setProgress(100);
      setProgressLabel('Terminé');
      toast.success(`${docs.filter(d => d.quality !== 'failed').length} pièce(s) intégrée(s) au dossier`);

      setFiles([]);
      await refreshExisting();
      onComplete?.();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tête : pièces déjà chargées */}
      {(existing.length > 0 || filesCount > 0) && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Pièces du dossier ({existing.length})
            </div>
            {contentLength > 0 && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {(contentLength / 1000).toFixed(0)}K caractères analysés · {filesCount} fichier{filesCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Ces pièces ont déjà été parsées. Les nouveaux fichiers viendront s'ajouter sans rien écraser.
          </p>
          {existing.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {existing.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{f.name.replace(/^\d+_/, '')}</span>
                  {f.metadata?.size && <span className="text-muted-foreground/60 shrink-0">{formatSize(f.metadata.size)}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Drop zone */}
      <Card className="p-0 border-dashed border-2">
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-md p-8 text-center transition-colors ${
            dragOver ? 'bg-primary/10' : 'hover:bg-muted/40'
          }`}
        >
          <Upload className="h-10 w-10 mx-auto text-primary/60 mb-3" />
          <p className="text-sm font-semibold">Déposer ou cliquer pour ajouter des pièces</p>
          <p className="text-xs text-muted-foreground mt-1">
            Liasses fiscales, relevés bancaires, statuts, RCCM, factures, contrats, devis…
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            PDF, Excel, Word, CSV, images, PowerPoint — max {MAX_FILES} fichiers
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>
      </Card>

      {/* Liste fichiers à uploader */}
      {files.length > 0 && (
        <Card className="p-4">
          <div className="text-xs font-semibold mb-2 text-muted-foreground">Fichiers à intégrer ({files.length})</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {files.map((file, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground/60 shrink-0">{formatSize(file.size)}</span>
                </div>
                {!uploading && (
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive ml-2">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!uploading && (
            <Button onClick={handleProcess} className="w-full mt-3 gap-2" size="lg">
              <Upload className="h-4 w-4" />
              Intégrer les {files.length} pièce{files.length > 1 ? 's' : ''} au dossier
            </Button>
          )}
        </Card>
      )}

      {/* Progress */}
      {uploading && (
        <Card className="p-4">
          <Progress value={progress} className="h-2 mb-2" />
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> {progressLabel}
          </div>
        </Card>
      )}

      {/* Live parsing report */}
      {parsedDocs.length > 0 && (
        <Card className="p-4">
          <div className="text-xs font-semibold mb-2">Lecture des documents</div>
          <div className="space-y-1.5">
            {parsedDocs.map((doc, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 bg-muted/30 rounded-md">
                <span className="mt-0.5">
                  {doc.quality === 'high' ? '✅' : doc.quality === 'medium' ? '🟡' : doc.quality === 'low' ? '⚠️' : '❌'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{doc.fileName}</span>
                    {doc.category !== 'autre' && (
                      <Badge variant="outline" className="text-[10px] uppercase">{doc.category.replace(/_/g, ' ')}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5">{doc.summary}</p>
                </div>
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {doc.charsExtracted > 0 ? `${(doc.charsExtracted / 1000).toFixed(1)}K` : '—'}
                </span>
              </div>
            ))}
            {parsedDocs.some(d => d.quality === 'failed') && (
              <div className="text-xs text-destructive flex items-center gap-1.5 mt-2">
                <FileWarning className="h-3 w-3" />
                {parsedDocs.filter(d => d.quality === 'failed').length} fichier(s) illisible(s) — réessayez avec une meilleure qualité.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
