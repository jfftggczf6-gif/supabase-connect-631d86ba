import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, Award, Users, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  programmeId: string;
}

type SortBy = 'score' | 'progression' | 'secteur' | 'coach';

export default function ProgrammeComparatifTab({ programmeId }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('score');

  const fetchData = async (sort: SortBy) => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke('compare-enterprises', {
      body: { programme_id: programmeId, sort_by: sort }
    });
    if (error) toast.error(error.message || 'Erreur');
    else setData(res);
    setLoading(false);
  };

  useEffect(() => { fetchData(sortBy); }, [programmeId, sortBy]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-8">Aucune donnée disponible.</p>;

  const comparatif = data.comparatif || [];
  const stats = data.stats_cohorte || {};
  const analyseIa = data.analyse_ia || '';

  const medal = (rang: number) => rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : `${rang}.`;

  return (
    <div className="space-y-6">
      {/* Stats cohorte */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold">+{stats.progression_moyenne ?? 0}</p>
          <p className="text-xs text-muted-foreground">Progression moyenne</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Award className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-lg font-bold">{stats.meilleur_secteur || '—'}</p>
          <p className="text-xs text-muted-foreground">Meilleur secteur</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-violet-600 mb-1" />
          <p className="text-lg font-bold">{stats.meilleur_coach || '—'}</p>
          <p className="text-xs text-muted-foreground">Top coach</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <ArrowUpRight className="h-5 w-5 mx-auto text-purple-500 mb-1" />
          <p className="text-2xl font-bold">{stats.nb_entreprises_ameliorees ?? 0}/{comparatif.length}</p>
          <p className="text-xs text-muted-foreground">En progression</p>
        </CardContent></Card>
      </div>

      {/* Tri */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Trier par :</span>
        {(['score', 'progression', 'secteur', 'coach'] as SortBy[]).map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sortBy === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {s === 'score' ? 'Score' : s === 'progression' ? 'Progression' : s === 'secteur' ? 'Secteur' : 'Coach'}
          </button>
        ))}
      </div>

      {/* Classement */}
      <Card><CardContent className="p-5">
        <h3 className="font-semibold mb-4">Classement cohorte</h3>
        <div className="space-y-3">
          {comparatif.map((e: any, i: number) => {
            const rang = i + 1;
            const maxScore = 100;
            const initialPct = (e.score_initial / maxScore) * 100;
            const progressionPct = Math.max(0, ((e.score_final - e.score_initial) / maxScore) * 100);
            return (
              <div key={e.enterprise_id || i} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <span className="text-lg w-8 text-center">{medal(rang)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{e.enterprise || e.enterprise_name || '—'}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{e.sector || ''}</span>
                      {e.coach && <Badge variant="outline" className="text-[10px]">{e.coach}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-gray-300 rounded-l-full" style={{ width: `${initialPct}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${progressionPct}%` }} />
                    </div>
                    <span className="text-xs font-medium whitespace-nowrap">
                      {e.score_initial ?? '—'} → {e.score_final ?? '—'}
                      {e.progression > 0 && <span className="text-emerald-600 ml-1">(+{e.progression})</span>}
                      {e.progression < 0 && <span className="text-red-600 ml-1">({e.progression})</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>{e.modules_completed}/{e.modules_total} modules</span>
                    <span>{e.completion_pct}% complet</span>
                    {e.kpis?.ca > 0 && <span>CA {(e.kpis.ca / 1e6).toFixed(0)}M</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {comparatif.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Aucune entreprise à comparer</p>
          )}
        </div>
      </CardContent></Card>

      {/* Analyse IA */}
      {analyseIa && (
        <Card className="bg-violet-50/50 border-violet-200"><CardContent className="p-5">
          <h3 className="font-semibold text-violet-900 mb-2">Analyse comparative</h3>
          <p className="text-sm text-violet-600 leading-relaxed">{analyseIa}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
