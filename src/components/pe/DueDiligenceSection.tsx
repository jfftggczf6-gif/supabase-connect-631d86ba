import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CheckCircle2, XCircle, AlertCircle, Circle, Loader2,
  Plus, Wand2, FileSearch, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

type DDCategory = 'financier' | 'juridique' | 'commercial' | 'operationnel' | 'rh' | 'esg' | 'fiscal' | 'it';
type DDSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
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
  severity: DDSeverity;
  title: string;
  body: string;
  recommendation: string | null;
  impacts_section_codes: string[];
  status: FindingStatus;
  source: 'ai' | 'manual';
  applied_to_memo_at: string | null;
  created_at: string;
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
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: cl }, { data: fd }] = await Promise.all([
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
    ]);
    setChecklist((cl ?? []) as ChecklistItem[]);
    setFindings((fd ?? []) as Finding[]);
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

  // Empty state — pas encore de DD lancée
  if (checklist.length === 0 && findings.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <FileSearch className="h-10 w-10 mx-auto text-primary/60" />
            <h2 className="text-lg font-semibold">Démarrer la Due Diligence</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              L'IA va analyser le memo IC1 + les pièces uploadées et produire :
              une checklist d'items à vérifier (par catégorie) et des findings
              préliminaires (problèmes détectés impactant le memo).
            </p>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              size="lg"
              className="gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? 'Génération en cours...' : 'Démarrer la DD'}
            </Button>
            <p className="text-[11px] text-muted-foreground/80">
              30-60 secondes · Le memo IC1 doit avoir été généré au préalable
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
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
                  {group.items.map(f => (
                    <div key={f.id} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                        <p className="text-xs leading-relaxed">
                          <strong>Recommandation :</strong> {f.recommendation}
                        </p>
                      )}
                      {f.impacts_section_codes.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">Impacte :</span>
                          {f.impacts_section_codes.map(code => (
                            <Badge key={code} variant="outline" className="text-[10px]">
                              {SECTION_CODE_LABELS[code] ?? code}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
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
