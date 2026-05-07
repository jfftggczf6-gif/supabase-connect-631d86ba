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
import { Loader2, FileUp, PenLine, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { parseFile } from '@/lib/document-parser';

interface Props {
  dealId: string;
  organizationId: string;
}

type NoteMode = 'idle' | 'write' | 'processing' | 'review';

interface Correction {
  info: string;
  type: string;
  section_code: string;
  field_path: string;
  action: 'remplacer' | 'enrichir';
  value: any;
  priorite: 'haute' | 'moyenne' | 'basse';
  applied?: boolean;
}

interface IAResult {
  titre: string;
  resume: string;
  corrections?: Correction[];
  contexte?: string[];
  actions_analyste?: string[];
  infos_extraites?: { info: string; categorie: string; injecter: boolean }[];
}

const SECTION_LABELS: Record<string, string> = {
  executive_summary: 'Résumé exécutif',
  shareholding_governance: 'Actionnariat & gouvernance',
  top_management: 'Top management',
  services: 'Services',
  competition_market: 'Concurrence & marché',
  unit_economics: 'Units economics',
  financials_pnl: 'États financiers PnL',
  financials_balance: 'États financiers Bilan',
  investment_thesis: "Thèse d'investissement",
  support_requested: 'Accompagnement demandé',
  esg_risks: 'ESG / Risques',
  annexes: 'Annexes',
};

// Pose une valeur dans un objet en suivant un chemin "a.b.0.c" (les indices d'array sont numériques).
function setByPath(obj: any, path: string, value: any, action: 'remplacer' | 'enrichir') {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);
    if (cur[key] == null) cur[key] = nextIsIndex ? [] : {};
    cur = cur[key];
  }
  const last = parts[parts.length - 1];
  if (action === 'enrichir' && typeof cur[last] === 'string') {
    cur[last] = cur[last] + '\n' + String(value);
  } else {
    cur[last] = value;
  }
}

export default function PeDealNotesView({ dealId, organizationId }: Props) {
  const { session: authSession } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [mode, setMode] = useState<NoteMode>('idle');
  const [text, setText] = useState('');
  const [dateRdv, setDateRdv] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [iaResult, setIaResult] = useState<IAResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);

  const loadNotes = async () => {
    const { data: rawNotes } = await supabase
      .from('pe_deal_notes' as any)
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    const notesArr = (rawNotes as any[]) || [];
    // Hydrate noms d'auteurs via une query séparée (pas de FK directe profiles ↔ auth.users)
    const authorIds = Array.from(new Set(notesArr.map((n) => n.author_id).filter(Boolean)));
    let profMap = new Map<string, { full_name: string | null }>();
    if (authorIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', authorIds);
      profMap = new Map((profs || []).map((p: any) => [p.user_id, { full_name: p.full_name }]));
    }
    setNotes(notesArr.map((n) => ({ ...n, profiles: profMap.get(n.author_id) ?? null })));
    setLoading(false);
  };

  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    setUserRole((data as any)?.role ?? null);
  };

  useEffect(() => { loadNotes(); loadUserRole(); }, [dealId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setMode('write'); }
  };

  const handleAnalyze = async () => {
    if (!text.trim() && !file) {
      toast.error('Ajoute du texte ou un fichier');
      return;
    }
    setMode('processing');
    setAnalyzing(true);

    try {
      let content = text;
      if (file) {
        const filePath = `notes/${dealId}/${Date.now()}_${file.name}`;
        await supabase.storage.from('pe_deal_docs').upload(filePath, file, { upsert: true });
        if (file.type.includes('text') || /\.(txt|md)$/i.test(file.name)) {
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pe-deal-note`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            raw_content: content,
            date_rdv: dateRdv || null,
            file_name: file?.name || null,
            deal_id: dealId,
          }),
        },
      );
      if (!resp.ok) throw new Error('Erreur analyse');
      const result = await resp.json();
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
    if (!iaResult?.infos_extraites) return;
    const updated = { ...iaResult };
    updated.infos_extraites = [...updated.infos_extraites!];
    updated.infos_extraites[index] = { ...updated.infos_extraites[index], injecter: value };
    setIaResult(updated);
  };

  const applyCorrection = async (corr: Correction, index: number) => {
    try {
      // Récupère le memo + sa dernière version + la section ciblée
      const { data: memo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (!memo) {
        toast.error('Memo introuvable — génère le pré-screening ou le memo d\'abord');
        return;
      }
      const { data: vers } = await supabase
        .from('memo_versions')
        .select('id')
        .eq('memo_id', memo.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const versionId = vers?.[0]?.id;
      if (!versionId) {
        toast.error('Aucune version de memo trouvée');
        return;
      }
      const { data: section } = await supabase
        .from('memo_sections')
        .select('id, content_json')
        .eq('version_id', versionId)
        .eq('section_code', corr.section_code as any)
        .maybeSingle();
      if (!section) {
        toast.error(`Section "${SECTION_LABELS[corr.section_code] || corr.section_code}" introuvable`);
        return;
      }
      const newJson = { ...((section as any).content_json ?? {}) };
      setByPath(newJson, corr.field_path, corr.value, corr.action);
      await supabase
        .from('memo_sections')
        .update({ content_json: newJson })
        .eq('id', (section as any).id);

      if (iaResult) {
        const updated = { ...iaResult };
        updated.corrections = [...(updated.corrections || [])];
        updated.corrections[index] = { ...updated.corrections[index], applied: true };
        setIaResult(updated);
      }
      toast.success(`${corr.info} — appliqué`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const applyAllCorrections = async () => {
    if (!iaResult?.corrections?.length) return;
    setApplyingAll(true);
    const toApply = iaResult.corrections.filter((c) => !c.applied && c.priorite !== 'basse');
    for (let i = 0; i < iaResult.corrections.length; i++) {
      const c = iaResult.corrections[i];
      if (!c.applied && c.priorite !== 'basse') {
        // eslint-disable-next-line no-await-in-loop
        await applyCorrection(c, i);
      }
    }
    setApplyingAll(false);
    toast.success(`${toApply.length} correction(s) appliquée(s)`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const filePath = file ? `notes/${dealId}/${Date.now()}_${file.name}` : null;
      const noteTitle = iaResult?.titre || (dateRdv ? `RDV du ${dateRdv}` : 'Note');

      await supabase.from('pe_deal_notes' as any).insert({
        deal_id: dealId,
        organization_id: organizationId,
        author_id: user.id,
        author_role: userRole,
        input_type: file ? 'file' : 'text',
        raw_content: text || null,
        file_path: filePath,
        file_name: file?.name || null,
        resume_ia: iaResult?.resume || null,
        infos_extraites: iaResult?.infos_extraites || [],
        corrections_applied: iaResult?.corrections?.filter((c) => c.applied).map((c) => ({
          info: c.info, section_code: c.section_code, field_path: c.field_path, value: c.value,
        })) || [],
        date_rdv: dateRdv || null,
        titre: noteTitle,
      });

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

  const roleBadge = (role: string | null) => {
    if (!role) return null;
    const map: Record<string, { label: string; cls: string }> = {
      analyst: { label: 'Analyste', cls: 'bg-violet-50 text-violet-700' },
      investment_manager: { label: 'IM', cls: 'bg-indigo-50 text-indigo-700' },
      managing_director: { label: 'MD', cls: 'bg-emerald-50 text-emerald-700' },
      owner: { label: 'Owner', cls: 'bg-emerald-50 text-emerald-700' },
    };
    const m = map[role] ?? { label: role, cls: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={`text-[9px] ${m.cls}`}>{m.label}</Badge>;
  };

  const appliedCount = iaResult?.corrections?.filter((c) => c.applied).length || 0;
  const totalCorrections = iaResult?.corrections?.length || 0;

  return (
    <div>
      <h2 className="font-display font-bold text-lg mb-1">Notes analyste</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Notes de réunion, comptes-rendus de RDV et informations contextuelles utilisées pour
        enrichir le pré-screening et le memo d'investissement.
      </p>

      <div className="space-y-4">
        {/* Idle : drop + write */}
        {mode === 'idle' && (
          <div className="space-y-3">
            <div
              className="p-5 rounded-lg border-2 border-dashed border-border text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById('pe-note-file-input')?.click()}
            >
              <input
                id="pe-note-file-input"
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

        {/* Write */}
        {mode === 'write' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 space-y-3">
              {file && (
                <div className="flex items-center gap-2 p-2 bg-background rounded-lg border text-xs">
                  <Badge variant="outline">Fichier</Badge>
                  <span className="flex-1 truncate">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
              )}
              <Input type="date" value={dateRdv} onChange={(e) => setDateRdv(e.target.value)} placeholder="Date du RDV" />
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tape ta note de RDV / debrief / point analyste…"
                rows={5}
              />
              <div className="flex gap-2">
                <Button onClick={handleAnalyze} className="flex-1" disabled={analyzing}>
                  {analyzing
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analyse en cours…</>
                    : 'Analyser avec l\'IA'}
                </Button>
                <Button variant="outline" onClick={resetForm}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing */}
        {mode === 'processing' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-8 text-center">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">L'IA analyse la note…</p>
            </CardContent>
          </Card>
        )}

        {/* Review */}
        {mode === 'review' && iaResult && (
          <div className="space-y-3">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-100 text-indigo-700">IA</Badge>
                  <span className="text-sm font-medium">{iaResult.titre}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{iaResult.resume}</p>
              </CardContent>
            </Card>

            {iaResult.corrections && iaResult.corrections.length > 0 && (
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Corrections à appliquer ({appliedCount}/{totalCorrections})
                    </h4>
                    {totalCorrections > 1 && appliedCount < totalCorrections && (
                      <Button size="sm" variant="outline" onClick={applyAllCorrections} disabled={applyingAll} className="text-xs">
                        {applyingAll ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Tout appliquer
                      </Button>
                    )}
                  </div>
                  {iaResult.corrections.map((corr, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                      corr.applied ? 'bg-emerald-50 border-emerald-200'
                        : corr.priorite === 'haute' ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {corr.applied
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <AlertTriangle className={`h-4 w-4 shrink-0 ${corr.priorite === 'haute' ? 'text-red-500' : 'text-amber-500'}`} />
                          }
                          <span className="text-sm font-medium">{corr.info}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          → {SECTION_LABELS[corr.section_code] || corr.section_code} &gt; {corr.field_path.replace(/\./g, ' › ')}
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

            {iaResult.actions_analyste && iaResult.actions_analyste.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Actions analyste</p>
                  <ul className="text-xs space-y-0.5">
                    {iaResult.actions_analyste.map((a, i) => <li key={i}>☐ {a}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {iaResult.infos_extraites && iaResult.infos_extraites.length > 0 && !iaResult.corrections?.length && (
              <Card>
                <CardContent className="py-3 space-y-2">
                  <p className="text-xs font-medium">Infos à intégrer dans la prochaine génération</p>
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

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enregistrement…</> : 'Enregistrer la note'}
              </Button>
              <Button variant="outline" onClick={() => setMode('write')}>Modifier</Button>
            </div>
          </div>
        )}

        {/* History */}
        {!loading && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground">
              Historique — {notes.length} note{notes.length !== 1 ? 's' : ''}
            </p>
            {notes.map((note: any) => (
              <Card key={note.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] ${
                        note.date_rdv ? 'bg-emerald-50 text-emerald-700'
                          : note.file_name ? 'bg-violet-50 text-violet-700'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {note.date_rdv ? 'RDV' : note.file_name ? 'Fichier' : 'Note'}
                      </Badge>
                      <span className="text-xs font-medium">{note.titre}</span>
                      {roleBadge(note.author_role)}
                      {note.profiles?.full_name && (
                        <span className="text-[10px] text-muted-foreground">par {note.profiles.full_name}</span>
                      )}
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
                  {note.corrections_applied?.length > 0 && (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      <p className="text-[10px] text-emerald-700 font-medium">Corrections appliquées :</p>
                      {note.corrections_applied.map((c: any, j: number) => (
                        <div key={j} className="text-[10px] flex items-start gap-1.5 p-1.5 rounded bg-emerald-50">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium">{SECTION_LABELS[c.section_code] || c.section_code}</span>
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
              <p className="text-xs text-muted-foreground text-center py-4">Aucune note pour le moment.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
