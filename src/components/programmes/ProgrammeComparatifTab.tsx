import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  programmeId: string;
}

export default function ProgrammeComparatifTab({ programmeId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: res, error } = await supabase.functions.invoke('compare-enterprises', {
        body: { programme_id: programmeId }
      });
      if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      else setData(res);
      setLoading(false);
    })();
  }, [programmeId]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-8">Aucune donnée disponible.</p>;

  const enterprises = data.enterprises || data.comparison || [];
  const radarData = data.radar_data || [];

  return (
    <div className="space-y-6">
      {/* Radar chart */}
      {radarData.length > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-4">Comparaison radar</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              {enterprises.slice(0, 5).map((e: any, i: number) => (
                <Radar key={e.id || i} name={e.name} dataKey={e.name || `ent_${i}`}
                  stroke={['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'][i]}
                  fill={['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'][i]}
                  fillOpacity={0.1} />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}

      {/* Comparison table */}
      <Card><CardContent className="p-5">
        <h3 className="font-semibold mb-3">Tableau comparatif</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Score IR</TableHead>
              <TableHead>CA</TableHead>
              <TableHead>Marge brute</TableHead>
              <TableHead>Employés</TableHead>
              <TableHead>Secteur</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {enterprises.map((e: any, i: number) => (
                <TableRow key={e.id || i}>
                  <TableCell className="font-medium">{e.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      (e.score_ir ?? 0) >= 70 ? 'border-emerald-300 text-emerald-700' :
                      (e.score_ir ?? 0) >= 40 ? 'border-amber-300 text-amber-700' :
                      'border-red-300 text-red-700'
                    }>{e.score_ir ?? '—'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.revenue ? `${(e.revenue / 1e6).toFixed(0)}M` : '—'}</TableCell>
                  <TableCell className="text-sm">{e.gross_margin ? `${(e.gross_margin * 100).toFixed(0)}%` : '—'}</TableCell>
                  <TableCell className="text-sm">{e.employees_count ?? '—'}</TableCell>
                  <TableCell className="text-sm">{e.sector || '—'}</TableCell>
                </TableRow>
              ))}
              {enterprises.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune entreprise à comparer</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    </div>
  );
}
