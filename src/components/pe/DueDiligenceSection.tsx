import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2, XCircle, AlertCircle, Circle, Loader2,
  Wand2, FileSearch, Upload, FileText, Trash2, Send,
  CheckCircle, ArrowRightLeft, AlertTriangle, Info, Quote, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';

type DDCategory = 'financier' | 'juridique' | 'commercial' | 'operationnel' | 'rh' | 'esg' | 'fiscal' | 'it';
type DDSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
type DDFindingType = 'confirmation' | 'adjustment' | 'red_flag' | 'informative';
type DDReportType = 'financiere' | 'juridique' | 'esg' | 'fiscale' | 'operationnelle' | 'commerciale' | 'autre';
type ChecklistStatus = 'pending' | 'verified' | 'red_flag' | 'na';
type FindingStatus = 'open' | 'mitigated' | 'accepted' | 'rejected';

interface ChecklistItem {
  id: string;
  category: DDCategory;
  item_label: string;
  item_description: string | null;
  status: ChecklistStatus;
  position: number;
  verified_at: string | null;
  verification_note: string | null;
}

interface Finding {
  id: string;
  category: DDCategory;
  finding_type: DDFindingType;
  severity: DDSeverity;
  title: string;
  body: string;
  recommendation: string | null;
  source_paragraph: string | null;
  source_page: number | null;
  source_doc_id: string | null;
  impacts_section_codes: string[];
  status: FindingStatus;
  source: 'ai' | 'manual';
  applied_to_memo_at: string | null;
  created_at: string;
}

interface DDReportDoc {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
  dd_report_type: DDReportType | null;
  dd_report_cabinet: string | null;
}

interface Props {
  dealId: string;
  organizationId: string;
}

const CATEGORY_LABELS: Record<DDCategory, string> = {
  financier:    'Financier',
  juridique:    'Juridique',
  commercial:   'Commercial',
  operationnel: 'Opérationnel',
  rh:           'RH',
  esg:          'ESG',
  fiscal:       'Fiscal',
  it:           'IT',
};

const CATEGORY_COLOR: Record<DDCategory, string> = {
  financier:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  juridique:    'bg-rose-50 text-rose-700 border-rose-200',
  commercial:   'bg-blue-50 text-blue-700 border-blue-200',
  operationnel: 'bg-amber-50 text-amber-700 border-amber-200',
  rh:           'bg-orange-50 text-orange-700 border-orange-200',
  esg:          'bg-teal-50 text-teal-700 border-teal-200',
  fiscal:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  it:           'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const SEVERITY_COLOR: Record<DDSeverity, { bg: string; color: string; border: string }> = {
  Critical: { bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)',  border: 'var(--pe-danger)' },
  High:     { bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'var(--pe-warning)' },
  Medium:   { bg: 'var(--pe-bg-info)',    color: 'var(--pe-info)',    border: 'var(--pe-info)' },
  Low:      { bg: 'var(--muted)',         color: 'var(--muted-foreground)', border: 'var(--border)' },
};

const SEVERITY_ORDER: DDSeverity[] = ['Critical', 'High', 'Medium', 'Low'];

const FINDING_TYPE_META: Record<DDFindingType, { label: string; bg: string; color: string; border: string; Icon: typeof CheckCircle }> = {
  confirmation: { label: 'Confirmation', bg: 'var(--pe-bg-success)', color: 'var(--pe-ok)',      border: 'var(--pe-ok)',      Icon: CheckCircle },
  adjustment:   { label: 'Ajustement',   bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'var(--pe-warning)', Icon: ArrowRightLeft },
  red_flag:     { label: 'Red flag',     bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)',  border: 'var(--pe-danger)',  Icon: AlertTriangle },
  informative:  { label: 'Info',         bg: 'var(--muted)',         color: 'var(--muted-foreground)', border: 'var(--border)', Icon: Info },
};

const REPORT_TYPE_LABELS: Record<DDReportType, string> = {
  financiere:     'DD financière',
  juridique:      'DD juridique',
  esg:            'DD ESG',
  fiscale:        'DD fiscale',
  operationnelle: 'DD opérationnelle',
  commerciale:    'DD commerciale',
  autre:          'Autre',
};

const SECTION_CODE_LABELS: Record<string, string> = {
  executive_summary:        '§1 Résumé',
  shareholding_governance:  '§2 Gouvernance',
  top_management:           '§3 Mgmt',
  services:                 '§4 Services',
  competition_market:       '§5 Marché',
  unit_economics:           '§6 Unit eco',
  financials_pnl:           '§7 PnL',
  financials_balance:       '§8 Bilan',
  investment_thesis:        '§9 Thèse',
  support_requested:        '§10 Accomp.',
  esg_risks:                '§11 ESG',
  annexes:                  '§12 Annexes',
};

function ChecklistStatusIcon({ status }: { status: ChecklistStatus }) {
  if (status === 'verified') return <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--pe-ok)' }} />;
  if (status === 'red_flag') return <XCircle className="h-4 w-4" style={{ color: 'var(--pe-danger)' }} />;
  if (status === 'na') return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function CHECKLIST_STATUS_LABEL(s: ChecklistStatus): string {
  if (s === 'verified') return 'Vérifié';
  if (s === 'red_flag') return 'Red flag';
  if (s === 'na') return 'N/A';
  return 'À vérifier';
}

export default function DueDiligenceSection({ dealId, organizationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [ddReports, setDdReports] = useState<DDReportDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: cl }, { data: fd }, { data: dd }] = await Promise.all([
      supabase
        .from('pe_dd_checklist')
        .select('*')
        .eq('deal_id', dealId)
        .order('category')
        .order('position'),
      supabase
        .from('pe_dd_findings')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      supabase
        .from('pe_deal_documents')
        .select('id, filename, storage_path, size_bytes, created_at, dd_report_type, dd_report_cabinet')
        .eq('deal_id', dealId)
        .eq('is_dd_report', true)
        .order('created_at', { ascending: false }),
    ]);
    setChecklist((cl ?? []) as unknown as ChecklistItem[]);
    setFindings((fd ?? []) as unknown as Finding[]);
    setDdReports((dd ?? []) as unknown as DDReportDoc[]);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { reload(); }, [reload]);

  const handleGenerate = async () => {
    if (generating) return;
    if (checklist.length > 0 || findings.length > 0) {
      if (!confirm('Une analyse DD existe déjà. Régénérer en ajoute de nouveaux items à la checklist et de nouveaux findings (sans supprimer les actuels). Continuer ?')) return;
    }
    setGenerating(true);
    const { error, data } = await supabase.functions.invoke('generate-dd-report', {
      body: { deal_id: dealId },
    });
    setGenerating(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Génération DD échouée');
      return;
    }
    toast.success(`DD générée : ${data.checklist_count} items checklist · ${data.findings_count} findings`);
    reload();
  };

  const handleUploadDdReport = async (files: FileList | File[]) => {
    if (uploading) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      let okCount = 0;
      for (const file of arr) {
        if (file.size > 100 * 1024 * 1024) {
          toast.error(`${file.name} dépasse 100 Mo`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${organizationId}/${dealId}/dd_${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from('pe_deal_docs').upload(path, file);
        if (upErr) { toast.error(`Upload échoué : ${upErr.message}`); continue; }
        const { error: dbErr } = await supabase.from('pe_deal_documents').insert({
          deal_id: dealId,
          organization_id: organizationId,
          filename: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          category: 'autre',
          is_dd_report: true,
          uploaded_by: user.id,
        });
        if (dbErr) { toast.error(`Enregistrement échoué : ${dbErr.message}`); continue; }
        okCount++;
      }
      if (okCount > 0) {
        toast.success(`${okCount} rapport${okCount > 1 ? 's' : ''} DD uploadé${okCount > 1 ? 's' : ''}`, {
          description: 'Tu peux maintenant analyser le rapport DD vs le memo IC1.',
        });
        await reload();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDdReport = async (doc: DDReportDoc) => {
    if (!confirm(`Supprimer le rapport DD ${doc.filename} ?`)) return;
    await supabase.storage.from('pe_deal_docs').remove([doc.storage_path]);
    const { error } = await supabase.from('pe_deal_documents').delete().eq('id', doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Rapport DD supprimé');
    reload();
  };

  const handleUpdateReportMeta = async (id: string, patch: { dd_report_type?: DDReportType; dd_report_cabinet?: string }) => {
    setDdReports(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    const { error } = await supabase.from('pe_deal_documents').update(patch).eq('id', id);
    if (error) { toast.error(error.message); reload(); return; }
  };

  const handleOpenSourceDoc = async (docId: string, page: number | null) => {
    const doc = ddReports.find(d => d.id === docId);
    if (!doc) { toast.error('Rapport DD introuvable'); return; }
    const { data, error } = await supabase.storage.from('pe_deal_docs').createSignedUrl(doc.storage_path, 600);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? 'Lien indisponible'); return; }
    const url = page && /\.pdf(\?|$)/i.test(doc.storage_path) ? `${data.signedUrl}#page=${page}` : data.signedUrl;
    window.open(url, '_blank', 'noopener');
  };

  const handleApplyFindings = async () => {
    if (applying) return;
    const openFindings = findings.filter(f => f.status === 'open' && !f.applied_to_memo_at);
    if (openFindings.length === 0) {
      toast.error('Aucun finding ouvert à appliquer');
      return;
    }
    if (!confirm(`Pousser ${openFindings.length} finding${openFindings.length > 1 ? 's' : ''} dans le memo ?\n\nUn snapshot pré-DD sera figé pour audit.\nLe memo passera en stage 'note_ic_finale'.\nLes sections impactées passeront en status='draft' (re-validation requise).`)) return;
    setApplying(true);
    const { error, data } = await supabase.functions.invoke('apply-dd-findings-to-memo', {
      body: { deal_id: dealId },
    });
    setApplying(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Application findings échouée');
      return;
    }
    toast.success(`Findings appliqués · ${data.sections_updated}/${data.sections_updated + data.sections_failed} sections mises à jour`, {
      description: `Snapshot "${data.snapshot_label}" créé · Memo passé en ${data.new_stage}`,
    });
    reload();
  };

  const handleSetStatus = async (id: string, newStatus: ChecklistStatus) => {
    const { error } = await supabase
      .from('pe_dd_checklist')
      .update({
        status: newStatus,
        verified_at: ['verified', 'red_flag', 'na'].includes(newStatus) ? new Date().toISOString() : null,
      })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const grouped = checklist.reduce<Record<DDCategory, ChecklistItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<DDCategory, ChecklistItem[]>);

  const findingsBySeverity = SEVERITY_ORDER.map(sev => ({
    severity: sev,
    items: findings.filter(f => f.severity === sev),
  })).filter(g => g.items.length > 0);

  const stats = {
    total: checklist.length,
    pending: checklist.filter(c => c.status === 'pending').length,
    verified: checklist.filter(c => c.status === 'verified').length,
    redFlags: checklist.filter(c => c.status === 'red_flag').length,
    findingsTotal: findings.length,
    findingsCritical: findings.filter(f => f.severity === 'Critical').length,
    findingsHigh: findings.filter(f => f.severity === 'High').length,
    findingsOpen: findings.filter(f => f.status === 'open').length,
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>;
  }

  const hasAnalysis = checklist.length > 0 || findings.length > 0;
  const openFindingsCount = findings.filter(f => f.status === 'open' && !f.applied_to_memo_at).length;
  const appliedFindingsCount = findings.filter(f => f.applied_to_memo_at).length;

  // Zone upload rapport DD (toujours visible en haut)
  const uploadZone = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSearch className="h-4 w-4" />
          Rapport DD externe ({ddReports.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          La DD est externalisée auprès d'un cabinet d'expertise. Upload son rapport ici pour le comparer au memo IC1 et identifier les écarts.
        </p>

        {ddReports.length > 0 && (
          <div className="space-y-1.5">
            {ddReports.map(d => (
              <div key={d.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-3 py-1.5 flex-wrap">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 min-w-[120px]">{d.filename}</span>
                <Select
                  value={d.dd_report_type ?? ''}
                  onValueChange={(v) => handleUpdateReportMeta(d.id, { dd_report_type: v as DDReportType })}
                >
                  <SelectTrigger className="h-7 w-[150px] text-xs">
                    <SelectValue placeholder="Type DD…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REPORT_TYPE_LABELS) as DDReportType[]).map(k => (
                      <SelectItem key={k} value={k} className="text-xs">{REPORT_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  defaultValue={d.dd_report_cabinet ?? ''}
                  placeholder="Cabinet (ex: KPMG)"
                  className="h-7 w-[160px] text-xs"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (d.dd_report_cabinet ?? '')) {
                      handleUpdateReportMeta(d.id, { dd_report_cabinet: val || undefined });
                    }
                  }}
                />
                {d.size_bytes != null && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {d.size_bytes < 1024 * 1024 ? `${(d.size_bytes / 1024).toFixed(0)} Ko` : `${(d.size_bytes / (1024 * 1024)).toFixed(1)} Mo`}
                  </span>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDeleteDdReport(d)} title="Supprimer">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : 'hover:bg-muted/40'}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleUploadDdReport(e.dataTransfer.files); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xlsx,.xls"
            className="hidden"
            onChange={e => { if (e.target.files) handleUploadDdReport(e.target.files); e.target.value = ''; }}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Upload className="h-4 w-4 text-primary/70" />
              <span className="font-medium">Upload rapport DD</span>
              <span className="text-xs text-muted-foreground">PDF, Word, Excel · 100 Mo max</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleGenerate}
            disabled={generating || ddReports.length === 0}
            size="sm"
            className="gap-1.5"
            title={ddReports.length === 0 ? "Upload d'abord un rapport DD" : undefined}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {hasAnalysis ? 'Régénérer findings' : 'Analyser le rapport DD'}
          </Button>
          {openFindingsCount > 0 && (
            <Button
              onClick={handleApplyFindings}
              disabled={applying}
              size="sm"
              variant="default"
              className="gap-1.5"
              style={{ background: 'var(--pe-purple)', color: 'white' }}
            >
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Appliquer {openFindingsCount} finding{openFindingsCount > 1 ? 's' : ''} au memo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Pas encore d'analyse DD : on affiche juste la zone upload + un placeholder
  if (!hasAnalysis) {
    return (
      <div className="space-y-4">
        {uploadZone}
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <FileSearch className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>
              Aucune analyse DD pour le moment. Upload le rapport DD du cabinet, puis clique sur <strong>Analyser le rapport DD</strong>.
            </p>
            <p className="text-[11px] mt-1">L'IA comparera le rapport avec le memo IC1 et listera les écarts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {uploadZone}

      {/* Header stats */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className="font-semibold">Due Diligence</span>
              <Badge variant="outline">{stats.total} items checklist</Badge>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {stats.verified} vérifiés
              </Badge>
              {stats.pending > 0 && (
                <Badge variant="outline" className="bg-muted">{stats.pending} à vérifier</Badge>
              )}
              {stats.redFlags > 0 && (
                <Badge variant="outline" style={{ background: 'var(--pe-bg-danger)', color: 'var(--pe-danger)', borderColor: 'var(--pe-danger)' }}>
                  {stats.redFlags} red flag{stats.redFlags > 1 ? 's' : ''}
                </Badge>
              )}
              <span className="text-muted-foreground">·</span>
              <Badge variant="outline">{stats.findingsTotal} findings</Badge>
              {stats.findingsCritical > 0 && (
                <Badge variant="outline" style={{ background: 'var(--pe-bg-danger)', color: 'var(--pe-danger)', borderColor: 'var(--pe-danger)' }}>
                  {stats.findingsCritical} Critical
                </Badge>
              )}
              {stats.findingsHigh > 0 && (
                <Badge variant="outline" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', borderColor: 'var(--pe-warning)' }}>
                  {stats.findingsHigh} High
                </Badge>
              )}
            </div>
            <Button onClick={handleGenerate} disabled={generating} size="sm" variant="outline" className="gap-1.5">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Régénérer DD
            </Button>
          </div>
          {stats.total > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Avancement checklist</span>
                <span className="font-mono">
                  {Math.round((stats.verified / stats.total) * 100)}% · {stats.verified}/{stats.total} vérifiés
                </span>
              </div>
              <Progress value={(stats.verified / stats.total) * 100} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
          <TabsTrigger value="checklist">Checklist ({checklist.length})</TabsTrigger>
        </TabsList>

        {/* Findings tab — groupé par sévérité */}
        <TabsContent value="findings" className="space-y-3 mt-3">
          {findingsBySeverity.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aucun finding pour le moment.</p>
          ) : (
            findingsBySeverity.map(group => (
              <Card key={group.severity} style={{ borderLeftColor: SEVERITY_COLOR[group.severity].border, borderLeftWidth: 3 }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline" style={{
                      background: SEVERITY_COLOR[group.severity].bg,
                      color: SEVERITY_COLOR[group.severity].color,
                      borderColor: SEVERITY_COLOR[group.severity].border,
                    }}>
                      {group.severity}
                    </Badge>
                    {group.items.length} finding{group.items.length > 1 ? 's' : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.items.map(f => {
                    const ft = FINDING_TYPE_META[f.finding_type ?? 'informative'];
                    const FtIcon = ft.Icon;
                    const hasSource = !!(f.source_paragraph || f.source_page || f.source_doc_id);
                    return (
                      <div key={f.id} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase gap-1"
                              style={{ background: ft.bg, color: ft.color, borderColor: ft.border }}
                            >
                              <FtIcon className="h-3 w-3" />
                              {ft.label}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] uppercase ${CATEGORY_COLOR[f.category]}`}>
                              {CATEGORY_LABELS[f.category]}
                            </Badge>
                            <span className="font-medium text-sm">{f.title}</span>
                            {f.source === 'ai' && (
                              <span className="text-[10px] text-muted-foreground">·  IA</span>
                            )}
                            {f.applied_to_memo_at && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                ✓ Intégré au memo
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {f.status}
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground mb-1.5">{f.body}</p>
                        {f.recommendation && (
                          <p className="text-xs leading-relaxed mb-1.5">
                            <strong>Recommandation :</strong> {f.recommendation}
                          </p>
                        )}
                        {hasSource && (
                          <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground">
                            <Quote className="h-3 w-3" />
                            <span>Source :</span>
                            {f.source_paragraph && <span className="font-mono">{f.source_paragraph}</span>}
                            {f.source_page && <span className="font-mono">p.{f.source_page}</span>}
                            {f.source_doc_id && (
                              <button
                                onClick={() => handleOpenSourceDoc(f.source_doc_id!, f.source_page)}
                                className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline text-primary"
                                title="Ouvrir le rapport DD source"
                              >
                                {ddReports.find(d => d.id === f.source_doc_id)?.filename ?? 'Ouvrir le rapport'}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                        {f.impacts_section_codes.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">Impacte :</span>
                            {f.impacts_section_codes.map(code => (
                              <Badge key={code} variant="outline" className="text-[10px]">
                                {SECTION_CODE_LABELS[code] ?? code}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Checklist tab — groupé par catégorie */}
        <TabsContent value="checklist" className="space-y-3 mt-3">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aucun item de checklist.</p>
          ) : (
            (Object.keys(grouped) as DDCategory[]).sort().map(cat => (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] uppercase ${CATEGORY_COLOR[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">({grouped[cat].length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {grouped[cat].map(item => (
                    <div key={item.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/30 transition-colors group">
                      <ChecklistStatusIcon status={item.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.item_label}</p>
                        {item.item_description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.item_description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handleSetStatus(item.id, 'verified')}
                          title="Marquer vérifié"
                        >
                          <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--pe-ok)' }} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handleSetStatus(item.id, 'red_flag')}
                          title="Marquer red flag"
                        >
                          <XCircle className="h-3 w-3" style={{ color: 'var(--pe-danger)' }} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handleSetStatus(item.id, 'na')}
                          title="Marquer N/A"
                        >
                          <Circle className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handleSetStatus(item.id, 'pending')}
                          title="Repasser à pending"
                        >
                          <AlertCircle className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {CHECKLIST_STATUS_LABEL(item.status)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
