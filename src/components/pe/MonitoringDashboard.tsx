// MonitoringDashboard — tableau de bord trimestriel post-closing
// Affiche : graphique réel/budget/projection + courbe scoring 6 dim + alertes
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Loader2, TrendingUp, TrendingDown, AlertTriangle, AlertCircle, CheckCircle2, Info,
  Plus, Sparkles, Bell, Calendar, BarChart3, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  dealId: string;
  organizationId: string;
}

interface QuarterlyReport {
  id: string;
  deal_id: string;
  period: string;
  period_start: string;
  period_end: string;
  pnl_data: any;
  bilan_data: any;
  kpi_data: any;
  narrative: string | null;
  submitted_at: string;
}

interface ScoreHistoryItem {
  id: string;
  period: string;
  period_end: string;
  score_total: number | null;
  score_financier: number | null;
  score_marche: number | null;
  score_management: number | null;
  score_gouvernance: number | null;
  score_modele: number | null;
  score_esg: number | null;
  delta_vs_previous: number | null;
  delta_vs_entry: number | null;
  drivers: any;
}

interface AlertSignal {
  id: string;
  period: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  title: string;
  message: string;
  threshold_label: string | null;
  actual_value: number | null;
  expected_value: number | null;
  delta_pct: number | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  raised_at: string;
}

const SEVERITY_META: Record<AlertSignal['severity'], { cls: string; Icon: any; label: string }> = {
  info: { cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Info, label: 'Info' },
  warning: { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle, label: 'Warning' },
  critical: { cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertCircle, label: 'Critical' },
};

export default function MonitoringDashboard({ dealId, organizationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [reports, setReports] = useState<QuarterlyReport[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertSignal[]>([]);
  const [showAddReport, setShowAddReport] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: rep }, { data: sc }, { data: al }] = await Promise.all([
      supabase.from('pe_quarterly_reports').select('*').eq('deal_id', dealId).order('period_end', { ascending: false }),
      supabase.from('pe_score_history').select('*').eq('deal_id', dealId).order('period_end'),
      supabase.from('pe_alert_signals').select('*').eq('deal_id', dealId).order('raised_at', { ascending: false }),
    ]);
    setReports((rep ?? []) as any);
    setScoreHistory((sc ?? []) as any);
    setAlerts((al ?? []) as any);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { reload(); }, [reload]);

  const analyzeReport = async (reportId: string) => {
    setAnalyzing(reportId);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-quarterly-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ quarterly_report_id: reportId, force: true }),
      });
      const result = await resp.json();
      if (resp.ok) {
        if (result.skipped) toast.info(result.reason);
        else toast.success(`Analyse IA terminée — score ${result.score?.score_total}/100, ${result.alerts_count} alertes`);
        reload();
      } else {
        toast.error(`Analyse échouée : ${result.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setAnalyzing(null);
  };

  const ackAlert = async (id: string) => {
    const { error } = await supabase
      .from('pe_alert_signals')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) reload();
  };

  const resolveAlert = async (id: string) => {
    const note = prompt('Note de résolution (optionnel) :') ?? '';
    const { error } = await supabase
      .from('pe_alert_signals')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_note: note || null,
      })
      .eq('id', id);
    if (!error) reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Stats
  const openAlerts = alerts.filter(a => !a.resolved_at);
  const criticalOpen = openAlerts.filter(a => a.severity === 'critical');
  const lastScore = scoreHistory[scoreHistory.length - 1];
  const firstScore = scoreHistory[0];
  const totalDelta = lastScore && firstScore ? (lastScore.score_total ?? 0) - (firstScore.score_total ?? 0) : 0;

  // Graphique : score total dans le temps
  const scoreLineData = scoreHistory.map(s => ({
    period: s.period,
    score: s.score_total,
  }));

  // Graphique : 6 dimensions au dernier trimestre (radar)
  const lastDimsRadar = lastScore ? [
    { dim: 'Financier', value: lastScore.score_financier ?? 0 },
    { dim: 'Marché', value: lastScore.score_marche ?? 0 },
    { dim: 'Management', value: lastScore.score_management ?? 0 },
    { dim: 'Gouvernance', value: lastScore.score_gouvernance ?? 0 },
    { dim: 'Modèle', value: lastScore.score_modele ?? 0 },
    { dim: 'ESG', value: lastScore.score_esg ?? 0 },
  ] : [];

  // Graphique : CA réel par trimestre (extrait pnl_data)
  const caData = reports.slice().reverse().map(r => ({
    period: r.period,
    ca: typeof r.pnl_data?.ca === 'number' ? r.pnl_data.ca : (typeof r.pnl_data?.chiffre_affaires === 'number' ? r.pnl_data.chiffre_affaires : 0),
    ebitda: typeof r.pnl_data?.ebitda === 'number' ? r.pnl_data.ebitda : 0,
  })).filter(d => d.ca > 0 || d.ebitda > 0);

  return (
    <div className="space-y-4">
      {/* === Header — Stats récap === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-500" />
              Monitoring trimestriel
              <Badge variant="outline" className="text-xs">{reports.length} rapports</Badge>
            </span>
            <Button size="sm" onClick={() => setShowAddReport(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nouveau rapport trimestriel
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-violet-50 border border-violet-200 rounded p-2">
              <div className="text-violet-700 font-medium">Score actuel</div>
              <div className="text-2xl font-bold text-violet-800">{lastScore?.score_total ?? '—'}<span className="text-sm font-normal">/100</span></div>
            </div>
            <div className={`border rounded p-2 ${totalDelta >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`font-medium ${totalDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Évolution depuis entrée</div>
              <div className={`text-2xl font-bold flex items-center gap-1 ${totalDelta >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                {totalDelta >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {totalDelta > 0 && '+'}{totalDelta || '—'}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <div className="text-amber-700 font-medium">Alertes ouvertes</div>
              <div className="text-2xl font-bold text-amber-800">{openAlerts.length}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <div className="text-red-700 font-medium">Critiques</div>
              <div className="text-2xl font-bold text-red-800">{criticalOpen.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Graphiques</TabsTrigger>
          <TabsTrigger value="alerts">Alertes ({openAlerts.length})</TabsTrigger>
          <TabsTrigger value="reports">Rapports ({reports.length})</TabsTrigger>
        </TabsList>

        {/* === CHARTS === */}
        <TabsContent value="charts" className="space-y-4 mt-4">
          {scoreHistory.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p>Aucun rapport analysé pour le moment.</p>
              <p className="text-sm">Ajoute un rapport trimestriel et lance l'analyse IA.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Score total dans le temps */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Score global (dans le temps)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={scoreLineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="period" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Radar 6 dimensions */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Scoring 6 dimensions ({lastScore?.period})</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={lastDimsRadar}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="dim" fontSize={10} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} />
                      <Radar name="Score" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* CA et EBITDA */}
              {caData.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">CA et EBITDA réels par trimestre</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={caData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="period" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="ca" fill="#7c3aed" name="CA" />
                        <Bar dataKey="ebitda" fill="#10b981" name="EBITDA" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* === ALERTS === */}
        <TabsContent value="alerts" className="space-y-2 mt-4">
          {alerts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p>Aucune alerte. Tout va bien 🎉</p>
            </CardContent></Card>
          ) : (
            alerts.map(a => {
              const meta = SEVERITY_META[a.severity];
              const SIcon = meta.Icon;
              const isResolved = !!a.resolved_at;
              return (
                <Card key={a.id} className={isResolved ? 'opacity-60' : ''}>
                  <CardContent className="py-3 flex items-start gap-3">
                    <SIcon className={`h-5 w-5 shrink-0 mt-0.5 ${a.severity === 'critical' ? 'text-red-500' : a.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm">{a.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
                        <Badge variant="outline" className="text-[10px]">{a.period}</Badge>
                        {isResolved && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">Résolue</Badge>}
                        {!isResolved && a.acknowledged_at && <Badge variant="outline" className="text-[10px] bg-slate-100">Vue</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{a.message}</p>
                      {a.threshold_label && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Seuil : <span className="font-mono">{a.threshold_label}</span>
                          {a.actual_value != null && a.expected_value != null && (
                            <> · Réel <span className="font-mono">{a.actual_value}</span> vs attendu <span className="font-mono">{a.expected_value}</span></>
                          )}
                          {a.delta_pct != null && <> ({a.delta_pct > 0 ? '+' : ''}{a.delta_pct.toFixed(1)}%)</>}
                        </p>
                      )}
                    </div>
                    {!isResolved && (
                      <div className="flex gap-1 shrink-0">
                        {!a.acknowledged_at && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => ackAlert(a.id)}>Vu</Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => resolveAlert(a.id)}>
                          <CheckCircle2 className="h-3 w-3" /> Résoudre
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* === REPORTS === */}
        <TabsContent value="reports" className="space-y-2 mt-4">
          {reports.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p>Aucun rapport encore. Click "Nouveau rapport" en haut pour commencer.</p>
            </CardContent></Card>
          ) : (
            reports.map(r => {
              const hasScore = scoreHistory.some(s => s.period === r.period);
              return (
                <Card key={r.id}>
                  <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{r.period}</span>
                    <span className="text-xs text-muted-foreground">{r.period_start} → {r.period_end}</span>
                    {r.pnl_data?.ca > 0 && <Badge variant="outline" className="text-[10px]">CA {Number(r.pnl_data.ca).toLocaleString('fr-FR')}</Badge>}
                    {r.pnl_data?.ebitda != null && <Badge variant="outline" className="text-[10px]">EBITDA {Number(r.pnl_data.ebitda).toLocaleString('fr-FR')}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">soumis le {new Date(r.submitted_at).toLocaleDateString('fr-FR')}</span>
                    {hasScore ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">Analysé</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => analyzeReport(r.id)} disabled={analyzing === r.id}>
                        {analyzing === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Analyser (IA)
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* === Add report dialog === */}
      <AddQuarterlyReportDialog
        open={showAddReport}
        onOpenChange={setShowAddReport}
        dealId={dealId}
        organizationId={organizationId}
        onAdded={(id) => { reload(); analyzeReport(id); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component : dialog d'ajout d'un rapport trimestriel
// ─────────────────────────────────────────────────────────────────────────────
function AddQuarterlyReportDialog({
  open, onOpenChange, dealId, organizationId, onAdded,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  dealId: string;
  organizationId: string;
  onAdded: (id: string) => void;
}) {
  const [period, setPeriod] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [ca, setCa] = useState('');
  const [ebitda, setEbitda] = useState('');
  const [resultatNet, setResultatNet] = useState('');
  const [margeBrute, setMargeBrute] = useState('');
  const [effectifs, setEffectifs] = useState('');
  const [narrative, setNarrative] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPeriod(''); setPeriodStart(''); setPeriodEnd('');
    setCa(''); setEbitda(''); setResultatNet(''); setMargeBrute('');
    setEffectifs(''); setNarrative('');
  };

  const handleSubmit = async () => {
    if (!period.trim() || !periodStart || !periodEnd) {
      toast.error('Période, date début et date fin requises');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('pe_quarterly_reports')
      .insert({
        deal_id: dealId,
        organization_id: organizationId,
        period: period.trim(),
        period_start: periodStart,
        period_end: periodEnd,
        pnl_data: {
          ca: ca ? Number(ca) : null,
          ebitda: ebitda ? Number(ebitda) : null,
          resultat_net: resultatNet ? Number(resultatNet) : null,
          marge_brute_pct: margeBrute ? Number(margeBrute) : null,
        },
        kpi_data: {
          effectifs: effectifs ? Number(effectifs) : null,
        },
        narrative: narrative.trim() || null,
        source: 'manual',
      })
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Rapport ajouté — analyse IA en cours');
    reset();
    onOpenChange(false);
    onAdded(data!.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau rapport trimestriel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Saisis les chiffres clés du trimestre. L'IA analysera ensuite vs projections du memo IC et générera scoring + alertes.
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Période *</Label>
              <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Q1-2026" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date début *</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date fin *</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">CA</Label>
              <Input type="number" value={ca} onChange={e => setCa(e.target.value)} placeholder="450000000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">EBITDA</Label>
              <Input type="number" value={ebitda} onChange={e => setEbitda(e.target.value)} placeholder="85000000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Résultat net</Label>
              <Input type="number" value={resultatNet} onChange={e => setResultatNet(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marge brute %</Label>
              <Input type="number" step="0.1" value={margeBrute} onChange={e => setMargeBrute(e.target.value)} placeholder="35.5" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Effectifs total</Label>
              <Input type="number" value={effectifs} onChange={e => setEffectifs(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Commentaire / faits marquants</Label>
            <Textarea
              rows={3}
              value={narrative}
              onChange={e => setNarrative(e.target.value)}
              placeholder="Recrutement DAF effectif. Concurrent X a baissé ses prix de 10%. Saisonnalité défavorable au Q2."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting || !period.trim() || !periodStart || !periodEnd}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ajouter & analyser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
