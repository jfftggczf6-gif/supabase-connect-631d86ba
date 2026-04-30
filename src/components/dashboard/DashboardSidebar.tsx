import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sparkles, Loader2, CheckCircle2, Menu, X, Building2,
} from 'lucide-react';
import { PHASES, type Enterprise, type Deliverable, type EnterpriseModule, type PhaseConfig } from '@/lib/dashboard-config';

interface SidebarProps {
  enterprise: Enterprise;
  deliverables: Deliverable[];
  modules: EnterpriseModule[];
  selectedModule: string;
  onSelectModule: (code: string) => void;
  onGenerateAll: () => void;
  onStopGeneration?: () => void;
  generating: boolean;
  generationProgress?: { current: number; total: number; name: string } | null;
  globalScore: number;
  hideActions?: boolean;
  /**
   * Override les PHASES par défaut (programme). Permet aux segments banque/PE
   * de fournir leur propre découpage modules sans modifier ce composant.
   */
  phases?: PhaseConfig[];
  /**
   * Override le mapping module_code → deliverable_type pour le statut "completed".
   * Le défaut est DELIV_TYPE_MAP (programme).
   */
  deliverableTypeMap?: Record<string, string>;
}

const DELIV_TYPE_MAP: Record<string, string> = {
  bmc: 'bmc_analysis', sic: 'sic_analysis', inputs: 'inputs_data', framework: 'framework_data',
  diagnostic: 'diagnostic_data', plan_ovo: 'plan_ovo', plan_financier: 'plan_financier',
  business_plan: 'business_plan', odd: 'odd_analysis',
  screening: 'screening_report', pre_screening: 'pre_screening',
  valuation: 'valuation', onepager: 'onepager', investment_memo: 'investment_memo',
};

export default function DashboardSidebar({
  enterprise, deliverables, modules, selectedModule, onSelectModule,
  onGenerateAll, onStopGeneration, generating, generationProgress, globalScore: _globalScore,
  hideActions = false,
  phases: phasesProp,
  deliverableTypeMap: deliverableTypeMapProp,
}: SidebarProps) {
  const collapsed = false;
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const phasesToUse = phasesProp ?? PHASES;
  const delivMap = deliverableTypeMapProp ?? DELIV_TYPE_MAP;

  const getModuleStatus = (code: string): 'completed' | 'in_progress' | 'not_started' => {
    // Special modules
    if (code === 'upload' || code === 'reconstruction') {
      // Consider done if there are uploaded files (heuristic via deliverables)
      return deliverables.length > 0 ? 'completed' : 'not_started';
    }
    const delivType = delivMap[code];
    if (delivType) {
      const hasDeliv = deliverables.some(d => d.type === delivType);
      if (hasDeliv) return 'completed';
    }
    const mod = modules.find(m => m.module === code);
    return (mod?.status || 'not_started') as 'completed' | 'in_progress' | 'not_started';
  };

  const getPhaseProgress = (phase: PhaseConfig) => {
    const total = phase.modules.length;
    const done = phase.modules.filter(m => getModuleStatus(m.code) === 'completed').length;
    return { done, total };
  };

  const totalProgress = useMemo(() => {
    const allModules = phasesToUse.flatMap(p => p.modules);
    const done = allModules.filter(m => getModuleStatus(m.code) === 'completed').length;
    return Math.round((done / allModules.length) * 100);
  }, [deliverables, modules]);




  // Couleurs des phases — violet-600 partout pour cohérence avec landing
  const phaseColorMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    blue: 'text-violet-600 bg-violet-600/10',
    violet: 'text-violet-600 bg-violet-600/10',
    amber: 'text-amber-600 bg-amber-500/10',
  };

  const phaseAccentMap: Record<string, string> = {
    emerald: 'border-l-emerald-500',
    rose: 'border-l-rose-500',
    blue: 'border-l-violet-600',
    violet: 'border-l-violet-600',
    amber: 'border-l-amber-500',
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Enterprise header */}
      <button
        onClick={() => onSelectModule('overview')}
        className={cn(
          'p-3 border-b border-border text-left hover:bg-muted/50 transition-colors',
          selectedModule === 'overview' && 'bg-muted'
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : (
          <div>
            <span className="font-display font-bold text-sm truncate">{enterprise.name}</span>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {enterprise.sector || '—'} · {enterprise.country || '—'}
            </p>
            <Progress value={totalProgress} className="h-1.5 mt-2" />
            <p className="text-[10px] text-muted-foreground mt-1">{totalProgress}% complété</p>
          </div>
        )}
      </button>

      {/* Phases */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {phasesToUse.map((phase) => {
          const { done, total } = getPhaseProgress(phase);
          
          const colorClass = phaseColorMap[phase.color] || '';
          const accentClass = phaseAccentMap[phase.color] || '';
          const allDone = done === total;

          if (collapsed) {
            return (
              <div key={phase.id} className="py-1">
                <div className="h-px bg-border mx-2 mb-1" />
                {phase.modules.map(mod => {
                  const status = getModuleStatus(mod.code);
                  const isActive = selectedModule === mod.code;
                  const Icon = mod.icon;
                  return (
                    <Tooltip key={mod.code} delayDuration={100}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { onSelectModule(mod.code); if (isMobile) setMobileOpen(false); }}
                          className={cn(
                            'w-full flex items-center justify-center h-10 relative transition-colors',
                            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {status === 'completed' && (
                            <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        <p className="font-medium">{mod.label}</p>
                        <p className="text-muted-foreground">
                          {status === 'completed' ? '✅ Complété' : status === 'in_progress' ? '⏳ En cours' : '○ Non commencé'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={phase.id} className="py-0.5">
              <div
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider',
                  colorClass
                )}
              >
                <span className="flex-1 text-left">{phase.label}</span>
                {allDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <span className="text-[10px] font-normal opacity-70">{done}/{total}</span>
                )}
              </div>

              <div className="pb-1">
                {phase.modules.map(mod => {
                  const status = getModuleStatus(mod.code);
                  const isActive = selectedModule === mod.code;
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.code}
                      onClick={() => { onSelectModule(mod.code); if (isMobile) setMobileOpen(false); }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors border-l-2',
                        isActive
                          ? `bg-primary/10 text-primary font-medium ${accentClass}`
                          : `border-l-transparent hover:bg-muted/50 ${status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}`
                      )}
                    >
                      <Icon className="h-4 w-4 flex-none" />
                      <span className="flex-1 text-left truncate text-xs">{mod.label}</span>
                      {status === 'completed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-none" />
                      ) : status === 'in_progress' ? (
                        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin flex-none" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Generate buttons moved to action bar in EntrepreneurDashboard */}
    </div>
  );

  // Mobile: drawer overlay
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-[3.75rem] left-2 z-50 h-8 w-8 rounded-md bg-card border border-border flex items-center justify-center shadow-sm"
        >
          <Menu className="h-4 w-4" />
        </button>
        {mobileOpen && (
          <>
            <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setMobileOpen(false)} />
            <div className="fixed top-0 left-0 bottom-0 w-[260px] bg-card border-r border-border z-[70] shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <span className="font-display font-bold text-sm">Navigation</span>
                <button onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderSidebarContent()}
            </div>
          </>
        )}
      </>
    );
  }

  // Desktop/Tablet: sidebar
  return (
    <div
      className="flex-none border-r border-border bg-card flex flex-col overflow-hidden w-[220px]"
    >
      {renderSidebarContent()}
    </div>
  );
}
