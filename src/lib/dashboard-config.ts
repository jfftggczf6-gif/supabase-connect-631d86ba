import {
  LayoutGrid, Globe, FileSpreadsheet, BarChart3,
  Stethoscope, ListChecks, FileText, Target,
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
  { code: 'diagnostic' as ModuleCode, title: 'Diagnostic Expert Global', shortTitle: 'Diagnostic Expert Global', icon: Stethoscope, color: 'bg-orange-100 text-orange-600', step: 1 },
  { code: 'bmc' as ModuleCode,        title: 'Business Model Canvas',    shortTitle: 'Business Model Canvas',    icon: LayoutGrid,  color: 'bg-emerald-100 text-emerald-600', step: 2 },
  { code: 'sic' as ModuleCode,        title: 'Social Impact Canvas',     shortTitle: 'Social Impact Canvas',     icon: Globe,       color: 'bg-teal-100 text-teal-600',    step: 3 },
  { code: 'framework' as ModuleCode,  title: 'Plan Financier Intermédiaire', shortTitle: 'Plan Financier Intermédiaire', icon: BarChart3, color: 'bg-purple-100 text-purple-600', step: 4 },
  { code: 'plan_ovo' as ModuleCode,   title: 'Plan Financier Final',     shortTitle: 'Plan Financier Final',     icon: ListChecks,  color: 'bg-amber-100 text-amber-600',  step: 5 },
  { code: 'business_plan' as ModuleCode, title: 'Business Plan',         shortTitle: 'Business Plan',            icon: FileText,    color: 'bg-indigo-100 text-indigo-600', step: 6 },
  { code: 'odd' as ModuleCode,        title: 'ODD',                      shortTitle: 'ODD',                      icon: Target,      color: 'bg-red-100 text-red-600',      step: 7 },
];

export const MODULE_CONFIG_COACH = [
  { code: 'bmc',           title: 'Business Model Canvas',       icon: LayoutGrid,      color: '#059669' },
  { code: 'sic',           title: 'Social Impact Canvas',        icon: Globe,           color: '#7c3aed' },
  { code: 'inputs',        title: 'Données Financières',         icon: FileSpreadsheet, color: '#d97706' },
  { code: 'framework',     title: 'Plan Financier Interm.',      icon: BarChart3,       color: '#2563eb' },
  { code: 'diagnostic',    title: 'Diagnostic Expert',           icon: Stethoscope,     color: '#1e3a5f' },
  { code: 'plan_ovo',      title: 'Plan Financier Final',        icon: ListChecks,      color: '#ea580c' },
  { code: 'business_plan', title: 'Business Plan',               icon: FileText,        color: '#4338ca' },
  { code: 'odd',           title: 'Due Diligence ODD',           icon: Target,          color: '#0891b2' },
];

export const DELIVERABLE_CONFIG = [
  { type: 'pre_screening',   label: 'Pre-screening / Triage',                     formats: ['html', 'json'], icon: '🔍' },
  { type: 'bmc_analysis',    label: 'Business Model Canvas',                     formats: ['html', 'json'], icon: '📊' },
  { type: 'sic_analysis',    label: 'Social Impact Canvas',                      formats: ['html', 'json'], icon: '🌍' },
  { type: 'framework_data',  label: 'Plan Financier Intermédiaire',              formats: ['html', 'xlsx'], icon: '📈' },
  { type: 'diagnostic_data', label: 'Diagnostic Expert',                         formats: ['html', 'json'], icon: '🩺' },
  { type: 'plan_ovo',        label: 'Plan Financier Final',                      formats: ['html', 'xlsx'], icon: '📋' },
  { type: 'business_plan',   label: 'Business Plan',                             formats: ['html', 'json', 'docx'], icon: '📄' },
  { type: 'odd_analysis',    label: 'ODD (17 Objectifs de Développement Durable)', formats: ['html', 'json', 'xlsx'], icon: '🌍' },
];

export const PIPELINE = [
  { name: 'BMC',           fn: 'generate-bmc',           type: 'bmc_analysis' as DeliverableType },
  { name: 'SIC',           fn: 'generate-sic',           type: 'sic_analysis' as DeliverableType },
  { name: 'Inputs',        fn: 'generate-inputs',        type: 'inputs_data' as DeliverableType },
  { name: 'Framework',     fn: 'generate-framework',     type: 'framework_data' as DeliverableType },
  { name: 'Plan OVO',      fn: 'generate-plan-ovo',      type: 'plan_ovo' as DeliverableType },
  { name: 'Sync Plan OVO', fn: 'reconcile-plan-ovo',     type: 'plan_ovo' as DeliverableType },
  { name: 'Excel OVO',    fn: 'generate-ovo-plan',      type: 'plan_ovo_excel' as DeliverableType },
  { name: 'Business Plan', fn: 'generate-business-plan', type: 'business_plan' as DeliverableType },
  { name: 'ODD',           fn: 'generate-odd',           type: 'odd_analysis' as DeliverableType },
  { name: 'Diagnostic',    fn: 'generate-diagnostic',    type: 'diagnostic_data' as DeliverableType },
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
};
