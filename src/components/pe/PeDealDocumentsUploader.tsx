// PeDealDocumentsUploader — Upload + parsing Railway + catégorisation auto
// pour les pièces du dossier d'un deal PE.
//
// Calque sur BanqueDocumentUploader / ReconstructionUploader (pattern programme),
// adapté pour la table pe_deal_documents (1 row par fichier) :
//
// Flow :
//   1. drag-and-drop / sélection fichiers (PDF, Excel, Word, etc.)
//   2. Upload Supabase Storage (bucket 'pe_deal_docs', path '{org}/{deal}/{ts}_{name}')
//   3. Parsing Railway via parseFile (détecte aussi la catégorie automatiquement)
//   4. Insert dans pe_deal_documents avec category, mime_type, size, etc.
//   5. Liste des pièces existantes regroupées par catégorie

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  parseFile,
  CATEGORY_LABELS,
  type ParsedDocument,
  type DocumentCategory,
} from '@/lib/document-parser';
import {
  Upload, FileText, Loader2, X, CheckCircle2, FileWarning,
  Download, Trash2,
} from 'lucide-react';

const ACCEPTED = '.csv,.txt,.md,.xlsx,.xls,.docx,.doc,.pdf,.jpg,.jpeg,.png,.webp,.pptx,.ppt';
const MAX_FILES = 20;

interface Props {
  dealId: string;
  organizationId: string;
  onComplete?: () => void;
}

interface DealDoc {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  created_at: string;
}

const CATEGORY_BADGE_COLOR: Record<DocumentCategory, string> = {
  etats_financiers:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  releve_bancaire:     'bg-blue-50 text-blue-700 border-blue-200',
  facture:             'bg-amber-50 text-amber-700 border-amber-200',
  budget_previsionnel: 'bg-purple-50 text-purple-700 border-purple-200',
  business_plan:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  document_legal:      'bg-rose-50 text-rose-700 border-rose-200',
  rapport_activite:    'bg-cyan-50 text-cyan-700 border-cyan-200',
  organigramme_rh:     'bg-orange-50 text-orange-700 border-orange-200',
  photo_installation:  'bg-pink-50 text-pink-700 border-pink-200',
  autre:               'bg-muted text-muted-foreground border-border',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isValidCategory(s: string | null): s is DocumentCategory {
  return s !== null && s in CATEGORY_LABELS;
}

export default function PeDealDocumentsUploader({ dealId, organizationId, onComplete }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<DealDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [parsedDocs, setParsedDocs] = useState<ParsedDocument[]>([]);

  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('pe_deal_documents')
      .select('id, filename, storage_path, mime_type, size_bytes, category, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    setExisting((data ?? []) as DealDoc[]);
  }, [dealId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addFiles = useCallback((next: FileList | File[]) => {
    const arr = Array.from(next);
    setFiles(prev => {
      const combined = [...prev, ...arr].slice(0, MAX_FILES);
      if (prev.length + arr.length > MAX_FILES) toast.warning(`Maximum ${MAX_FILES} fichiers par lot`);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const total = files.length;
      const newParsed: ParsedDocument[] = [];

      for (let i = 0; i < total; i++) {
        const file = files[i];
        const baseProgress = (i / total) * 90;

        // Step A : upload Storage
        setProgressLabel(`Upload ${i + 1}/${total} — ${file.name}`);
        setProgress(Math.round(baseProgress + 10));
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${organizationId}/${dealId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from('pe_deal_docs').upload(path, file);
        if (upErr) {
          toast.error(`Upload ${file.name} échoué : ${upErr.message}`);
          continue;
        }

        // Step B : parsing Railway pour détecter category + extraire texte
        setProgressLabel(`Lecture ${i + 1}/${total} — ${file.name}`);
        setProgress(Math.round(baseProgress + 50));
        const parsed = await parseFile(file);
        newParsed.push(parsed);
        setParsedDocs([...newParsed]);

        // Step C : insert pe_deal_documents avec category détectée
        setProgressLabel(`Enregistrement ${i + 1}/${total}`);
        setProgress(Math.round(baseProgress + 80));
        const { error: dbErr } = await supabase
          .from('pe_deal_documents')
          .insert({
            deal_id: dealId,
            organization_id: organizationId,
            filename: file.name,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
            category: parsed.category,
            uploaded_by: user.id,
          });
        if (dbErr) {
          toast.error(`Enregistrement ${file.name} échoué : ${dbErr.message}`);
          continue;
        }
      }

      setProgress(100);
      setProgressLabel('Terminé');
      const okCount = newParsed.filter(d => d.quality !== 'failed').length;
      toast.success(`${okCount} ${okCount > 1 ? 'pièces ajoutées' : 'pièce ajoutée'} au dossier`, {
        description: 'Catégorisation auto effectuée. Tu peux maintenant générer le pré-screening.',
      });

      setFiles([]);
      await refresh();
      onComplete?.();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(d: DealDoc) {
    const { data, error } = await supabase.storage.from('pe_deal_docs').createSignedUrl(d.storage_path, 60);
    if (error || !data) { toast.error(`Téléchargement échoué : ${error?.message}`); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function handleDelete(d: DealDoc) {
    if (!confirm(`Supprimer ${d.filename} ?`)) return;
    const { error: storErr } = await supabase.storage.from('pe_deal_docs').remove([d.storage_path]);
    if (storErr) toast.warning(`Storage : ${storErr.message}`);
    const { error: dbErr } = await supabase.from('pe_deal_documents').delete().eq('id', d.id);
    if (dbErr) { toast.error(`DB : ${dbErr.message}`); return; }
    toast.success(`${d.filename} supprimé`);
    await refresh();
    onComplete?.();
  }

  // Group existing by category for display
  const grouped = existing.reduce<Record<string, DealDoc[]>>((acc, d) => {
    const cat = isValidCategory(d.category) ? d.category : 'autre';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});
  const totalSize = existing.reduce((s, d) => s + (d.size_bytes || 0), 0);
  const lastUpdate = existing[0]?.created_at;

  return (
    <div className="space-y-4">
      {/* Stats pièces du dossier */}
      {existing.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Pièces du dossier — {existing.length} {existing.length > 1 ? 'pièces' : 'pièce'}
            </div>
            <div className="flex gap-2 text-xs flex-wrap">
              <Badge variant="outline" className="bg-muted/40">{formatSize(totalSize)} total</Badge>
              {lastUpdate && (
                <Badge variant="outline" className="bg-muted/40">
                  MAJ {new Date(lastUpdate).toLocaleDateString('fr-FR')}
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Drop zone — Upload document */}
      <Card className="p-0 border-dashed border-2">
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`cursor-pointer rounded-md p-8 text-center transition-colors ${
            dragOver ? 'bg-primary/10' : 'hover:bg-muted/40'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <Upload className="h-10 w-10 mx-auto text-primary/60 mb-3" />
          <p className="text-sm font-semibold">Upload document</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pitch deck, états financiers, statuts, contrats, factures, organigramme, photos…
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            PDF, Excel, Word, CSV, images, PowerPoint — max {MAX_FILES} fichiers par lot
          </p>
          <p className="text-[10px] text-primary/70 mt-1">
            Catégorisation automatique par l'IA après lecture
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
          <div className="text-xs font-semibold mb-2 text-muted-foreground">
            Fichiers à intégrer ({files.length})
          </div>
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
          <div className="text-xs font-semibold mb-2">Lecture des pièces</div>
          <div className="space-y-1.5">
            {parsedDocs.map((doc, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 bg-muted/30 rounded-md">
                <span className="mt-0.5">
                  {doc.quality === 'high' ? '✅' : doc.quality === 'medium' ? '🟡' : doc.quality === 'low' ? '⚠️' : '❌'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{doc.fileName}</span>
                    <Badge variant="outline" className={`text-[10px] uppercase ${CATEGORY_BADGE_COLOR[doc.category]}`}>
                      {CATEGORY_LABELS[doc.category]}
                    </Badge>
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

      {/* Pièces existantes — groupées par catégorie */}
      {existing.length > 0 && (
        <div className="space-y-3">
          {(Object.keys(grouped) as DocumentCategory[]).sort().map((cat) => (
            <Card key={cat} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-[10px] uppercase ${CATEGORY_BADGE_COLOR[cat] ?? CATEGORY_BADGE_COLOR.autre}`}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </Badge>
                <span className="text-xs text-muted-foreground">({grouped[cat].length})</span>
              </div>
              <div className="space-y-1">
                {grouped[cat].map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-3 py-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{d.filename}</span>
                    {d.size_bytes != null && (
                      <span className="text-xs text-muted-foreground shrink-0">{formatSize(d.size_bytes)}</span>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(d)} title="Télécharger">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(d)} title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {existing.length === 0 && !uploading && files.length === 0 && (
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Aucune pièce uploadée</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Ajoutez les pièces essentielles : pitch deck, états financiers 3 ans, statuts, RCCM, contrats clients clés, organigramme.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
