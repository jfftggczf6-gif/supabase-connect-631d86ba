import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, FileUp, PenLine, Sparkles } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import SuiviReportModal from './SuiviReportModal';
import FinalReportModal from './FinalReportModal';

interface CoachingTabProps {
  enterpriseId: string;
  enterpriseName: string;
}

type NoteMode = 'idle' | 'write' | 'processing' | 'review';

interface IAResult {
  titre: string;
  resume: string;
  infos_extraites: { info: string; categorie: string; injecter: boolean }[];
}

export default function CoachingTab({ enterpriseId, enterpriseName }: CoachingTabProps) {
  const { session: authSession } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState<'suivi' | 'final' | null>(null);

  // Note input state
  const [mode, setMode] = useState<NoteMode>('idle');
  const [text, setText] = useState('');
  const [dateRdv, setDateRdv] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [iaResult, setIaResult] = useState<IAResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadNotes = async () => {
    const { data } = await supabase
      .from('coaching_notes' as any)
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .order('created_at', { ascending: false });
    setNotes((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadNotes(); }, [enterpriseId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setMode('write'); }
  };

  const handleAnalyze = async () => {
    if (!text.trim() && !file) {
      toast.error('Ajoutez du texte ou un fichier');
      return;
    }

    setMode('processing');
    setAnalyzing(true);

    try {
      let content = text;

      // If file, upload to coaching-files bucket
      if (file) {
        const filePath = `${enterpriseId}/${Date.now()}_${file.name}`;
        await supabase.storage.from('coaching-files').upload(filePath, file, { upsert: true });

        if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          content = await file.text() + '\n\n' + text;
        } else {
          content = `[Fichier joint : ${file.name}]\n\n${text}`;
        }
      }

      const token = await getValidAccessToken(authSession);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-coaching-note`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            raw_content: content,
            date_rdv: dateRdv || null,
            file_name: file?.name || null,
          }),
        }
      );

      if (!resp.ok) throw new Error('Erreur analyse');
      const result = await resp.json();
      setIaResult(result);
      setMode('review');
    } catch (err: any) {
      toast.error(err.message || 'Erreur analyse IA');
      setMode('write');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleInfo = (index: number, value: boolean) => {
    if (!iaResult) return;
    const updated = { ...iaResult };
    updated.infos_extraites = [...updated.infos_extraites];
    updated.infos_extraites[index] = { ...updated.infos_extraites[index], injecter: value };
    setIaResult(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const filePath = file ? `${enterpriseId}/${Date.now()}_${file.name}` : null;

      await supabase.from('coaching_notes' as any).insert({
        enterprise_id: enterpriseId,
        coach_id: user.id,
        input_type: file ? 'file' : 'text',
        raw_content: text || null,
        file_path: filePath,
        file_name: file?.name || null,
        resume_ia: iaResult?.resume || null,
        infos_extraites: iaResult?.infos_extraites || [],
        date_rdv: dateRdv || null,
        titre: iaResult?.titre || (dateRdv ? `RDV du ${dateRdv}` : 'Note'),
      } as any);

      toast.success('Note enregistrée');
      resetForm();
      loadNotes();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setMode('idle');
    setText('');
    setDateRdv('');
    setFile(null);
    setIaResult(null);
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="space-y-4">
      {/* A — Report buttons */}
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={() => setShowReport('suivi')}>
          📋 Rapport de suivi
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowReport('final')}>
          <Sparkles className="h-3.5 w-3.5 mr-1" /> Rapport final
        </Button>
      </div>

      {/* B — Note input */}
      {mode === 'idle' && (
        <div className="space-y-3">
          <div
            className="p-5 rounded-lg border-2 border-dashed border-border text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById('coaching-file-input')?.click()}
          >
            <input
              id="coaching-file-input"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            <FileUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm font-medium">Déposez un compte-rendu de RDV</p>
            <p className="text-xs text-muted-foreground mt-1">Word, PDF, ou photo de notes</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={() => setMode('write')}>
            <PenLine className="h-4 w-4 mr-2" /> Écrire une note
          </Button>
        </div>
      )}

      {mode === 'write' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            {file && (
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg border text-xs">
                <Badge variant="outline">fichier</Badge>
                <span className="flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}
            <Input type="date" value={dateRdv} onChange={e => setDateRdv(e.target.value)} placeholder="Date du RDV" />
            <Textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="Notes de RDV, observations, informations collectées..." rows={5} />
            <div className="flex gap-2">
              <Button onClick={handleAnalyze} className="flex-1" disabled={analyzing}>
                {analyzing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analyse…</> : 'Analyser'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'processing' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Analyse en cours…</p>
          </CardContent>
        </Card>
      )}

      {mode === 'review' && iaResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">IA</Badge>
              <span className="text-sm font-medium">{iaResult.titre}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{iaResult.resume}</p>

            {iaResult.infos_extraites?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Intégrer au pipeline :</p>
                {iaResult.infos_extraites.map((info, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 bg-background rounded-lg border">
                    <Switch checked={info.injecter} onCheckedChange={(v) => toggleInfo(i, v)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">{info.info}</p>
                      <Badge variant="outline" className="text-[9px] mt-1">{info.categorie}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enregistrement…</> : 'Enregistrer'}
              </Button>
              <Button variant="outline" onClick={() => setMode('write')}>Modifier</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* C — History */}
      {!loading && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Historique — {notes.length} note{notes.length !== 1 ? 's' : ''}
          </p>
          {notes.map((note: any) => (
            <Card key={note.id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] ${
                      note.date_rdv ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : note.file_name ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                    }`}>
                      {note.date_rdv ? 'RDV' : note.file_name ? 'fichier' : 'note'}
                    </Badge>
                    <span className="text-xs font-medium">{note.titre}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDate(note.created_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {note.resume_ia || note.raw_content?.substring(0, 200)}
                </p>
                {note.infos_extraites?.filter((i: any) => i.injecter)?.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mb-1">Intégré au pipeline :</p>
                    {note.infos_extraites.filter((i: any) => i.injecter).map((info: any, j: number) => (
                      <p key={j} className="text-[10px] text-indigo-600 dark:text-indigo-400">• {info.info}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {notes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucune note de coaching pour le moment
            </p>
          )}
        </div>
      )}

      {/* Modals */}
      {showReport === 'suivi' && (
        <SuiviReportModal
          enterpriseId={enterpriseId}
          enterpriseName={enterpriseName}
          onClose={() => setShowReport(null)}
        />
      )}
      {showReport === 'final' && (
        <FinalReportModal
          enterpriseId={enterpriseId}
          enterpriseName={enterpriseName}
          onClose={() => setShowReport(null)}
        />
      )}
    </div>
  );
}
