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
import { Loader2, FileUp, PenLine, Sparkles, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { parseFile } from '@/lib/document-parser';
import SuiviReportModal from './SuiviReportModal';
import FinalReportModal from './FinalReportModal';

interface CoachingTabProps {
  enterpriseId: string;
  enterpriseName: string;
  viewMode?: 'full' | 'notes_only' | 'reports_only';
}

type NoteMode = 'idle' | 'write' | 'processing' | 'review';

interface Correction {
  info: string;
  type: string;
  deliverable: string;
  field_path: string;
  action: string;
  value: any;
  priorite: string;
  applied?: boolean;
}

interface IAResult {
  titre: string;
  resume: string;
  corrections?: Correction[];
  contexte?: string[];
  actions_coach?: string[];
  infos_extraites: { info: string; categorie: string; injecter: boolean }[];
}

const DELIVERABLE_LABELS: Record<string, string> = {
  inputs_data: "Données Financières",
  bmc_analysis: "Business Model Canvas",
  sic_analysis: "Social Impact Canvas",
  plan_financier: "Plan Financier",
  business_plan: "Business Plan",
  odd_analysis: "ODD",
  diagnostic_data: "Diagnostic",
  valuation: "Valorisation",
  onepager: "One-Pager",
  investment_memo: "Mémo Investissement",
};

export default function CoachingTab({ enterpriseId, enterpriseName, viewMode = 'full' }: CoachingTabProps) {
  const { t } = useTranslation();
  const { session: authSession } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState<'suivi' | 'final' | null>(null);

  const [mode, setMode] = useState<NoteMode>('idle');
  const [text, setText] = useState('');
  const [dateRdv, setDateRdv] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [iaResult, setIaResult] = useState<IAResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingCorrections, setApplyingCorrections] = useState(false);

  const [directCorrections, setDirectCorrections] = useState<any[]>([]);

  const loadNotes = async () => {
    const [{ data: notesData }, { data: corr }] = await Promise.all([
      supabase.from('coaching_notes' as any).select('*').eq('enterprise_id', enterpriseId).order('created_at', { ascending: false }),
      supabase.from('deliverable_corrections').select('*, profiles:corrected_by(full_name)').eq('enterprise_id', enterpriseId).order('created_at', { ascending: false }).limit(50),
    ]);
    setNotes((notesData as any[]) || []);
    setDirectCorrections((corr as any[]) || []);
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
      if (file) {
        const filePath = `${enterpriseId}/${Date.now()}_${file.name}`;
        await supabase.storage.from('coaching-files').upload(filePath, file, { upsert: true });
        if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          const txt = await file.text();
          content = text ? `${txt}\n\n═══ Notes additionnelles ═══\n${text}` : txt;
        } else {
          const parsed = await parseFile(file);
          if (parsed.content && parsed.quality !== 'failed') {
            const header = `[Fichier : ${file.name} — ${parsed.summary || parsed.method}]`;
            const extra = text ? `\n\n═══ Notes additionnelles ═══\n${text}` : '';
            content = `${header}\n\n${parsed.content}${extra}`;
          } else {
            toast.error(`Extraction impossible : ${parsed.summary || 'fichier illisible'}`);
            content = `[Fichier joint (extraction échouée) : ${file.name}]\n\n${text}`;
          }
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
            enterprise_id: enterpriseId,
          }),
        }
      );

      if (!resp.ok) throw new Error('Erreur analyse');
      const result = await resp.json();
      // Mark all corrections as not applied
      if (result.corrections) {
        result.corrections = result.corrections.map((c: Correction) => ({ ...c, applied: false }));
      }
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

  const applyCorrection = async (correction: Correction, index: number) => {
    try {
      // Fetch the deliverable
      const { data: deliv } = await supabase
        .from('deliverables')
        .select('id, data')
        .eq('enterprise_id', enterpriseId)
        .eq('type', correction.deliverable)
        .maybeSingle();

      if (!deliv?.data) {
        toast.error(`Livrable "${DELIVERABLE_LABELS[correction.deliverable] || correction.deliverable}" non trouvé`);
        return;
      }

      const newData = { ...(deliv.data as any) };

      // Navigate to the field path and set the value
      const parts = correction.field_path.split('.');
      let obj = newData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      const lastKey = parts[parts.length - 1];

      if (correction.action === 'enrichir' && typeof obj[lastKey] === 'string') {
        obj[lastKey] = obj[lastKey] + '\n' + String(correction.value);
      } else {
        obj[lastKey] = correction.value;
      }

      // Save
      await supabase.from('deliverables').update({ data: newData }).eq('id', deliv.id);

      // Bump data_changed_at to trigger pipeline staleness
      await supabase.from('enterprises').update({
        data_changed_at: new Date().toISOString(),
      }).eq('id', enterpriseId);

      // Log correction
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('deliverable_corrections').insert({
          enterprise_id: enterpriseId,
          deliverable_id: deliv.id,
          deliverable_type: correction.deliverable,
          field_path: correction.field_path,
          corrected_value: correction.value,
          correction_reason: correction.info,
          corrected_by: user?.id,
        });
      } catch { /* non-blocking */ }

      // Mark as applied
      if (iaResult) {
        const updated = { ...iaResult };
        updated.corrections = [...(updated.corrections || [])];
        updated.corrections[index] = { ...updated.corrections[index], applied: true };
        setIaResult(updated);
      }

      toast.success(`${correction.info} — appliqué`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const applyAllCorrections = async () => {
    if (!iaResult?.corrections?.length) return;
    setApplyingCorrections(true);
    const toApply = iaResult.corrections.filter(c => !c.applied && c.priorite !== 'basse');
    for (let i = 0; i < iaResult.corrections.length; i++) {
      const c = iaResult.corrections[i];
      if (!c.applied && c.priorite !== 'basse') {
        await applyCorrection(c, i);
      }
    }
    setApplyingCorrections(false);
    toast.success(`${toApply.length} correction(s) appliquée(s)`);
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
        corrections_applied: iaResult?.corrections?.filter(c => c.applied).map(c => ({
          info: c.info, deliverable: c.deliverable, field_path: c.field_path, value: c.value,
        })) || [],
        date_rdv: dateRdv || null,
        titre: noteTitle,
      } as any);

      await supabase.from('activity_log' as any).insert({
        enterprise_id: enterpriseId,
        actor_id: user.id,
        actor_role: 'coach',
        action: 'coaching_note',
        resource_type: 'coaching_note',
        metadata: {
          titre: noteTitle,
          date_rdv: dateRdv,
          has_file: !!file,
          corrections_count: iaResult?.corrections?.filter(c => c.applied).length || 0,
        },
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

  const appliedCount = iaResult?.corrections?.filter(c => c.applied).length || 0;
  const totalCorrections = iaResult?.corrections?.length || 0;

  return (
    <div className="space-y-4">
      {/* Report buttons — hidden in notes_only mode */}
      {viewMode !== 'notes_only' && (
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={() => setShowReport('suivi')}>
            {t('coaching.suivi_report')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowReport('final')}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> {t('coaching.final_report')}
          </Button>
        </div>
      )}

      {/* Note input — idle (hidden in reports_only mode) */}
      {viewMode !== 'reports_only' && mode === 'idle' && (
        <div className="space-y-3">
          <div
            className="p-5 rounded-lg border-2 border-dashed border-border text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById('coaching-file-input')?.click()}
          >
            <input id="coaching-file-input" type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" onChange={handleFileChange} />
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

      {/* Note input — write */}
      {viewMode !== 'reports_only' && mode === 'write' && (
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
            <Textarea value={text} onChange={e => setText(e.target.value)} placeholder={t('coaching.note_placeholder')} rows={5} />
            <div className="flex gap-2">
              <Button onClick={handleAnalyze} className="flex-1" disabled={analyzing}>
                {analyzing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t('coaching.analyzing')}</> : t('coaching.analyze')}
              </Button>
              <Button variant="outline" onClick={resetForm}>{t('common.cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing */}
      {viewMode !== 'reports_only' && mode === 'processing' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{t('coaching.analysis_processing')}</p>
          </CardContent>
        </Card>
      )}

      {/* Review — enriched with corrections */}
      {viewMode !== 'reports_only' && mode === 'review' && iaResult && (
        <div className="space-y-3">
          {/* Title + Resume */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-100 text-indigo-700">IA</Badge>
                <span className="text-sm font-medium">{iaResult.titre}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{iaResult.resume}</p>
            </CardContent>
          </Card>

          {/* Corrections */}
          {iaResult.corrections && iaResult.corrections.length > 0 && (
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Corrections à appliquer ({appliedCount}/{totalCorrections})
                  </h4>
                  {totalCorrections > 1 && appliedCount < totalCorrections && (
                    <Button size="sm" variant="outline" onClick={applyAllCorrections} disabled={applyingCorrections} className="text-xs">
                      {applyingCorrections ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Tout appliquer
                    </Button>
                  )}
                </div>
                {iaResult.corrections.map((corr, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                    corr.applied ? 'bg-emerald-50 border-emerald-200' :
                    corr.priorite === 'haute' ? 'bg-red-50 border-red-200' :
                    'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {corr.applied ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className={`h-4 w-4 shrink-0 ${corr.priorite === 'haute' ? 'text-red-500' : 'text-amber-500'}`} />
                        )}
                        <span className="text-sm font-medium">{corr.info}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        → {DELIVERABLE_LABELS[corr.deliverable] || corr.deliverable} &gt; {corr.field_path.replace(/\./g, ' > ')}
                      </p>
                      {corr.value != null && (
                        <p className="text-xs font-mono mt-0.5 text-muted-foreground">
                          = {typeof corr.value === 'number' ? corr.value.toLocaleString('fr-FR') : String(corr.value).substring(0, 100)}
                        </p>
                      )}
                    </div>
                    {!corr.applied && (
                      <Button size="sm" variant="outline" className="shrink-0 text-xs h-7" onClick={() => applyCorrection(corr, i)}>
                        Appliquer
                      </Button>
                    )}
                    {corr.applied && (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px] shrink-0">Appliqué</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Contexte */}
          {iaResult.contexte && iaResult.contexte.length > 0 && (
            <Card>
              <CardContent className="py-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Contexte</p>
                <ul className="text-xs space-y-0.5">
                  {iaResult.contexte.map((c, i) => <li key={i} className="text-muted-foreground">• {c}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions coach */}
          {iaResult.actions_coach && iaResult.actions_coach.length > 0 && (
            <Card>
              <CardContent className="py-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Actions coach</p>
                <ul className="text-xs space-y-0.5">
                  {iaResult.actions_coach.map((a, i) => <li key={i}>☐ {a}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Legacy infos_extraites (backward compat) */}
          {iaResult.infos_extraites?.length > 0 && !iaResult.corrections?.length && (
            <Card>
              <CardContent className="py-3 space-y-2">
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
              </CardContent>
            </Card>
          )}

          {/* Save button */}
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t('coaching.saving_note')}</> : t('coaching.save_note')}
            </Button>
            <Button variant="outline" onClick={() => setMode('write')}>{t('coaching.modify')}</Button>
          </div>
        </div>
      )}

      {/* History — hidden in reports_only mode */}
      {viewMode !== 'reports_only' && !loading && (
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
                      note.date_rdv ? 'bg-emerald-50 text-emerald-700' : note.file_name ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {note.date_rdv ? t('coaching.rdv_label') : note.file_name ? t('coaching.file_label') : t('coaching.note_label')}
                    </Badge>
                    <span className="text-xs font-medium">{note.titre}</span>
                    {note.corrections_applied?.length > 0 && (
                      <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300">
                        {note.corrections_applied.length} correction(s)
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(note.created_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {note.resume_ia || note.raw_content?.substring(0, 200)}
                </p>
                {note.infos_extraites?.filter((i: any) => i.injecter)?.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[10px] text-indigo-600 font-medium mb-1">{t('coaching.integrated_pipeline')}</p>
                    {note.infos_extraites.filter((i: any) => i.injecter).map((info: any, j: number) => (
                      <p key={j} className="text-[10px] text-indigo-600">• {info.info}</p>
                    ))}
                  </div>
                )}
                {note.corrections_applied?.length > 0 && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    <p className="text-[10px] text-emerald-700 font-medium">Corrections appliquées :</p>
                    {note.corrections_applied.map((c: any, j: number) => (
                      <div key={j} className="text-[10px] flex items-start gap-1.5 p-1.5 rounded bg-emerald-50">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium">{DELIVERABLE_LABELS[c.deliverable] || c.deliverable}</span>
                          <span className="text-muted-foreground"> &gt; {c.field_path}</span>
                          <p className="text-muted-foreground">{c.info}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {notes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">{t('coaching.no_notes')}</p>
          )}

          {/* Modifications directes (bouton ✨, édition section) */}
          {directCorrections.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Modifications directes — {directCorrections.length} modification(s)
              </p>
              <div className="space-y-1.5">
                {directCorrections.map((c: any) => (
                  <div key={c.id} className="flex items-start gap-2 p-2 rounded border text-[10px]">
                    <Sparkles className="h-3 w-3 text-indigo-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">{DELIVERABLE_LABELS[c.deliverable_type] || c.deliverable_type}</Badge>
                        <span className="text-muted-foreground">{c.field_path}</span>
                        <span className="text-muted-foreground ml-auto whitespace-nowrap">{formatDate(c.created_at)}</span>
                      </div>
                      {c.correction_reason && <p className="text-muted-foreground mt-0.5">{c.correction_reason}</p>}
                      {c.original_value && c.corrected_value && (
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <div className="p-1 rounded bg-red-50 truncate"><span className="text-red-600">Avant :</span> {typeof c.original_value === 'string' ? c.original_value.substring(0, 80) : JSON.stringify(c.original_value).substring(0, 80)}</div>
                          <div className="p-1 rounded bg-emerald-50 truncate"><span className="text-emerald-600">Après :</span> {typeof c.corrected_value === 'string' ? c.corrected_value.substring(0, 80) : JSON.stringify(c.corrected_value).substring(0, 80)}</div>
                        </div>
                      )}
                      {c.profiles?.full_name && <span className="text-muted-foreground">par {c.profiles.full_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showReport === 'suivi' && <SuiviReportModal enterpriseId={enterpriseId} enterpriseName={enterpriseName} onClose={() => setShowReport(null)} />}
      {showReport === 'final' && <FinalReportModal enterpriseId={enterpriseId} enterpriseName={enterpriseName} onClose={() => setShowReport(null)} />}
    </div>
  );
}
