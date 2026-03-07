import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Building2, CheckCircle2, Clock, ChevronRight, LayoutGrid, Globe, BarChart3, Stethoscope, ListChecks, FileText, Target, Download, Sparkles, Loader2, X } from 'lucide-react';
import BmcViewer from './BmcViewer';
import DeliverableViewer from './DeliverableViewer';
import { toast } from 'sonner';

const MODULE_CONFIG = [
  { code: 'bmc' as const, title: 'Business Model Canvas', icon: LayoutGrid },
  { code: 'sic' as const, title: 'Social Impact Canvas', icon: Globe },
  { code: 'framework' as const, title: 'Plan Financier Intermédiaire', icon: BarChart3 },
  { code: 'diagnostic' as const, title: 'Diagnostic Expert', icon: Stethoscope },
  { code: 'plan_ovo' as const, title: 'Plan Financier Final', icon: ListChecks },
  { code: 'business_plan' as const, title: 'Business Plan', icon: FileText },
  { code: 'odd' as const, title: 'Due Diligence ODD', icon: Target },
];

const DELIV_MAP: Record<string, string> = {
  bmc: 'bmc_analysis', sic: 'sic_analysis',
  framework: 'framework_data', diagnostic: 'diagnostic_data',
  plan_ovo: 'plan_ovo', business_plan: 'business_plan', odd: 'odd_analysis',
};

export default function CoachDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [modulesMap, setModulesMap] = useState<Record<string, any[]>>({});
  const [deliverablesMap, setDeliverablesMap] = useState<Record<string, any[]>>({});
  const [selectedEnterprise, setSelectedEnterprise] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<string>('bmc');
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('enterprises').select('*').eq('coach_id', user.id);
    setEnterprises(data || []);

    if (data && data.length > 0) {
      const ids = data.map(e => e.id);
      const [modsRes, delivsRes] = await Promise.all([
        supabase.from('enterprise_modules').select('*').in('enterprise_id', ids),
        supabase.from('deliverables').select('*').in('enterprise_id', ids),
      ]);

      const modMap: Record<string, any[]> = {};
      (modsRes.data || []).forEach(m => {
        if (!modMap[m.enterprise_id]) modMap[m.enterprise_id] = [];
        modMap[m.enterprise_id].push(m);
      });
      setModulesMap(modMap);

      const delMap: Record<string, any[]> = {};
      (delivsRes.data || []).forEach(d => {
        if (!delMap[d.enterprise_id]) delMap[d.enterprise_id] = [];
        delMap[d.enterprise_id].push(d);
      });
      setDeliverablesMap(delMap);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalEntreprises = enterprises.length;
  const completedModules = Object.values(modulesMap).flat().filter(m => m.status === 'completed').length;
  const totalModules = Object.values(modulesMap).flat().length;

  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  const PIPELINE = [
    { name: "BMC", fn: "generate-bmc", type: "bmc_analysis" },
    { name: "SIC", fn: "generate-sic", type: "sic_analysis" },
    { name: "Inputs", fn: "generate-inputs", type: "inputs_data" },
    { name: "Framework", fn: "generate-framework", type: "framework_data" },
    { name: "Diagnostic", fn: "generate-diagnostic", type: "diagnostic_data" },
    { name: "Plan OVO", fn: "generate-plan-ovo", type: "plan_ovo" },
    { name: "Business Plan", fn: "generate-business-plan", type: "business_plan" },
    { name: "ODD", fn: "generate-odd", type: "odd_analysis" },
  ];

  const handleGenerateAll = async (enterpriseId: string, force = false) => {
    setGenerating(true);
    let completed = 0;
    const scores: number[] = [];
    const errors: string[] = [];
    const delivs = deliverablesMap[enterpriseId] || [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      for (let i = 0; i < PIPELINE.length; i++) {
        const step = PIPELINE[i];
        setGenerationProgress({ current: i + 1, total: PIPELINE.length, name: step.name });

        const existing = delivs.find((d: any) => d.type === step.type);
        if (!force && existing?.data && typeof existing.data === 'object' && Object.keys(existing.data as object).length > 0) {
          completed++;
          if (existing.score) scores.push(existing.score);
          continue;
        }

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${step.fn}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ enterprise_id: enterpriseId }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            completed++;
            if (result.score) scores.push(result.score);
          } else {
            const err = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
            if (response.status === 402) {
              toast.error("Crédits IA insuffisants.");
              break;
            }
            errors.push(`${step.name}: ${err.error || 'Erreur'}`);
          }
        } catch (e: any) {
          errors.push(`${step.name}: ${e.message || 'Erreur réseau'}`);
        }
      }

      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      toast.success(`${completed} livrables générés ! Score: ${avgScore}/100`);
      if (errors.length > 0) toast.warning(`${errors.length} module(s) en erreur`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  };

  const handleDownload = async (type: string, enterpriseId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterpriseId}&format=html`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error('Erreur');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Téléchargé !');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Enterprise detail view
  if (selectedEnterprise) {
    const ent = selectedEnterprise;
    const mods = modulesMap[ent.id] || [];
    const delivs = deliverablesMap[ent.id] || [];
    const getDeliverable = (type: string) => delivs.find(d => d.type === type);
    const getModuleData = (code: string) => {
      const mod = mods.find(m => m.module === code);
      return { status: mod?.status || 'not_started', progress: mod?.progress || 0 };
    };

    const delivType = DELIV_MAP[selectedModule];
    const deliv = delivType ? getDeliverable(delivType) : null;

    return (
      <DashboardLayout
        title={ent.name}
        subtitle={`${ent.sector || 'Secteur non défini'} • ${ent.city || ''} ${ent.country || ''}`}
      >
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => setSelectedEnterprise(null)}>
          ← Retour à la liste
        </Button>

        {/* Module tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 border-b">
          {MODULE_CONFIG.map(mod => {
            const data = getModuleData(mod.code);
            const Icon = mod.icon;
            const isSelected = selectedModule === mod.code;
            return (
              <button
                key={mod.code}
                onClick={() => setSelectedModule(mod.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all whitespace-nowrap ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>{mod.title}</span>
                {data.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-success" />}
              </button>
            );
          })}
        </div>

        {/* Module content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {selectedModule === 'bmc' && deliv?.data && typeof deliv.data === 'object' ? (
              <BmcViewer data={deliv.data} />
            ) : deliv?.data && typeof deliv.data === 'object' ? (
              <DeliverableViewer moduleCode={selectedModule} data={deliv.data} />
            ) : (
              <Card className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground mb-4">Aucune donnée générée pour ce module.</p>
                <Button onClick={() => handleGenerateAll(ent.id)} disabled={generating} className="gap-2">
                  {generating && generationProgress ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {generationProgress.name} ({generationProgress.current}/{generationProgress.total})...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Générer tous les livrables</>
                  )}
                </Button>
              </Card>
            )}
          </div>

          {/* Right: downloads */}
          <div className="space-y-2">
            <h3 className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground mb-2">Livrables</h3>
            {Object.entries(DELIV_MAP).map(([code, type]) => {
              const d = getDeliverable(type);
              const mod = MODULE_CONFIG.find(m => m.code === code);
              return (
                <div
                  key={type}
                  onClick={() => d && handleDownload(type, ent.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs ${
                    d ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-50'
                  }`}
                >
                  <span className="font-medium">{mod?.title || type}</span>
                  {d ? (
                    <div className="flex items-center gap-1">
                      <Badge variant="default" className="text-[9px] bg-success/10 text-success border-success/20">
                        {d.score ? `${d.score}/100` : 'Prêt'}
                      </Badge>
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[9px]">—</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // List view
  return (
    <DashboardLayout
      title={`Bonjour, ${profile?.full_name || 'Coach'} 👋`}
      subtitle="Tableau de bord de coaching"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} color="primary" value={totalEntreprises} label="Entrepreneurs" />
        <StatCard icon={CheckCircle2} color="success" value={completedModules} label="Modules terminés" />
        <StatCard icon={Clock} color="warning" value={totalModules - completedModules} label="En attente" />
        <StatCard icon={Building2} color="info" value={totalModules > 0 ? `${Math.round((completedModules / totalModules) * 100)}%` : '0%'} label="Progression" />
      </div>

      {/* Entrepreneurs list */}
      <h2 className="text-lg font-display font-semibold mb-4">Vos entrepreneurs</h2>
      {enterprises.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>Aucun entrepreneur assigné pour le moment.</p>
            <p className="text-sm mt-1">Les entrepreneurs vous seront assignés par l'administrateur.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {enterprises.map(ent => {
            const mods = modulesMap[ent.id] || [];
            const delivs = deliverablesMap[ent.id] || [];
            const completed = mods.filter(m => m.status === 'completed').length;
            const total = mods.length || 8;
            const pct = Math.round((completed / total) * 100);
            const avgScore = delivs.length > 0
              ? Math.round(delivs.reduce((s: number, d: any) => s + (d.score || 0), 0) / delivs.length)
              : 0;

            return (
              <Card
                key={ent.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { setSelectedEnterprise(ent); setSelectedModule('bmc'); }}
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">{ent.name}</h3>
                      <p className="text-sm text-muted-foreground">{ent.sector || 'Secteur non défini'} • {ent.city || ent.country || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {avgScore > 0 && (
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground">Score</p>
                        <p className="text-sm font-bold">{avgScore}/100</p>
                      </div>
                    )}
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">{completed}/{total} modules</p>
                      <Progress value={pct} className="h-1.5 w-24 mt-1" />
                    </div>
                    <Badge variant={pct === 100 ? 'default' : 'outline'}>{pct}%</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, color, value, label }: { icon: any; color: string; value: any; label: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg bg-${color}/10 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 text-${color}`} />
        </div>
        <div>
          <p className="text-2xl font-display font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
