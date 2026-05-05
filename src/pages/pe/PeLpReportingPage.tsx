// PeLpReportingPage — page de génération + listing des rapports LPs
// Permet de générer un rapport participation (par deal) ou portfolio (agrégé)
// pour une période donnée.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, FileText, Sparkles, Plus, Eye, Download, Send, Trash2, Briefcase, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface LpReport {
  id: string;
  organization_id: string;
  deal_id: string | null;
  format: 'participation' | 'portfolio';
  period: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'finalized' | 'sent';
  data: any;
  sent_to: string[];
  sent_at: string | null;
  generated_at: string;
}

interface DealOption {
  id: string;
  deal_ref: string;
  enterprise_name: string | null;
  stage: string;
}

export default function PeLpReportingPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<LpReport[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [previewReport, setPreviewReport] = useState<LpReport | null>(null);

  // Form genère
  const [formFormat, setFormFormat] = useState<'participation' | 'portfolio'>('portfolio');
  const [formDealId, setFormDealId] = useState('');
  const [formPeriod, setFormPeriod] = useState(`Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${new Date().getFullYear()}`);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');

  const reload = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [{ data: rep }, { data: dl }] = await Promise.all([
      supabase
        .from('pe_lp_reports')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('period_end', { ascending: false }),
      supabase
        .from('pe_deals')
        .select('id, deal_ref, stage, enterprises(name)')
        .eq('organization_id', currentOrg.id)
        .in('stage', ['closing', 'portfolio']),
    ]);
    setReports((rep ?? []) as any);
    setDeals(((dl ?? []) as any[]).map(d => ({
      id: d.id,
      deal_ref: d.deal_ref,
      enterprise_name: d.enterprises?.name ?? null,
      stage: d.stage,
    })));
    setLoading(false);
  };

  useEffect(() => { reload(); }, [currentOrg?.id]);

  const generateReport = async () => {
    if (!currentOrg) return;
    if (formFormat === 'participation' && !formDealId) {
      toast.error('Sélectionne une participation');
      return;
    }
    if (!formPeriod || !formStart || !formEnd) {
      toast.error('Période, dates début et fin requises');
      return;
    }
    setGenerating(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lp-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          format: formFormat,
          period: formPeriod,
          period_start: formStart,
          period_end: formEnd,
          deal_id: formFormat === 'participation' ? formDealId : undefined,
          organization_id: formFormat === 'portfolio' ? currentOrg.id : undefined,
        }),
      });
      const result = await resp.json();
      if (resp.ok) {
        toast.success('Rapport généré');
        setShowGenerate(false);
        reload();
      } else {
        toast.error(`Génération échouée : ${result.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setGenerating(false);
  };

  const finalizeReport = async (id: string) => {
    const { error } = await supabase
      .from('pe_lp_reports')
      .update({ status: 'finalized' })
      .eq('id', id);
    if (!error) {
      toast.success('Rapport finalisé');
      reload();
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Supprimer ce rapport ?')) return;
    const { error } = await supabase.from('pe_lp_reports').delete().eq('id', id);
    if (!error) reload();
  };

  if (loading) {
    return <DashboardLayout title="Reporting LPs"><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  const participationReports = reports.filter(r => r.format === 'participation');
  const portfolioReports = reports.filter(r => r.format === 'portfolio');

  return (
    <DashboardLayout title="Reporting LPs" subtitle="Rapports périodiques pour les Limited Partners du fonds">
      <div className="px-6 py-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Un seul jeu de données → 3 exports au bon format. Génère un rapport par participation
            (KPIs, NAV, IRR, MOIC, faits marquants, risques) ou un rapport portfolio agrégé
            (NAV totale, IRR net, TVPI, performance secteur/pays).
          </p>
          <Button onClick={() => setShowGenerate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Générer un rapport
          </Button>
        </div>

        <Tabs defaultValue="portfolio">
          <TabsList>
            <TabsTrigger value="portfolio" className="gap-1.5">
              <PieChart className="h-3.5 w-3.5" />
              Portfolio agrégé ({portfolioReports.length})
            </TabsTrigger>
            <TabsTrigger value="participation" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              Participations ({participationReports.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio" className="space-y-2 mt-4">
            {portfolioReports.length === 0 ? (
              <EmptyState text="Aucun rapport portfolio généré." />
            ) : (
              portfolioReports.map(r => (
                <ReportCard key={r.id} report={r} onPreview={setPreviewReport} onFinalize={finalizeReport} onDelete={deleteReport} />
              ))
            )}
          </TabsContent>

          <TabsContent value="participation" className="space-y-2 mt-4">
            {participationReports.length === 0 ? (
              <EmptyState text="Aucun rapport participation généré." />
            ) : (
              participationReports.map(r => (
                <ReportCard key={r.id} report={r} onPreview={setPreviewReport} onFinalize={finalizeReport} onDelete={deleteReport} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* === Dialog génération === */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Générer un rapport LP</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select value={formFormat} onValueChange={(v) => setFormFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portfolio">Portfolio agrégé (tout le fonds)</SelectItem>
                  <SelectItem value="participation">Participation (1 deal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formFormat === 'participation' && (
              <div className="space-y-1">
                <Label className="text-xs">Participation *</Label>
                <Select value={formDealId} onValueChange={setFormDealId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionne un deal en portfolio" /></SelectTrigger>
                  <SelectContent>
                    {deals.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.deal_ref} — {d.enterprise_name ?? '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Période *</Label>
                <Input value={formPeriod} onChange={e => setFormPeriod(e.target.value)} placeholder="Q1-2026" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date début *</Label>
                <Input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date fin *</Label>
                <Input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              ⏱ Génération ~30-60s. L'IA agrège les données (NAV, scoring, alertes, valuations) et rédige la narrative LP.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)} disabled={generating}>Annuler</Button>
            <Button onClick={generateReport} disabled={generating}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Génération…</> : <><Sparkles className="h-4 w-4 mr-2" /> Générer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Preview report === */}
      {previewReport && (
        <ReportPreviewDialog
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}
    </DashboardLayout>
  );
}

function ReportCard({
  report, onPreview, onFinalize, onDelete,
}: {
  report: LpReport;
  onPreview: (r: LpReport) => void;
  onFinalize: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isPortfolio = report.format === 'portfolio';
  const dealName = isPortfolio
    ? `Portfolio agrégé`
    : `${report.data?.deal?.ref ?? ''} — ${report.data?.deal?.name ?? ''}`;

  const STATUS_META: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    finalized: 'bg-blue-50 text-blue-700 border-blue-200',
    sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <Card>
      <CardContent className="py-3 flex items-center gap-3 flex-wrap">
        <FileText className="h-5 w-5 text-violet-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{dealName}</span>
            <Badge variant="outline" className="text-[10px]">{report.period}</Badge>
            <Badge variant="outline" className={`text-[10px] ${STATUS_META[report.status] ?? ''}`}>{report.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {report.period_start} → {report.period_end} · généré le {new Date(report.generated_at).toLocaleDateString('fr-FR')}
            {isPortfolio && report.data?.metrics && (
              <> · {report.data.metrics.participations_count} participations · TVPI {report.data.metrics.tvpi?.toFixed(2) ?? 'n/d'}</>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onPreview(report)}>
            <Eye className="h-3 w-3" /> Aperçu
          </Button>
          {report.status === 'draft' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onFinalize(report.id)}>
              Finaliser
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(report.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p>{text}</p>
        <p className="text-sm">Click "Générer un rapport" pour créer le premier.</p>
      </CardContent>
    </Card>
  );
}

function ReportPreviewDialog({ report, onClose }: { report: LpReport; onClose: () => void }) {
  const isPortfolio = report.format === 'portfolio';
  const data = report.data ?? {};
  const narr = data.narrative ?? {};

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Rapport LP {isPortfolio ? 'Portfolio' : 'Participation'} · {report.period}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isPortfolio && data.metrics && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Métriques fonds</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">Participations :</span> {data.metrics.participations_count}</div>
                <div><span className="text-muted-foreground">Total investi :</span> {Number(data.metrics.total_invested ?? 0).toLocaleString('fr-FR')}</div>
                <div><span className="text-muted-foreground">NAV totale :</span> {Number(data.metrics.total_nav ?? 0).toLocaleString('fr-FR')}</div>
                <div><span className="text-muted-foreground">TVPI :</span> {data.metrics.tvpi?.toFixed(2) ?? 'n/d'}</div>
                <div><span className="text-muted-foreground">MOIC moyen :</span> {data.metrics.avg_moic?.toFixed(2) ?? 'n/d'}</div>
                <div><span className="text-muted-foreground">IRR moyen :</span> {data.metrics.avg_irr ? (data.metrics.avg_irr * 100).toFixed(1) + '%' : 'n/d'}</div>
              </CardContent>
            </Card>
          )}

          {!isPortfolio && data.deal && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{data.deal.name} ({data.deal.ref})</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Secteur :</span> {data.deal.sector}</div>
                <div><span className="text-muted-foreground">Pays :</span> {data.deal.country}</div>
                {data.investment && <>
                  <div><span className="text-muted-foreground">Ticket :</span> {Number(data.investment.ticket).toLocaleString('fr-FR')} {data.investment.devise}</div>
                  <div><span className="text-muted-foreground">% détention :</span> {data.investment.equity_stake_pct}%</div>
                </>}
                {data.nav_amount && <div><span className="text-muted-foreground">NAV actuelle :</span> {Number(data.nav_amount).toLocaleString('fr-FR')}</div>}
                {data.moic_to_date && <div><span className="text-muted-foreground">MOIC :</span> {data.moic_to_date}</div>}
                {data.irr_to_date && <div><span className="text-muted-foreground">IRR :</span> {(data.irr_to_date * 100).toFixed(1)}%</div>}
                {data.last_score && <div><span className="text-muted-foreground">Score :</span> {data.last_score.score_total}/100 (delta {data.last_score.delta_vs_entry > 0 ? '+' : ''}{data.last_score.delta_vs_entry})</div>}
              </CardContent>
            </Card>
          )}

          {narr.executive_summary && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Résumé exécutif</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed">{narr.executive_summary}</CardContent>
            </Card>
          )}

          {narr.faits_marquants?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Faits marquants</CardTitle></CardHeader>
              <CardContent><ul className="list-disc list-inside text-sm space-y-1">{narr.faits_marquants.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></CardContent>
            </Card>
          )}

          {narr.highlights?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Highlights</CardTitle></CardHeader>
              <CardContent><ul className="list-disc list-inside text-sm space-y-1">{narr.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul></CardContent>
            </Card>
          )}

          {narr.risques?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Risques</CardTitle></CardHeader>
              <CardContent className="space-y-2">{narr.risques.map((r: any, i: number) => (
                <div key={i} className="border-l-2 border-amber-300 pl-2">
                  <div className="font-medium text-sm">{r.title} <Badge variant="outline" className="text-[10px] ml-1">{r.severity}</Badge></div>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                  {r.mitigation && <p className="text-xs text-emerald-700">→ {r.mitigation}</p>}
                </div>
              ))}</CardContent>
            </Card>
          )}

          {narr.top_performers?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-700">Top performers</CardTitle></CardHeader>
              <CardContent>{narr.top_performers.map((t: any, i: number) => (
                <div key={i} className="text-sm"><strong>{t.deal_ref}</strong> · {t.raison}</div>
              ))}</CardContent>
            </Card>
          )}

          {narr.underperformers?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700">Underperformers</CardTitle></CardHeader>
              <CardContent>{narr.underperformers.map((u: any, i: number) => (
                <div key={i} className="text-sm space-y-0.5">
                  <div><strong>{u.deal_ref}</strong> · {u.raison}</div>
                  {u.actions && <div className="text-xs text-emerald-700">Actions : {u.actions}</div>}
                </div>
              ))}</CardContent>
            </Card>
          )}

          {narr.perspectives && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Perspectives</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed">{narr.perspectives}</CardContent>
            </Card>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
