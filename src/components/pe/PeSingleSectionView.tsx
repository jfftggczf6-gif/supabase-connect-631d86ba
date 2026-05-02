import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Edit3, RefreshCw, Save, X, History as HistoryIcon, Send, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import {
  canEdit, canRegenerate, canSubmit, canValidate, canRequestRevision, canResetToDraft,
  getRoleSnapshot, STATUS_LABELS, STATUS_COLORS, type SectionStatus,
} from '@/lib/pe-section-validation';
import * as Sections from './sections';

const SECTION_RENDERERS: Record<string, React.ComponentType<{ section: any; allSections?: Record<string, any> }>> = {
  executive_summary:        Sections.ExecutiveSummarySection,
  shareholding_governance:  Sections.ShareholdingGovernanceSection,
  top_management:           Sections.TopManagementSection,
  services:                 Sections.ServicesSection,
  competition_market:       Sections.CompetitionMarketSection,
  unit_economics:           Sections.UnitEconomicsSection,
  financials_pnl:           Sections.FinancialsPnlSection,
  financials_balance:       Sections.FinancialsBalanceSection,
  investment_thesis:        Sections.InvestmentThesisSection,
  support_requested:        Sections.SupportRequestedSection,
  esg_risks:                Sections.EsgRisksSection,
  annexes:                  Sections.AnnexesSection,
};

const SECTION_LABELS: Record<string, string> = {
  executive_summary:        'Résumé exécutif',
  shareholding_governance:  'Actionnariat & gouvernance',
  top_management:           'Top management',
  services:                 'Services',
  competition_market:       'Concurrence & marché',
  unit_economics:           'Units economics',
  financials_pnl:           'États financiers PnL',
  financials_balance:       'États financiers Bilan',
  investment_thesis:        "Thèse d'investissement",
  support_requested:        'Accompagnement demandé',
  esg_risks:                'ESG / Risques',
  annexes:                  'Annexes',
};

interface Props {
  dealId: string;
  stage: 'pre_screening' | 'note_ic1' | 'note_ic_finale';
  sectionCode: string;
}

const formatRelativeTime = (iso: string | null): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

interface ValidationLogEntry {
  id: string;
  action: string;
  from_status: SectionStatus | null;
  to_status: SectionStatus;
  actor_id: string;
  actor_role: string | null;
  comment: string | null;
  created_at: string;
  actor_name?: string;
}

const StatusBadge = ({ status }: { status: SectionStatus }) => {
  const c = STATUS_COLORS[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: c.bg, color: c.color }}>
      {status === 'pending_validation' && <Send className="h-3 w-3" />}
      {status === 'validated' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'needs_revision' && <AlertCircle className="h-3 w-3" />}
      {STATUS_LABELS[status]}
    </span>
  );
};

const ACTION_LABELS: Record<string, string> = {
  submit:           '→ soumis à validation',
  validate:         '✓ validée',
  request_revision: '↩ révision demandée',
  reset_to_draft:   '↻ remise en brouillon',
};

export default function PeSingleSectionView({ dealId, stage, sectionCode }: Props) {
  const { user } = useAuth();
  const { role, isSuperAdmin } = useCurrentRole();
  const roleCtx = { role, isSuperAdmin };

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<any>(null);
  const [allSections, setAllSections] = useState<Record<string, any>>({});
  const [versionMeta, setVersionMeta] = useState<{ status: string; label: string } | null>(null);
  const [editorName, setEditorName] = useState<string | null>(null);
  const [validationLog, setValidationLog] = useState<ValidationLogEntry[]>([]);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [draftMd, setDraftMd] = useState('');
  const [saving, setSaving] = useState(false);

  // Regenerate
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Validation actions
  const [actionDialog, setActionDialog] = useState<null | 'submit' | 'validate' | 'request_revision' | 'reset_to_draft'>(null);
  const [actionComment, setActionComment] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const loadSection = async () => {
    setLoading(true);
    const { data: memo } = await supabase
      .from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle();
    if (!memo) { setLoading(false); return; }

    const { data: vers } = await supabase
      .from('memo_versions')
      .select('id, status, label')
      .eq('memo_id', memo.id)
      .eq('stage', stage)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1);
    const v = vers?.[0];
    if (!v) { setLoading(false); return; }
    setVersionMeta({ status: v.status, label: v.label });

    const { data: secs } = await supabase
      .from('memo_sections')
      .select('*')
      .eq('version_id', v.id);
    const map: Record<string, any> = {};
    (secs ?? []).forEach((s: any) => { map[s.section_code] = s; });
    const target = map[sectionCode] ?? null;
    setAllSections(map);
    setSection(target);

    if (target?.last_edited_by) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name, email').eq('user_id', target.last_edited_by).maybeSingle();
      setEditorName(prof?.full_name || prof?.email || null);
    } else {
      setEditorName(null);
    }

    // Load validation log
    if (target?.id) {
      const { data: logs } = await supabase
        .from('memo_section_validations')
        .select('*')
        .eq('section_id', target.id)
        .order('created_at', { ascending: false })
        .limit(10);
      const actorIds = [...new Set((logs ?? []).map((l: any) => l.actor_id))];
      let nameMap: Record<string, string> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from('profiles').select('user_id, full_name, email').in('user_id', actorIds);
        (profs ?? []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || p.email; });
      }
      setValidationLog((logs ?? []).map((l: any) => ({ ...l, actor_name: nameMap[l.actor_id] })));
    }

    setLoading(false);
  };

  useEffect(() => { loadSection(); }, [dealId, stage, sectionCode]);

  // ─── Edit mode ───────────────────────────────────────────────────────────
  const handleEdit = () => {
    setDraftMd(section?.content_md ?? '');
    setEditing(true);
  };
  const handleCancelEdit = () => { setEditing(false); setDraftMd(''); };
  const handleSave = async () => {
    if (!section) return;
    setSaving(true);
    const { error } = await supabase
      .from('memo_sections')
      .update({
        content_md: draftMd,
        last_edited_by: user?.id,
        last_edited_at: new Date().toISOString(),
        // Si la section était validated/needs_revision, l'édition manuelle la repasse en draft
        ...(section.status === 'validated' || section.status === 'needs_revision'
          ? { status: 'draft' as SectionStatus }
          : {}),
      })
      .eq('id', section.id);
    setSaving(false);
    if (error) { toast.error(`Échec sauvegarde : ${error.message}`); return; }
    toast.success('Section mise à jour');
    setEditing(false);
    await loadSection();
  };

  // ─── Regenerate ──────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    setRegenOpen(false);
    setRegenerating(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-pe-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deal_id: dealId, section_code: sectionCode }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Échec régénération');
      toast.success(`Section "${SECTION_LABELS[sectionCode]}" régénérée par l'IA`);
      await loadSection();
    } catch (e: any) {
      toast.error(`Régénération échouée : ${e.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  // ─── Validation actions ──────────────────────────────────────────────────
  const performAction = async (action: 'submit' | 'validate' | 'request_revision' | 'reset_to_draft', comment: string) => {
    if (!section || !user) return;
    setActionSubmitting(true);
    try {
      const transitions: Record<string, SectionStatus> = {
        submit:            'pending_validation',
        validate:          'validated',
        request_revision:  'needs_revision',
        reset_to_draft:    'draft',
      };
      const newStatus = transitions[action];
      const fromStatus = section.status as SectionStatus;

      const { error: updErr } = await supabase
        .from('memo_sections')
        .update({ status: newStatus })
        .eq('id', section.id);
      if (updErr) throw new Error(`UPDATE failed: ${updErr.message}`);

      const { error: logErr } = await supabase
        .from('memo_section_validations')
        .insert({
          section_id: section.id,
          action,
          from_status: fromStatus,
          to_status: newStatus,
          actor_id: user.id,
          actor_role: getRoleSnapshot(roleCtx),
          comment: comment.trim() || null,
        });
      if (logErr) throw new Error(`Log insert failed: ${logErr.message}`);

      const messages: Record<string, string> = {
        submit:           'Section soumise à validation',
        validate:         'Section validée',
        request_revision: 'Révision demandée',
        reset_to_draft:   'Section remise en brouillon',
      };
      toast.success(messages[action]);
      setActionDialog(null);
      setActionComment('');
      await loadSection();
    } catch (e: any) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setActionSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Chargement...</div>;
  }
  if (!section) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Cette section n'a pas encore été générée.
        {!versionMeta && <p className="mt-2">Drop des pièces sur la Data Room du deal puis pousse en pré-screening pour générer le dossier.</p>}
      </div>
    );
  }

  const Renderer = SECTION_RENDERERS[sectionCode];
  if (!Renderer) return <div className="p-8 text-muted-foreground">Section inconnue : {sectionCode}</div>;

  const sectionStatus: SectionStatus = (section.status as SectionStatus) ?? 'draft';
  const allowEdit = canEdit(roleCtx, sectionStatus);
  const allowRegen = canRegenerate(roleCtx, sectionStatus);
  const allowSubmit = canSubmit(roleCtx, sectionStatus);
  const allowValidate = canValidate(roleCtx, sectionStatus);
  const allowRequestRevision = canRequestRevision(roleCtx, sectionStatus);
  const allowResetToDraft = canResetToDraft(roleCtx, sectionStatus);

  const actionDialogConfig = {
    submit:           { title: 'Soumettre à validation ?', desc: 'La section passera en statut "À valider". Un IM ou MD pourra valider ou demander une révision.', commentRequired: false, btn: 'Soumettre' },
    validate:         { title: 'Valider la section ?', desc: 'Cette section sera marquée comme validée. L\'analyste pourra encore l\'éditer (la section reviendra en brouillon).', commentRequired: false, btn: 'Valider' },
    request_revision: { title: 'Demander une révision', desc: 'La section retournera à l\'analyste avec ton commentaire. Le commentaire est obligatoire.', commentRequired: true, btn: 'Demander révision' },
    reset_to_draft:   { title: 'Remettre en brouillon ?', desc: 'La section validée repassera en brouillon. Cette action est annulable.', commentRequired: false, btn: 'Remettre en brouillon' },
  };

  return (
    <div className="space-y-3">
      {/* Header avec status + actions */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0 gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span>{SECTION_LABELS[sectionCode]}</span>
              <StatusBadge status={sectionStatus} />
            </CardTitle>
            {versionMeta && <p className="text-xs text-muted-foreground mt-0.5">Version : <strong>{versionMeta.label}</strong></p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!editing && (
              <>
                {allowEdit && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEdit}>
                    <Edit3 className="h-3.5 w-3.5" /> Éditer
                  </Button>
                )}
                {allowRegen && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRegenOpen(true)} disabled={regenerating}>
                    {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Régénérer
                  </Button>
                )}
                {allowSubmit && (
                  <Button size="sm" className="gap-1.5" onClick={() => setActionDialog('submit')}>
                    <Send className="h-3.5 w-3.5" /> Soumettre
                  </Button>
                )}
                {allowValidate && (
                  <Button size="sm" className="gap-1.5 bg-[var(--pe-ok)] hover:bg-[var(--pe-ok)]/90" onClick={() => setActionDialog('validate')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valider
                  </Button>
                )}
                {allowRequestRevision && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActionDialog('request_revision')} style={{ borderColor: 'var(--pe-warning)', color: 'var(--pe-warning)' }}>
                    <AlertCircle className="h-3.5 w-3.5" /> Demander révision
                  </Button>
                )}
                {allowResetToDraft && (
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setActionDialog('reset_to_draft')}>
                    <RotateCcw className="h-3.5 w-3.5" /> Brouillon
                  </Button>
                )}
              </>
            )}
            {editing && (
              <>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleCancelEdit}><X className="h-3.5 w-3.5" /> Annuler</Button>
                <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Enregistrer
                </Button>
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Mode édition */}
      {editing && (
        <Card>
          <CardContent className="p-4">
            <Textarea value={draftMd} onChange={(e) => setDraftMd(e.target.value)} rows={20} className="font-mono text-sm" placeholder="Markdown..." />
            <p className="text-[10px] text-muted-foreground mt-2">Markdown : **gras**, *italique*, listes, tableaux. Préserve les [Source: pitch.pdf p.3].</p>
          </CardContent>
        </Card>
      )}

      {/* Mode lecture */}
      {!editing && (
        <>
          {regenerating && (
            <Card>
              <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Régénération IA en cours (15-45s)...
              </CardContent>
            </Card>
          )}
          <Renderer section={section} allSections={allSections} />
        </>
      )}

      {/* Footer audit + timeline validations */}
      {!editing && (
        <div className="space-y-2 px-1">
          {section.last_edited_at && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <HistoryIcon className="h-3 w-3" />
              Dernière modif : {editorName ?? 'utilisateur'} · {formatRelativeTime(section.last_edited_at)}
            </p>
          )}
          {validationLog.length > 0 && (
            <details className="text-[11px]">
              <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                Historique des validations ({validationLog.length})
              </summary>
              <div className="mt-2 space-y-1 border-l-2 border-border pl-3">
                {validationLog.map(entry => (
                  <div key={entry.id} className="text-xs">
                    <span className="text-muted-foreground">{formatRelativeTime(entry.created_at)}</span>
                    {' · '}
                    <strong>{entry.actor_name ?? 'utilisateur'}</strong>
                    {entry.actor_role && <span className="text-muted-foreground"> ({entry.actor_role})</span>}
                    {' '}
                    <span style={{ color: STATUS_COLORS[entry.to_status]?.color }}>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    {entry.comment && (
                      <p className="mt-0.5 ml-4 italic text-muted-foreground">"{entry.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Dialog confirmation régénération */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Régénérer la section ?</DialogTitle>
            <DialogDescription>
              L'IA va régénérer uniquement <strong>"{SECTION_LABELS[sectionCode]}"</strong> en utilisant les pièces de la Data Room et le contexte des autres sections. Le contenu actuel sera <strong>remplacé</strong>. 15-45s.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegenOpen(false)}>Annuler</Button>
            <Button onClick={handleRegenerate}>Régénérer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog actions de validation */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) { setActionDialog(null); setActionComment(''); } }}>
        <DialogContent>
          {actionDialog && (
            <>
              <DialogHeader>
                <DialogTitle>{actionDialogConfig[actionDialog].title}</DialogTitle>
                <DialogDescription>{actionDialogConfig[actionDialog].desc}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label>Commentaire {actionDialogConfig[actionDialog].commentRequired ? '(obligatoire)' : '(optionnel)'}</Label>
                <Textarea
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  rows={3}
                  placeholder={actionDialog === 'request_revision' ? "Ex: clarifier la rémunération du dirigeant + ajouter le pacte d'actionnaires" : "Commentaire (optionnel)"}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setActionDialog(null); setActionComment(''); }}>Annuler</Button>
                <Button
                  onClick={() => performAction(actionDialog, actionComment)}
                  disabled={actionSubmitting || (actionDialogConfig[actionDialog].commentRequired && !actionComment.trim())}
                >
                  {actionSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {actionDialogConfig[actionDialog].btn}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
