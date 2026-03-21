import {
  LayoutGrid, Globe, FileSpreadsheet, BarChart3,
  Stethoscope, ListChecks, FileText, Target,
  TrendingUp, Briefcase, Upload, RefreshCw,
  FileSearch, Search, FolderPlus,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

export type ModuleCode = Database['public']['Enums']['module_code'];
export type DeliverableType = Database['public']['Enums']['deliverable_type'];
export type ModuleStatus = Database['public']['Enums']['module_status'];
export type Enterprise = Database['public']['Tables']['enterprises']['Row'];
export type Deliverable = Database['public']['Tables']['deliverables']['Row'];
export type EnterpriseModule = Database['public']['Tables']['enterprise_modules']['Row'];
export type CoachUpload = Database['public']['Tables']['coach_uploads']['Row'];

export interface UploadedFile {
  name: string;
  size: number;
}

export const MODULE_CONFIG = [
  { code: 'diagnostic' as ModuleCode, title: 'Bilan de progression', shortTitle: 'Bilan de progression', icon: Stethoscope, color: 'bg-orange-100 text-orange-600', step: 1 },
  { code: 'bmc' as ModuleCode,        title: 'Business Model Canvas',    shortTitle: 'Business Model Canvas',    icon: LayoutGrid,  color: 'bg-emerald-100 text-emerald-600', step: 2 },
  { code: 'sic' as ModuleCode,        title: 'Social Impact Canvas',     shortTitle: 'Social Impact Canvas',     icon: Globe,       color: 'bg-teal-100 text-teal-600',    step: 3 },
  { code: 'framework' as ModuleCode,  title: 'Plan Financier Intermédiaire', shortTitle: 'Plan Financier Intermédiaire', icon: BarChart3, color: 'bg-purple-100 text-purple-600', step: 4 },
  { code: 'plan_ovo' as ModuleCode,   title: 'Plan Financier Final',     shortTitle: 'Plan Financier Final',     icon: ListChecks,  color: 'bg-amber-100 text-amber-600',  step: 5 },
  { code: 'business_plan' as ModuleCode, title: 'Business Plan',         shortTitle: 'Business Plan',            icon: FileText,    color: 'bg-indigo-100 text-indigo-600', step: 6 },
  { code: 'odd' as ModuleCode,        title: 'ODD',                      shortTitle: 'ODD',                      icon: Target,      color: 'bg-red-100 text-red-600',      step: 7 },
  { code: 'valuation' as ModuleCode,  title: 'Valorisation',             shortTitle: 'Valorisation',             icon: TrendingUp,  color: 'bg-violet-100 text-violet-600', step: 8 },
  { code: 'onepager' as ModuleCode,   title: 'One-Pager Investisseur',   shortTitle: 'One-Pager',                icon: FileText,    color: 'bg-cyan-100 text-cyan-600',    step: 9 },
  { code: 'investment_memo' as ModuleCode, title: "Mémo d'Investissement", shortTitle: 'Mémo Investisseur',      icon: Briefcase,   color: 'bg-slate-100 text-slate-700',  step: 10 },
];

export const MODULE_CONFIG_COACH = [
  { code: 'bmc',           title: 'Business Model Canvas',       icon: LayoutGrid,      color: '#059669' },
  { code: 'sic',           title: 'Social Impact Canvas',        icon: Globe,           color: '#7c3aed' },
  { code: 'inputs',        title: 'Données Financières',         icon: FileSpreadsheet, color: '#d97706' },
  { code: 'framework',     title: 'Plan Financier Interm.',      icon: BarChart3,       color: '#2563eb' },
  { code: 'diagnostic',    title: 'Bilan de progression',        icon: Stethoscope,     color: '#1e3a5f' },
  { code: 'plan_ovo',      title: 'Plan Financier Final',        icon: ListChecks,      color: '#ea580c' },
  { code: 'business_plan', title: 'Business Plan',               icon: FileText,        color: '#4338ca' },
  { code: 'odd',           title: 'Due Diligence ODD',           icon: Target,          color: '#0891b2' },
  { code: 'valuation',     title: 'Valorisation',                icon: TrendingUp,      color: '#7c3aed' },
  { code: 'onepager',      title: 'One-Pager Investisseur',      icon: FileText,        color: '#0891b2' },
  { code: 'investment_memo', title: "Mémo d'Investissement",     icon: Briefcase,       color: '#475569' },
];

export const DELIVERABLE_CONFIG = [
  { type: 'pre_screening',   label: 'Diagnostic initial',                         formats: ['html', 'json'], icon: '🔍' },
  { type: 'bmc_analysis',    label: 'Business Model Canvas',                     formats: ['html', 'json'], icon: '📊' },
  { type: 'sic_analysis',    label: 'Social Impact Canvas',                      formats: ['html', 'json'], icon: '🌍' },
  { type: 'framework_data',  label: 'Plan Financier Intermédiaire',              formats: ['html', 'xlsx'], icon: '📈' },
  { type: 'diagnostic_data', label: 'Bilan de progression',                      formats: ['html', 'json'], icon: '🩺' },
  { type: 'plan_ovo',        label: 'Plan Financier Final',                      formats: ['html', 'xlsx'], icon: '📋' },
  { type: 'business_plan',   label: 'Business Plan',                             formats: ['html', 'json', 'docx'], icon: '📄' },
  { type: 'odd_analysis',    label: 'ODD (17 Objectifs de Développement Durable)', formats: ['html', 'json', 'xlsx'], icon: '🌍' },
  { type: 'valuation',       label: 'Valorisation',                              formats: ['html', 'json'], icon: '💰' },
  { type: 'onepager',        label: 'One-Pager Investisseur',                    formats: ['html', 'json'], icon: '📃' },
  { type: 'investment_memo', label: "Mémo d'Investissement",                     formats: ['html', 'json'], icon: '💼' },
];

export const PIPELINE = [
  // Phase 1 — Triage
  { name: 'Diagnostic initial', fn: 'generate-pre-screening',  type: 'pre_screening' as DeliverableType },
  // Phase 2 — Analyse
  { name: 'BMC',              fn: 'generate-bmc',              type: 'bmc_analysis' as DeliverableType },
  { name: 'SIC',              fn: 'generate-sic',              type: 'sic_analysis' as DeliverableType },
  { name: 'Inputs',           fn: 'generate-inputs',           type: 'inputs_data' as DeliverableType },
  { name: 'Framework',        fn: 'generate-framework',        type: 'framework_data' as DeliverableType },
  { name: 'Plan OVO',         fn: 'generate-plan-ovo',         type: 'plan_ovo' as DeliverableType },
  { name: 'Sync Plan OVO',    fn: 'reconcile-plan-ovo',        type: 'plan_ovo' as DeliverableType },
  { name: 'Excel OVO',        fn: 'generate-ovo-plan',         type: 'plan_ovo_excel' as DeliverableType },
  { name: 'Business Plan',    fn: 'generate-business-plan',    type: 'business_plan' as DeliverableType },
  { name: 'ODD',              fn: 'generate-odd',              type: 'odd_analysis' as DeliverableType },
  { name: 'Diagnostic',       fn: 'generate-diagnostic',       type: 'diagnostic_data' as DeliverableType },
  // Phase 3 — Investisseur
  { name: 'Valuation',        fn: 'generate-valuation',        type: 'valuation' as DeliverableType },
  { name: 'One-Pager',        fn: 'generate-onepager',         type: 'onepager' as DeliverableType },
  { name: 'Investment Memo',  fn: 'generate-investment-memo',  type: 'investment_memo' as DeliverableType },
  // Phase 4 — Décision (screening en dernier)
  { name: 'Décision programme', fn: 'generate-screening-report', type: 'screening_report' as DeliverableType },
];

export const MODULE_FN_MAP: Record<string, string> = {
  bmc: 'generate-bmc',
  sic: 'generate-sic',
  inputs: 'generate-inputs',
  framework: 'generate-framework',
  diagnostic: 'generate-diagnostic',
  plan_ovo: 'generate-plan-ovo',
  business_plan: 'generate-business-plan',
  odd: 'generate-odd',
  pre_screening: 'generate-pre-screening',
  valuation: 'generate-valuation',
  onepager: 'generate-onepager',
  investment_memo: 'generate-investment-memo',
  screening_report: 'generate-screening-report',
};

// ===== PHASE STRUCTURE =====

export interface PhaseConfig {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  modules: {
    code: string;
    label: string;
    icon: any;
    special?: 'upload' | 'pre_screening' | 'screening' | 'dataroom';
  }[];
}

export const PHASES: PhaseConfig[] = [
  {
    id: 'phase_0',
    label: 'Données',
    shortLabel: 'Données',
    color: 'emerald',
    modules: [
      { code: 'upload', label: 'Upload documents', icon: Upload, special: 'upload' },
      { code: 'reconstruction', label: 'Reconstruction', icon: RefreshCw, special: 'upload' },
    ],
  },
  {
    id: 'phase_1',
    label: 'Triage',
    shortLabel: 'Triage',
    color: 'rose',
    modules: [
      { code: 'pre_screening', label: 'Diagnostic initial', icon: FileSearch, special: 'pre_screening' },
    ],
  },
  {
    id: 'phase_2',
    label: 'Analyse',
    shortLabel: 'Analyse',
    color: 'blue',
    modules: [
      { code: 'bmc', label: 'Business Model Canvas', icon: LayoutGrid },
      { code: 'sic', label: 'Social Impact Canvas', icon: Globe },
      { code: 'framework', label: 'Plan Financier Interm.', icon: BarChart3 },
      { code: 'plan_ovo', label: 'Plan Financier Final', icon: ListChecks },
      { code: 'diagnostic', label: 'Bilan de progression', icon: Stethoscope },
      { code: 'odd', label: 'ODD', icon: Target },
      { code: 'business_plan', label: 'Business Plan', icon: FileText },
    ],
  },
  {
    id: 'phase_3',
    label: 'Investisseur',
    shortLabel: 'Invest.',
    color: 'violet',
    modules: [
      { code: 'valuation', label: 'Valorisation', icon: TrendingUp },
      { code: 'onepager', label: 'One-Pager', icon: FileText },
      { code: 'investment_memo', label: 'Mémo Investissement', icon: Briefcase },
    ],
  },
  {
    id: 'phase_4',
    label: 'Décision',
    shortLabel: 'Décision',
    color: 'amber',
    modules: [
      { code: 'screening', label: 'Décision programme', icon: Search, special: 'screening' },
      { code: 'dataroom', label: 'Data Room', icon: FolderPlus, special: 'dataroom' },
    ],
  },
];
