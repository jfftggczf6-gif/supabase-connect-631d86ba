import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export default function FundingMatchTab() {
  const { t } = useTranslation();
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<string>('');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    supabase.from('enterprises').select('id, name, country, sector, score_ir').order('name').then(({ data }) => {
      setEnterprises(data || []);
    });
  }, []);

  const runMatching = async () => {
    if (!selectedEnterprise) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('match-funding', {
        body: { enterprise_id: selectedEnterprise },
      });
      if (error) throw error;
      setMatches(data.matches || []);
      setSummary(data);
      toast.success(`${data.matches?.length || 0} programmes analysés`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur matching');
    } finally {
      setLoading(false);
    }
  };

  const matchColor = (score: number) =>
    score >= 70 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    score >= 40 ? 'bg-amber-100 text-amber-700 border-amber-200' :
    'bg-red-100 text-red-700 border-red-200';

  const matchLabel = (score: number) =>
    score >= 70 ? 'Éligible' : score >= 40 ? 'Conditionnel' : 'Non éligible';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedEnterprise} onValueChange={setSelectedEnterprise}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Sélectionner une entreprise" />
          </SelectTrigger>
          <SelectContent>
            {enterprises.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.name} — {e.country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={runMatching} disabled={!selectedEnterprise || loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Lancer le matching
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{summary.total_programs}</p>
            <p className="text-xs text-muted-foreground">Programmes</p>
          </CardContent></Card>
          <Card className="border-emerald-200"><CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{summary.eligible}</p>
            <p className="text-xs text-muted-foreground">Éligibles</p>
          </CardContent></Card>
          <Card className="border-amber-200"><CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{summary.conditionnel}</p>
            <p className="text-xs text-muted-foreground">Conditionnels</p>
          </CardContent></Card>
          <Card className="border-red-200"><CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.non_eligible}</p>
            <p className="text-xs text-muted-foreground">Non éligibles</p>
          </CardContent></Card>
        </div>
      )}

      {matches.map((m, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-sm font-bold border ${matchColor(m.match_score)}`}>
                {m.match_score}%
              </div>
              <div>
                <CardTitle className="text-sm">{m.program_name}</CardTitle>
                <p className="text-xs text-muted-foreground">{m.organisme} — {m.ticket}</p>
              </div>
            </div>
            <Badge className={matchColor(m.match_score)}>{matchLabel(m.match_score)}</Badge>
          </CardHeader>
          <CardContent className="py-3 space-y-2">
            <Progress value={m.match_score} className="h-2" />
            <div className="flex flex-wrap gap-1.5">
              {m.type_financement?.map((t: string, j: number) => (
                <Badge key={j} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
            {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}

            <div className="grid grid-cols-2 gap-3 mt-2">
              {m.criteria_met.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-emerald-600 mb-1">Critères remplis</p>
                  {m.criteria_met.map((c: string, j: number) => (
                    <p key={j} className="text-[11px] flex items-start gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-none" />{c}</p>
                  ))}
                </div>
              )}
              {m.criteria_missing.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-red-600 mb-1">Ce qui manque</p>
                  {m.criteria_missing.map((c: string, j: number) => (
                    <p key={j} className="text-[11px] flex items-start gap-1"><XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-none" />{c}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
