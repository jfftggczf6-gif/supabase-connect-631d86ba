import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Users, Leaf, Handshake, Download, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface Props {
  programmeId: string;
}

interface OvoKPI {
  kpi_code: string;
  kpi_name: string;
  sdg: number;
  value: number;
  baseline: number | null;
  delta_pct: number | null;
  unit: string;
}

interface ODDCoverage {
  sdg_number: number;
  sdg_name: string;
  enterprises_count: number;
  avg_score: number;
}

const KPI_ICONS: Record<string, any> = {
  decent_jobs_total: Users,
  decent_jobs_women: Users,
  decent_jobs_youth: Users,
  gross_margin_per_employee: TrendingUp,
  waste_reduction: Leaf,
  partnerships_taxes: Handshake,
};

const SDG_COLORS: Record<number, string> = {
  1: '#E5243B', 2: '#DDA63A', 3: '#4C9F38', 4: '#C5192D', 5: '#FF3A21',
  6: '#26BDE2', 7: '#FCC30B', 8: '#A21942', 9: '#FD6925', 10: '#DD1367',
  11: '#FD9D24', 12: '#BF8B2E', 13: '#3F7E44', 14: '#0A97D9', 15: '#56C02B',
  16: '#00689D', 17: '#19486A',
};

export default function ProgrammeODDPortfolioTab({ programmeId }: Props) {
  const [kpis, setKpis] = useState<OvoKPI[]>([]);
  const [oddCoverage, setOddCoverage] = useState<ODDCoverage[]>([]);
  const [enterprisesCount, setEnterprisesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = await getValidAccessToken(null);
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-portfolio-odd-dashboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ programme_id: programmeId }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
        setKpis(data.kpis || []);
        setOddCoverage(data.odd_coverage || []);
        setEnterprisesCount(data.enterprises_count || 0);
      } catch (err: any) {
        toast.error(err.message);
      }
      setLoading(false);
    })();
  }, [programmeId]);

  const handleExportPDF = () => {
    toast.info('Export PDF en cours de développement');
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const fmtDelta = (d: number | null) => {
    if (d === null || d === undefined) return '—';
    const sign = d >= 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}%`;
  };

  const fmtValue = (v: number, unit: string) => {
    if (unit === 'EUR' || unit === 'FCFA') {
      if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M ${unit}`;
      if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K ${unit}`;
      return `${v.toLocaleString()} ${unit}`;
    }
    return `${v.toLocaleString()} ${unit}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Impact ODD — Portfolio
          </h2>
          <p className="text-sm text-muted-foreground">{enterprisesCount} entreprises • Framework OVO Impact Frontiers</p>
        </div>
        <Button variant="outline" className="gap-2 border-primary/30 text-primary" onClick={handleExportPDF}>
          <Download className="h-4 w-4" /> Export rapport bailleur
        </Button>
      </div>

      {/* 6 OVO KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => {
          const Icon = KPI_ICONS[kpi.kpi_code] || TrendingUp;
          return (
            <Card key={kpi.kpi_code} className="border-primary/10">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-[9px]">ODD {kpi.sdg}</Badge>
                </div>
                <p className="text-xl font-bold">{fmtValue(kpi.value, kpi.unit)}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{kpi.kpi_name}</p>
                {kpi.delta_pct !== null && (
                  <p className={`text-xs font-medium ${kpi.delta_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmtDelta(kpi.delta_pct)} Y-o-Y
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ODD Coverage Chart */}
      {oddCoverage.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Couverture ODD — Nombre d'entreprises par objectif</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oddCoverage} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="sdg_number" tick={{ fontSize: 11 }} tickFormatter={v => `ODD ${v}`} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} entreprises`, 'Couverture']}
                  labelFormatter={(label: number) => {
                    const odd = oddCoverage.find(o => o.sdg_number === label);
                    return `ODD ${label}: ${odd?.sdg_name || ''}`;
                  }}
                />
                <Bar dataKey="enterprises_count" radius={[4, 4, 0, 0]}>
                  {oddCoverage.map((entry) => (
                    <Cell key={entry.sdg_number} fill={SDG_COLORS[entry.sdg_number] || '#7c3aed'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-enterprise ODD detail (I5) */}
      {kpis.length === 0 && oddCoverage.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Aucune donnée ODD disponible</p>
            <p className="text-sm mt-1">Les analyses ODD seront agrégées ici une fois générées pour les entreprises du programme.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
