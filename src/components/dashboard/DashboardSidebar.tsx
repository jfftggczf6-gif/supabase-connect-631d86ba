import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Sparkles, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, Menu, X,
} from 'lucide-react';
import { PHASES, type Enterprise, type Deliverable, type EnterpriseModule, type PhaseConfig } from '@/lib/dashboard-config';

interface SidebarProps {
  enterprise: Enterprise;
  deliverables: Deliverable[];
  modules: EnterpriseModule[];
  selectedModule: string;
  onSelectModule: (code: string) => void;
  onGenerateAll: () => void;
  generating: boolean;
  generationProgress?: { current: number; total: number; name: string } | null;
  globalScore: number;
}

const DELIV_TYPE_MAP: Record<string, string> = {
  bmc: 'bmc_analysis', sic: 'sic_analysis', inputs: 'inputs_data', framework: 'framework_data',
  diagnostic: 'diagnostic_data', plan_ovo: 'plan_ovo', business_plan: 'business_plan', odd: 'odd_analysis',
  screening: 'screening_report', pre_screening: 'pre_screening',
  valuation: 'valuation', onepager: 'onepager', investment_memo: 'investment_memo',
};

export default function DashboardSidebar({
  enterprise, deliverables, modules, selectedModule, onSelectModule,
  onGenerateAll, generating, generationProgress, globalScore,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth < 1024) return true;
    return localStorage.getItem('esono_sidebar_collapsed') === 'true';
  });
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(PHASES.map(p => p.id)));
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('esono_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  // Auto-expand the phase containing the selected module
  useEffect(() => {
    const phase = PHASES.find(p => p.modules.some(m => m.code === selectedModule));
    if (phase && !expandedPhases.has(phase.id)) {
      setExpandedPhases(prev => new Set([...prev, phase.id]));
    }
  }, [selectedModule]);

  const getModuleStatus = (code: string): 'completed' | 'in_progress' | 'not_started' => {
    // Special modules
    if (code === 'upload' || code === 'reconstruction') {
      // Consider done if there are uploaded files (heuristic via deliverables)
      return deliverables.length > 0 ? 'completed' : 'not_started';
    }
    const delivType = DELIV_TYPE_MAP[code];
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
    const allModules = PHASES.flatMap(p => p.modules);
    const done = allModules.filter(m => getModuleStatus(m.code) === 'completed').length;
    return Math.round((done / allModules.length) * 100);
  }, [deliverables, modules]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const phaseColorMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    blue: 'text-blue-600 bg-blue-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
  };

  const phaseAccentMap: Record<string, string> = {
    emerald: 'border-l-emerald-500',
    rose: 'border-l-rose-500',
    blue: 'border-l-blue-500',
    violet: 'border-l-violet-500',
    amber: 'border-l-amber-500',
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
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
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold',
              globalScore >= 60 ? 'bg-emerald-500/20 text-emerald-600' :
              globalScore >= 40 ? 'bg-amber-500/20 text-amber-600' :
              'bg-muted text-muted-foreground'
            )}>
              {globalScore || '—'}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm truncate">{enterprise.name}</span>
              <Badge variant="outline" className="text-xs tabular-nums">{globalScore || '—'}</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {enterprise.sector || '—'} · {enterprise.country || '—'}
            </p>
            <Progress value={totalProgress} className="h-1.5 mt-2" />
            <p className="text-[10px] text-muted-foreground mt-1">{totalProgress}% complété</p>
          </div>
        )}
      </button>

      {/* Phases */}
      <div className="flex-1 overflow-y-auto py-1">
        {PHASES.map((phase) => {
          const { done, total } = getPhaseProgress(phase);
          const isExpanded = expandedPhases.has(phase.id);
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
              <button
                onClick={() => togglePhase(phase.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-muted/50',
                  colorClass
                )}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                <span className="flex-1 text-left">{phase.label}</span>
                {allDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <span className="text-[10px] font-normal opacity-70">{done}/{total}</span>
                )}
              </button>

              {isExpanded && (
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
              )}
            </div>
          );
        })}
      </div>

      {/* Generate button */}
      <div className="p-3 border-t border-border">
        <Button
          onClick={onGenerateAll}
          disabled={generating}
          className={cn(
            'w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white',
            collapsed && 'px-2'
          )}
          size={collapsed ? 'icon' : 'default'}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {!collapsed && generationProgress && (
                <span className="text-xs truncate">{generationProgress.name} ({generationProgress.current}/{generationProgress.total})</span>
              )}
            </>
          ) : collapsed ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span className="text-xs">Générer tout le pipeline</span>
            </>
          )}
        </Button>
      </div>
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
      className={cn(
        'flex-none border-r border-border bg-card flex flex-col transition-all duration-200 ease-in-out overflow-hidden',
        collapsed ? 'w-14' : 'w-[220px]'
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-8 flex items-center justify-center border-b border-border hover:bg-muted/50 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
      </button>

      {renderSidebarContent()}
    </div>
  );
}
