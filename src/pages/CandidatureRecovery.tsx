// CandidatureRecovery — page publique de rattrapage des fichiers de candidature.
// Drag & drop global : le candidat dépose tous ses fichiers d'un coup, le code
// matche automatiquement les noms avec la liste des fichiers attendus pour
// retrouver le field_label original. Les fichiers non matchés sont taggés
// "Document supplémentaire".
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileText, Send, X } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ExpectedFile {
  field_label: string;
  file_name: string;
  file_size: number | null;
}

interface RecoveryInfo {
  candidature_id: string;
  company_name: string;
  contact_name: string | null;
  programme_name: string | null;
  expected_files: ExpectedFile[];
  expires_at: string | null;
}

interface DroppedFile {
  file: File;
  matched: ExpectedFile | null;
}

// Normalize un nom de fichier pour comparaison : lowercase, retire extension,
// remplace _- par espace, retire ponctuation. Conserve les mots > 2 lettres.
function normalize(s: string): Set<string> {
  const cleaned = s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/\.[^.]+$/, '')                   // retire l'extension
    .replace(/[_\-]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim();
  return new Set(cleaned.split(/\s+/).filter(w => w.length > 2));
}

// Match un fichier droppé avec un des fichiers attendus.
// Score : nombre de mots communs / total mots distincts. Match si >= 50%.
function matchFileToExpected(fileName: string, expected: ExpectedFile[]): ExpectedFile | null {
  const fileWords = normalize(fileName);
  if (fileWords.size === 0) return null;

  let best: { exp: ExpectedFile; score: number } | null = null;
  for (const exp of expected) {
    const expWords = normalize(exp.file_name);
    if (expWords.size === 0) continue;
    const common = [...fileWords].filter(w => expWords.has(w)).length;
    const total = new Set([...fileWords, ...expWords]).size;
    const score = total > 0 ? common / total : 0;
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { exp, score };
    }
  }
  return best?.exp ?? null;
}

export default function CandidatureRecovery() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<RecoveryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setError('Lien invalide'); setLoading(false); return; }
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/candidature-recovery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'info', token }),
        });
        const data = await resp.json();
        if (!resp.ok) { setError(data.error || 'Lien invalide'); setLoading(false); return; }
        setInfo(data);
      } catch (e: any) {
        setError(e.message || 'Erreur de connexion');
      }
      setLoading(false);
    })();
  }, [token]);

  const addFiles = (newFiles: File[]) => {
    if (!info) return;
    const enriched: DroppedFile[] = newFiles.map(file => ({
      file,
      matched: matchFileToExpected(file.name, info.expected_files),
    }));
    setDroppedFiles(prev => [...prev, ...enriched]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setDroppedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!info || !token || droppedFiles.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const newDocuments: any[] = [];
      const failedUploads: string[] = [];

      for (const dropped of droppedFiles) {
        const file = dropped.file;
        // 1. Demande signed URL
        const urlRes = await fetch(`${SUPABASE_URL}/functions/v1/candidature-recovery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'upload_url', token, filename: file.name }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok || !urlData.signed_url) {
          failedUploads.push(file.name);
          continue;
        }

        // 2. PUT sur signed URL
        const putRes = await fetch(urlData.signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putRes.ok) {
          failedUploads.push(file.name);
          continue;
        }

        newDocuments.push({
          field_label: dropped.matched?.field_label || 'Document supplémentaire',
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

      const submitRes = await fetch(`${SUPABASE_URL}/functions/v1/candidature-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'submit', token, documents: newDocuments }),
      });
      const data = await submitRes.json();
      if (!submitRes.ok) {
        setError(data.error || 'Erreur lors de l\'enregistrement');
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
            <h1 className="text-xl font-semibold">Documents enregistrés ✓</h1>
            <p className="text-sm text-muted-foreground">
              Merci ! Tes pièces justificatives ont été correctement transmises et sont
              maintenant attachées à ta candidature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const matchedCount = droppedFiles.filter(d => d.matched).length;
  const unmatchedCount = droppedFiles.length - matchedCount;
  const expectedCount = info?.expected_files.length ?? 0;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-violet-600" />
              <h1 className="text-xl font-semibold">Renvoi de tes pièces justificatives</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Merci de renvoyer les pièces justificatives ci-dessous.
            </p>
            {info?.expires_at && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⏳ Ce lien expire le {new Date(info.expires_at).toLocaleDateString('fr-FR')} à {new Date(info.expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {expectedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {expectedCount} fichier{expectedCount > 1 ? 's' : ''} attendu{expectedCount > 1 ? 's' : ''} (à la première soumission). Tu peux en envoyer plus ou moins.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-violet-500 bg-violet-50' : 'border-muted-foreground/30 hover:border-violet-400 hover:bg-muted/30'
              }`}
            >
              <Upload className="h-10 w-10 text-violet-600 mx-auto mb-2" />
              <p className="font-medium">
                {isDragging ? 'Dépose tes fichiers ici' : 'Glisse tes fichiers ici ou clique pour sélectionner'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOCX, XLSX, images — tous formats acceptés
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {/* Liste des fichiers droppés */}
            {droppedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{droppedFiles.length} fichier{droppedFiles.length > 1 ? 's' : ''} ajouté{droppedFiles.length > 1 ? 's' : ''}</span>
                  <span>
                    {matchedCount > 0 && <span className="text-emerald-600">{matchedCount} ✓ reconnu{matchedCount > 1 ? 's' : ''}</span>}
                    {unmatchedCount > 0 && <span className="text-amber-600 ml-2">{unmatchedCount} ⚠ supplémentaire{unmatchedCount > 1 ? 's' : ''}</span>}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {droppedFiles.map((d, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-3 py-2">
                      <FileText className={`h-4 w-4 shrink-0 ${d.matched ? 'text-emerald-500' : 'text-amber-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{d.file.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.matched
                            ? `→ ${d.matched.field_label}`
                            : 'Document supplémentaire (non reconnu)'}
                          {' · '}{Math.round(d.file.size / 1024)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        type="button"
                        className="text-muted-foreground hover:text-red-500 p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {error}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={droppedFiles.length === 0 || uploading}
              className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {uploading
                ? 'Envoi en cours...'
                : droppedFiles.length === 0
                  ? 'Ajoute des fichiers pour envoyer'
                  : `Envoyer mes ${droppedFiles.length} fichier${droppedFiles.length > 1 ? 's' : ''}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
