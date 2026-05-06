// CandidatureRecovery — page publique de rattrapage des fichiers de candidature.
// Le candidat reçoit un lien (généré par un super_admin), arrive ici, voit la
// liste des fichiers attendus, re-uploade chacun, et soumet. Les nouveaux
// storage_paths remplacent les chemins cassés en DB et le token est consommé.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileText, Send } from 'lucide-react';

// Variables d'env Vite : le formulaire public utilise les clés anon (pas de session user).
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

export default function CandidatureRecovery() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<RecoveryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map "field_label|file_name" → File à ré-uploader
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Charge les infos via l'edge fn (action=info)
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

  const allFilesSelected = info?.expected_files.every(f =>
    files[`${f.field_label}|${f.file_name}`]
  ) ?? false;

  const handleSubmit = async () => {
    if (!info || !token || !allFilesSelected) return;
    setUploading(true);
    setError(null);

    try {
      const newDocuments: any[] = [];
      const failedUploads: string[] = [];

      for (const expected of info.expected_files) {
        const key = `${expected.field_label}|${expected.file_name}`;
        const file = files[key];
        if (!file) continue;

        // 1. Demande à l'edge fn une signed upload URL pour ce fichier
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

        // 2. Upload directement via PUT sur l'URL signée (bypass RLS)
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
          field_label: expected.field_label,
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

      // Soumet à l'edge fn
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
              Bonjour <strong>{info?.contact_name ?? info?.company_name}</strong>, suite à un souci
              technique lors de ta candidature{info?.programme_name && ` à "${info.programme_name}"`},
              tes pièces justificatives n'ont pas été correctement enregistrées.
            </p>
            <p className="text-sm text-muted-foreground">
              Merci de bien vouloir les renvoyer ci-dessous (mêmes fichiers qu'à la première soumission).
              Ta candidature elle-même est intacte — seuls les fichiers manquent.
            </p>
            {info?.expires_at && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⏳ Ce lien expire le {new Date(info.expires_at).toLocaleDateString('fr-FR')} à {new Date(info.expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold text-sm">Fichiers attendus ({info?.expected_files.length})</h2>
            <div className="space-y-3">
              {info?.expected_files.map((f, i) => {
                const key = `${f.field_label}|${f.file_name}`;
                const selected = files[key];
                return (
                  <div key={i} className="border rounded p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-violet-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{f.file_name}</p>
                        <p className="text-xs text-muted-foreground">{f.field_label}</p>
                      </div>
                      {selected && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                    </div>
                    <Input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setFiles(prev => ({ ...prev, [key]: file }));
                      }}
                      className="text-xs"
                    />
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {error}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!allFilesSelected || uploading}
              className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {uploading ? 'Envoi en cours...' : `Envoyer mes ${info?.expected_files.length} fichier(s)`}
            </Button>
            {!allFilesSelected && (
              <p className="text-xs text-center text-muted-foreground">
                Sélectionne tous les fichiers ci-dessus avant d'envoyer.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
