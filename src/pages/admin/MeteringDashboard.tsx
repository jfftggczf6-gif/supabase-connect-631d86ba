import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, Zap, Building2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface MeteringSummary {
  organization_id: string; organization_name: string; organization_type: string;
  total_cost: number; call_count: number; enterprise_count: number;
  avg_cost_per_enterprise: number; avg_cost_per_call: number;
}

export default function MeteringDashboard() {
  const [data, setData] = useState<MeteringSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const fetchData = async () => {
    setLoading(true);
    const days = parseInt(period);
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();

    const { data: result, error } = await supabase.rpc('get_metering_summary', {
      period_start: start, period_end: end, org_filter: null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      setData((result || []) as MeteringSummary[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [period]);

  const totalCost = data.reduce((s, d) => s + Number(d.total_cost), 0);
  const totalCalls = data.reduce((s, d) => s + Number(d.call_count), 0);
  const totalEnterprises = data.reduce((s, d) => s + Number(d.enterprise_count), 0);

  return (
    <DashboardLayout title="Metering IA" subtitle="Consommation par organisation">
      <div className="flex justify-end mb-6">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 jours</SelectItem>
            <SelectItem value="30">30 jours</SelectItem>
            <SelectItem value="90">90 jours</SelectItem>
            <SelectItem value="180">6 mois</SelectItem>
            <SelectItem value="365">1 an</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Coût total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCalls.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Appels IA</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalEnterprises}</p>
              <p className="text-xs text-muted-foreground">Entreprises</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalEnterprises > 0 ? (totalCost / totalEnterprises).toFixed(2) : '0'}</p>
              <p className="text-xs text-muted-foreground">Coût / entreprise</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau par org */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Consommation par organisation</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Coût USD</TableHead>
                  <TableHead className="text-right">Appels</TableHead>
                  <TableHead className="text-right">Entreprises</TableHead>
                  <TableHead className="text-right">$/entreprise</TableHead>
                  <TableHead className="text-right">$/appel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(d => (
                  <TableRow key={d.organization_id}>
                    <TableCell className="font-medium">{d.organization_name}</TableCell>
                    <TableCell><Badge variant="outline">{d.organization_type}</Badge></TableCell>
                    <TableCell className="text-right font-mono">${Number(d.total_cost).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(d.call_count).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{d.enterprise_count}</TableCell>
                    <TableCell className="text-right font-mono">${Number(d.avg_cost_per_enterprise).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">${Number(d.avg_cost_per_call).toFixed(4)}</TableCell>
                  </TableRow>
                ))}
                {!data.length && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune donnée pour cette période</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
