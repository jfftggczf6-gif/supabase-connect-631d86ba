import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Users, TrendingUp, AlertTriangle, CheckCircle2, BarChart3, UserCheck, ChevronRight, Clock, Activity, Bot, Pencil, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Area, AreaChart } from 'recharts';

interface Props {
  programmeId: string;
}

export default function ProgrammeDashboardTab({ programmeId }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showCoach, setShowCoach] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: res, error } = await supabase.functions.invoke('get-programme-dashboard', {
        body: { programme_id: programmeId }
      });
      if (error) { toast.error(error.message || 'Erreur chargement dashboard'); }
      else { setData(res); }
      setLoading(false);
    })();
  }, [programmeId]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-8">{t('common.no_data')}</p>;

  const kpis = data.kpis || {};
  const distribution = data.score_distribution || [];
  const enterprises = data.enterprises || [];
  const byCoach = data.by_coach || [];
  const modulesCompletion = kpis.modules_completion || {};
  const scoreEvolution = data.score_evolution || [];
  const activite7j = data.activite_7j || { par_jour: {}, totaux: { generations: 0, corrections: 0, notes_coaching: 0 } };
  const activiteRecente = data.activite_recente || [];

  // Collect all alerts from enterprises
  const allAlerts: any[] = [];
  for (const e of enterprises) {
    for (const a of (e.alerts || [])) {
      allAlerts.push({ ...a, enterprise_name: e.name, enterprise_id: e.id });
    }
  }

  const COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#22c55e'];

  const completionColor = (pct: number) =>
    pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{kpis.total_selected ?? 0}</p>
          <p className="text-xs text-muted-foreground">{t('dashboard_programme.enterprises_short')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold">{kpis.score_ir_moyen ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{t('dashboard_programme.score_avg')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="h-5 w-5 mx-auto text-violet-500 mb-1" />
          <p className="text-2xl font-bold">{kpis.pipeline_completion_pct ?? 0}%</p>
          <p className="text-xs text-muted-foreground">{t('dashboard_programme.completion')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-purple-500 mb-1" />
          <p className="text-2xl font-bold">{kpis.coaching_notes_count ?? 0}</p>
          <p className="text-xs text-muted-foreground">{t('dashboard_programme.coaching_notes')}</p>
        </CardContent></Card>
        <Card className="cursor-pointer hover:ring-2 ring-amber-300 transition-all" onClick={() => setShowAlerts(true)}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{kpis.alerts_count ?? allAlerts.length}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard_programme.alerts')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tableau entreprises (EN PREMIER — c'est ce que le chef cherche) */}
      <Card><CardContent className="p-5">
        <h3 className="font-semibold mb-3">{t('dashboard_programme.enterprises')}</h3>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('dashboard_programme.enterprises_short')}</TableHead>
            <TableHead>{t('dashboard_programme.coach')}</TableHead>
            <TableHead>{t('dashboard_programme.score_ir')}</TableHead>
            <TableHead>{t('dashboard_programme.progression')}</TableHead>
            <TableHead>{t('dashboard_programme.phase')}</TableHead>
            <TableHead>{t('dashboard_programme.alerts')}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {enterprises.map((e: any) => {
              const progress = e.modules_total > 0 ? Math.round((e.modules_completed / e.modules_total) * 100) : 0;
              return (
                <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/programmes/${programmeId}/enterprise/${e.id}`)}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-sm">{e.coach_name || '—'}</TableCell>
                  <TableCell>
                    {e.score_ir != null && e.score_ir > 0 ? (
                      <Badge variant="outline" className={
                        e.score_ir >= 70 ? 'border-emerald-300 text-emerald-700' :
                        e.score_ir >= 40 ? 'border-amber-300 text-amber-700' :
                        'border-red-300 text-red-700'
                      }>{e.score_ir}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-1.5 w-20" />
                      <span className="text-xs text-muted-foreground">{progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{(e.phase || '—').replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell>
                    {e.alerts?.length > 0 && (
                      <Badge variant="destructive" className="text-xs">{e.alerts.length}</Badge>
                    )}
                  </TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Par coach */}
      {byCoach.length > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-3">{t('dashboard_programme.by_coach')}</h3>
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t('dashboard_programme.coach')}</TableHead>
              <TableHead>{t('dashboard_programme.enterprises_short')}</TableHead>
              <TableHead>{t('dashboard_programme.score_avg')}</TableHead>
              <TableHead>{t('dashboard_programme.completion')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {byCoach.map((c: any) => (
                <TableRow key={c.coach_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setShowCoach(c)}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    {c.coach_name}
                  </TableCell>
                  <TableCell>{c.enterprises_count}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      c.avg_score >= 70 ? 'border-emerald-300 text-emerald-700' :
                      c.avg_score >= 40 ? 'border-amber-300 text-amber-700' :
                      'border-red-300 text-red-700'
                    }>{c.avg_score}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={c.avg_completion ?? 0} className="h-1.5 w-20" />
                      <span className="text-xs text-muted-foreground">{c.avg_completion ?? 0}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {/* Analytics (dépliable) */}
      <details>
        <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" /> {t('dashboard_programme.analytics')}
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Complétion par module */}
            <Card><CardContent className="p-5">
              <h3 className="font-semibold mb-4">{t('dashboard_programme.module_completion')}</h3>
              <div className="space-y-3">
                {Object.entries(modulesCompletion).map(([mod, stats]: [string, any]) => {
                  const total = (stats.completed || 0) + (stats.in_progress || 0) + (stats.not_started || 0);
                  const pct = total > 0 ? Math.round((stats.completed / total) * 100) : 0;
                  return (
                    <div key={mod} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-28 truncate">{mod.replace(/_/g, ' ')}</span>
                      <div className="flex-1"><Progress value={pct} className={`h-2 ${completionColor(pct)}`} /></div>
                      <span className="text-xs text-muted-foreground w-16 text-right">{stats.completed}/{total} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </CardContent></Card>
            {/* Distribution des scores */}
            <Card><CardContent className="p-5">
              <h3 className="font-semibold mb-4">{t('dashboard_programme.score_distribution')}</h3>
              {distribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={distribution}>
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard_programme.no_scores_yet')}</p>}
            </CardContent></Card>
          </div>
          {/* Évolution score */}
          {scoreEvolution.length > 0 && (
            <Card><CardContent className="p-5">
              <h3 className="font-semibold mb-4">{t('dashboard_programme.score_evolution')}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={scoreEvolution}>
                  <XAxis dataKey="semaine" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${v}/100`} />
                  <Area type="monotone" dataKey="min" stackId="range" stroke="none" fill="#e5e7eb" />
                  <Area type="monotone" dataKey="max" stackId="range2" stroke="none" fill="#dbeafe" fillOpacity={0.4} />
                  <Line type="monotone" dataKey="score_moyen" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name={t('dashboard_programme.score_avg_label')} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent></Card>
          )}
          {/* Activité 7j + récente */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5">
              <h3 className="font-semibold mb-3">{t('dashboard_programme.activity_7d')}</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-muted/50 rounded">
                  <Bot className="h-3.5 w-3.5 mx-auto text-violet-500 mb-0.5" />
                  <p className="text-lg font-bold">{activite7j.totaux.generations}</p>
                  <p className="text-[10px] text-muted-foreground">{t('dashboard_programme.generations')}</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <Pencil className="h-3.5 w-3.5 mx-auto text-amber-500 mb-0.5" />
                  <p className="text-lg font-bold">{activite7j.totaux.corrections}</p>
                  <p className="text-[10px] text-muted-foreground">{t('dashboard_programme.corrections')}</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <MessageSquare className="h-3.5 w-3.5 mx-auto text-purple-500 mb-0.5" />
                  <p className="text-lg font-bold">{activite7j.totaux.notes_coaching}</p>
                  <p className="text-[10px] text-muted-foreground">{t('dashboard_programme.notes')}</p>
                </div>
              </div>
              {Object.keys(activite7j.par_jour).length > 0 && (
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={Object.entries(activite7j.par_jour).sort().map(([d, c]) => ({ jour: d.slice(5), count: c }))}>
                    <XAxis dataKey="jour" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Actions" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <h3 className="font-semibold mb-3">{t('dashboard_programme.recent_activity')}</h3>
              {activiteRecente.length > 0 ? (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {activiteRecente.map((a: any, i: number) => {
                    const ago = Math.floor((Date.now() - new Date(a.date).getTime()) / 3600000);
                    const agoStr = ago < 1 ? '<1h' : ago < 24 ? `${ago}h` : `${Math.floor(ago / 24)}j`;
                    const icon = a.action === 'generate' ? '🤖' : a.action === 'edit_section' ? '✏️' : a.action === 'coaching_note' ? '📝' : '📎';
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
                        <span className="text-muted-foreground w-8 shrink-0 text-right">{agoStr}</span>
                        <span>{icon}</span>
                        <span className="font-medium truncate">{a.enterprise}</span>
                        {a.type && <span className="text-muted-foreground">{a.type.replace(/_/g, ' ')}</span>}
                        {a.score && <Badge variant="outline" className="text-[9px]">{a.score}</Badge>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">{t('dashboard_programme.no_recent')}</p>}
            </CardContent></Card>
          </div>
        </div>
      </details>

      {/* Modal alertes */}
      <Dialog open={showAlerts} onOpenChange={setShowAlerts}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('dashboard_programme.alerts_title')}</DialogTitle></DialogHeader>
          {allAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('dashboard_programme.no_alerts')}</p>
          ) : (
            <div className="space-y-2">
              {allAlerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm p-3 rounded border ${
                  a.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <span className="font-medium">{a.enterprise_name}</span>
                    <span className="text-muted-foreground"> — {a.message}</span>
                    {a.type && <Badge variant="outline" className="ml-2 text-[10px]">{a.type}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal coach portfolio */}
      <Dialog open={!!showCoach} onOpenChange={() => setShowCoach(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('dashboard_programme.portfolio')} — {showCoach?.coach_name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center"><p className="text-xl font-bold">{showCoach?.enterprises_count}</p><p className="text-xs text-muted-foreground">{t('dashboard_programme.enterprises_short')}</p></div>
            <div className="text-center"><p className="text-xl font-bold">{showCoach?.avg_score}</p><p className="text-xs text-muted-foreground">{t('dashboard_programme.score_avg')}</p></div>
            <div className="text-center"><p className="text-xl font-bold">{showCoach?.avg_completion}%</p><p className="text-xs text-muted-foreground">{t('dashboard_programme.completion')}</p></div>
          </div>
          <div className="space-y-2">
            {enterprises.filter((e: any) => e.coach_id === showCoach?.coach_id).map((e: any) => {
              const progress = e.modules_total > 0 ? Math.round((e.modules_completed / e.modules_total) * 100) : 0;
              return (
                <div key={e.id} className="flex items-center justify-between p-3 rounded border cursor-pointer hover:bg-muted/50"
                     onClick={() => { setShowCoach(null); navigate(`/programmes/${programmeId}/enterprise/${e.id}`); }}>
                  <div>
                    <p className="font-medium text-sm">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{(e.phase || '').replace(/_/g, ' ')} — Score {e.score_ir || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="h-1.5 w-16" />
                    <span className="text-xs">{progress}%</span>
                    {e.alerts?.length > 0 && <Badge variant="destructive" className="text-xs">{e.alerts.length}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
