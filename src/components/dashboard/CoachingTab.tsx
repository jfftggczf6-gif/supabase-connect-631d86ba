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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      toast.error(t('coaching.add_text_or_file'));
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

      const noteTitle = iaResult?.titre || (dateRdv ? `RDV du ${dateRdv}` : 'Note');

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
        titre: noteTitle,
      } as any);

      // Log to activity_log
      await supabase.from('activity_log' as any).insert({
        enterprise_id: enterpriseId,
        actor_id: user.id,
        actor_role: 'coach',
        action: 'coaching_note',
        resource_type: 'coaching_note',
        metadata: { titre: noteTitle, date_rdv: dateRdv, has_file: !!file },
      } as any).then(() => {}).catch(() => {});

      toast.success(t('coaching.note_saved'));
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
          {t('coaching.suivi_report')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowReport('final')}>
          <Sparkles className="h-3.5 w-3.5 mr-1" /> {t('coaching.final_report')}
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
            <p className="text-sm font-medium">{t('coaching.drop_report')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('coaching.drop_hint')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t('coaching.or')}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={() => setMode('write')}>
            <PenLine className="h-4 w-4 mr-2" /> {t('coaching.write_note')}
          </Button>
        </div>
      )}

      {mode === 'write' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            {file && (
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg border text-xs">
                <Badge variant="outline">{t('coaching.file_label')}</Badge>
                <span className="flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}
            <Input type="date" value={dateRdv} onChange={e => setDateRdv(e.target.value)} placeholder={t('coaching.date_rdv')} />
            <Textarea value={text} onChange={e => setText(e.target.value)}
              placeholder={t('coaching.note_placeholder')} rows={5} />
            <div className="flex gap-2">
              <Button onClick={handleAnalyze} className="flex-1" disabled={analyzing}>
                {analyzing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t('coaching.analyzing')}</> : t('coaching.analyze')}
              </Button>
              <Button variant="outline" onClick={resetForm}>{t('common.cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'processing' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{t('coaching.analysis_processing')}</p>
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
                <p className="text-xs font-medium">{t('coaching.integrate_pipeline')}</p>
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
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t('coaching.saving_note')}</> : t('coaching.save_note')}
              </Button>
              <Button variant="outline" onClick={() => setMode('write')}>{t('coaching.modify')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* C — History */}
      {!loading && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t('coaching.history')} — {notes.length} note{notes.length !== 1 ? 's' : ''}
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
                      {note.date_rdv ? t('coaching.rdv_label') : note.file_name ? t('coaching.file_label') : t('coaching.note_label')}
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
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mb-1">{t('coaching.integrated_pipeline')}</p>
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
              {t('coaching.no_notes')}
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
