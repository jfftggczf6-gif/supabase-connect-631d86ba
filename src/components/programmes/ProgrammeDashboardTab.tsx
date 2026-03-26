import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  programmeId: string;
}

export default function ProgrammeDashboardTab({ programmeId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: res, error } = await supabase.functions.invoke('get-programme-dashboard', {
        body: { programme_id: programmeId }
      });
      if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); }
      else { setData(res); }
      setLoading(false);
    })();
  }, [programmeId]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-8">Aucune donnée disponible.</p>;

  const kpis = data.kpis || {};
  const distribution = data.score_distribution || [];
  const alerts = data.alerts || [];
  const enterprises = data.enterprises || [];

  const COLORS = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{kpis.total_enterprises ?? 0}</p>
          <p className="text-xs text-muted-foreground">Entreprises</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold">{kpis.avg_score ?? '—'}</p>
          <p className="text-xs text-muted-foreground">Score moyen</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{kpis.completed_modules ?? 0}</p>
          <p className="text-xs text-muted-foreground">Modules complétés</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{alerts.length}</p>
          <p className="text-xs text-muted-foreground">Alertes</p>
        </CardContent></Card>
      </div>

      {/* Score distribution chart */}
      {distribution.length > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-4">Distribution des scores</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribution}>
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {distribution.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card><CardContent className="p-5 space-y-2">
          <h3 className="font-semibold">⚠️ Alertes</h3>
          {alerts.map((a: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">{a.enterprise_name || 'Entreprise'}</span>
                <span className="text-muted-foreground"> — {a.message}</span>
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}

      {/* Enterprises table */}
      {enterprises.length > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-3">Entreprises du programme</h3>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Coach</TableHead>
              <TableHead>Score IR</TableHead>
              <TableHead>Progression</TableHead>
              <TableHead>Phase</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {enterprises.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-sm">{e.coach_name || '—'}</TableCell>
                  <TableCell>
                    {e.score_ir != null ? (
                      <Badge variant="outline" className={
                        e.score_ir >= 70 ? 'border-emerald-300 text-emerald-700' :
                        e.score_ir >= 40 ? 'border-amber-300 text-amber-700' :
                        'border-red-300 text-red-700'
                      }>{e.score_ir}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={e.progress ?? 0} className="h-1.5 w-20" />
                      <span className="text-xs text-muted-foreground">{e.progress ?? 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{e.phase || '—'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
