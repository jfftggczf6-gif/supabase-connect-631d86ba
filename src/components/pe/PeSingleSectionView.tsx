import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Edit3, RefreshCw, Save, X, History as HistoryIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
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

export default function PeSingleSectionView({ dealId, stage, sectionCode }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<any>(null);
  const [allSections, setAllSections] = useState<Record<string, any>>({});
  const [versionMeta, setVersionMeta] = useState<{ status: string; label: string } | null>(null);
  const [editorName, setEditorName] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [draftMd, setDraftMd] = useState('');
  const [saving, setSaving] = useState(false);

  // Regenerate state
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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
    setLoading(false);
  };

  useEffect(() => { loadSection(); }, [dealId, stage, sectionCode]);

  const handleEdit = () => {
    setDraftMd(section?.content_md ?? '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraftMd('');
  };

  const handleSave = async () => {
    if (!section) return;
    setSaving(true);
    const { error } = await supabase
      .from('memo_sections')
      .update({
        content_md: draftMd,
        last_edited_by: user?.id,
        last_edited_at: new Date().toISOString(),
      })
      .eq('id', section.id);
    setSaving(false);
    if (error) {
      toast.error(`Échec sauvegarde : ${error.message}`);
      return;
    }
    toast.success('Section mise à jour');
    setEditing(false);
    await loadSection();
  };

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

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="animate-spin h-4 w-4" /> Chargement...
      </div>
    );
  }

  if (!section) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Cette section n'a pas encore été générée.
        {!versionMeta && (
          <p className="mt-2">Drop des documents sur la carte du deal puis pousse en pré-screening pour générer le dossier.</p>
        )}
      </div>
    );
  }

  const Renderer = SECTION_RENDERERS[sectionCode];
  if (!Renderer) return <div className="p-8 text-muted-foreground">Section inconnue : {sectionCode}</div>;

  return (
    <div className="space-y-3">
      {/* Header avec actions */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{SECTION_LABELS[sectionCode]}</CardTitle>
            {versionMeta && (
              <p className="text-xs text-muted-foreground mt-0.5">Version : <strong>{versionMeta.label}</strong></p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEdit}>
                  <Edit3 className="h-3.5 w-3.5" /> Éditer
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRegenOpen(true)} disabled={regenerating}>
                  {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Régénérer
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleCancelEdit}>
                  <X className="h-3.5 w-3.5" /> Annuler
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Enregistrer
                </Button>
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Mode édition : textarea markdown */}
      {editing && (
        <Card>
          <CardContent className="p-4">
            <Textarea
              value={draftMd}
              onChange={(e) => setDraftMd(e.target.value)}
              rows={20}
              className="font-mono text-sm"
              placeholder="Markdown..."
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              Tu peux utiliser Markdown : **gras**, *italique*, listes, tableaux. Les sources [Source: pitch.pdf p.3] sont préservées.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mode lecture : viewer normal */}
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

      {/* Footer audit */}
      {section.last_edited_at && !editing && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-1">
          <HistoryIcon className="h-3 w-3" />
          Dernière modif : {editorName ?? 'utilisateur'} · {formatRelativeTime(section.last_edited_at)}
        </p>
      )}

      {/* Dialog confirmation régénération */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Régénérer la section ?</DialogTitle>
            <DialogDescription>
              L'IA va régénérer uniquement <strong>"{SECTION_LABELS[sectionCode]}"</strong> en utilisant les documents du deal et le contexte des autres sections.
              Le contenu actuel sera <strong>remplacé</strong>. Cette action est instantanée mais l'IA peut prendre 15-45s.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegenOpen(false)}>Annuler</Button>
            <Button onClick={handleRegenerate}>Régénérer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
