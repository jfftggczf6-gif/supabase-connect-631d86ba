import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, TrendingUp, Wand2 } from 'lucide-react';
import { PHASES, type Enterprise, type Deliverable, type EnterpriseModule } from '@/lib/dashboard-config';
import ActivityTimeline from './ActivityTimeline';

interface OverviewProps {
  enterprise: Enterprise;
  deliverables: Deliverable[];
  modules: EnterpriseModule[];
  globalScore: number;
  onSelectModule: (code: string) => void;
}

const DELIV_TYPE_MAP: Record<string, string> = {
  bmc: 'bmc_analysis', sic: 'sic_analysis', inputs: 'inputs_data', framework: 'framework_data',
  diagnostic: 'diagnostic_data', plan_ovo: 'plan_ovo', business_plan: 'business_plan', odd: 'odd_analysis',
  screening: 'screening_report', pre_screening: 'pre_screening',
  valuation: 'valuation', onepager: 'onepager', investment_memo: 'investment_memo',
};

export default function DashboardOverview({ enterprise, deliverables, modules, globalScore, onSelectModule }: OverviewProps) {
  const getModuleStatus = (code: string) => {
    if (code === 'upload' || code === 'reconstruction') return deliverables.length > 0 ? 'completed' : 'not_started';
    const delivType = DELIV_TYPE_MAP[code];
    if (delivType && deliverables.some(d => d.type === delivType)) return 'completed';
    const mod = modules.find(m => m.module === code);
    return mod?.status || 'not_started';
  };

  const phaseProgress = PHASES.map(phase => {
    const total = phase.modules.length;
    const done = phase.modules.filter(m => getModuleStatus(m.code) === 'completed').length;
    return { ...phase, done, total, pct: Math.round((done / total) * 100) };
  });

  // Find next recommended step
  const nextStep = useMemo(() => {
    for (const phase of PHASES) {
      for (const mod of phase.modules) {
        if (getModuleStatus(mod.code) !== 'completed') {
          return { phase: phase.label, module: mod };
        }
      }
    }
    return null;
  }, [deliverables, modules]);

  // Top anomalies from pre-screening
  const preScreening = deliverables.find(d => d.type === 'pre_screening');
  const anomalies = useMemo(() => {
    if (!preScreening?.data || typeof preScreening.data !== 'object') return [];
    const data = preScreening.data as Record<string, any>;
    const anoms = data.anomalies || data.anomalies_detectees || [];
    if (!Array.isArray(anoms)) return [];
    return anoms.slice(0, 3).map((a: any) => ({
      title: typeof a === 'string' ? a : a.title || a.description || 'Anomalie',
      severity: typeof a === 'object' ? a.severity || 'attention' : 'attention',
    }));
  }, [preScreening]);

  // Reconstruction confidence from inputs_data deliverable
  const reconstructionConfidence = useMemo(() => {
    const inputsDeliv = deliverables.find(d => d.type === 'inputs_data');
    if (!inputsDeliv?.data || typeof inputsDeliv.data !== 'object') return null;
    const data = inputsDeliv.data as Record<string, any>;
    const score = data.score_confiance;
    if (typeof score !== 'number') return null;
    return {
      score,
      mode: (enterprise as any).operating_mode as string | null,
      hypotheses: data.reconstruction_report?.hypotheses as string[] | undefined,
      missingData: data.reconstruction_report?.donnees_manquantes as string[] | undefined,
    };
  }, [deliverables, enterprise]);

  const maturityLabel = globalScore >= 80 ? 'Excellent' : globalScore >= 60 ? 'Très bien' : globalScore >= 40 ? 'Moyen' : globalScore > 0 ? 'À améliorer' : '—';
  const scoreColor = globalScore >= 60 ? 'text-emerald-600' : globalScore >= 40 ? 'text-amber-600' : 'text-muted-foreground';

  const phaseColorBar: Record<string, string> = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Score hero */}
      <div className="flex items-center gap-6">
        <div className="relative h-28 w-28 flex-none">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={globalScore >= 60 ? 'hsl(var(--success))' : globalScore >= 40 ? 'hsl(45, 93%, 47%)' : 'hsl(var(--muted-foreground))'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(globalScore / 100) * 327} 327`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-display font-bold ${scoreColor}`}>{globalScore || '—'}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>
        <div>
          <h2 className="font-display font-bold text-xl">{enterprise.name}</h2>
          <p className="text-sm text-muted-foreground">{enterprise.sector || '—'} · {enterprise.country || '—'}</p>
          <Badge variant="outline" className="mt-2">
            <TrendingUp className="h-3 w-3 mr-1" />
            {maturityLabel}
          </Badge>
        </div>
      </div>

      {/* Reconstruction confidence indicator */}
      {reconstructionConfidence && (
        <Card className={`border ${reconstructionConfidence.score >= 70 ? 'border-emerald-200 bg-emerald-50/50' : reconstructionConfidence.score >= 40 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Wand2 className={`h-5 w-5 ${reconstructionConfidence.score >= 70 ? 'text-emerald-600' : reconstructionConfidence.score >= 40 ? 'text-amber-600' : 'text-red-600'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Confiance IA : {reconstructionConfidence.score}%</span>
                  {reconstructionConfidence.mode && (
                    <Badge variant="outline" className="text-[10px]">
                      {reconstructionConfidence.mode === 'due_diligence' ? 'Due Diligence' : 'Reconstruction'}
                    </Badge>
                  )}
                </div>
                {reconstructionConfidence.missingData && reconstructionConfidence.missingData.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Manque : {reconstructionConfidence.missingData.slice(0, 3).join(', ')}
                    {reconstructionConfidence.missingData.length > 3 && ` (+${reconstructionConfidence.missingData.length - 3})`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Progression par phase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {phaseProgress.map(phase => (
            <div key={phase.id} className="flex items-center gap-3">
              <span className="text-xs font-medium w-24 truncate">{phase.label}</span>
              <div className="flex-1 relative">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${phaseColorBar[phase.color] || 'bg-primary'}`}
                    style={{ width: `${phase.pct}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground w-10 text-right">{phase.done}/{phase.total}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Next step CTA */}
      {nextStep && (
        <Card className="border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => onSelectModule(nextStep.module.code)}>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <nextStep.module.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Prochaine étape recommandée</p>
              <p className="text-sm font-semibold">{nextStep.module.label}</p>
              <p className="text-[10px] text-muted-foreground">{nextStep.phase}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary" />
          </CardContent>
        </Card>
      )}

      {/* Anomalies from pre-screening */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Anomalies détectées (Pre-screening)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Badge
                  variant={a.severity === 'bloquant' ? 'destructive' : 'outline'}
                  className="text-[10px] flex-none"
                >
                  {a.severity}
                </Badge>
                <span className="text-muted-foreground">{a.title}</span>
              </div>
            ))}
            <button onClick={() => onSelectModule('pre_screening')} className="text-xs text-primary hover:underline mt-1">
              Voir le pre-screening complet →
            </button>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline enterpriseId={enterprise.id} limit={5} />
        </CardContent>
      </Card>
    </div>
  );
}
