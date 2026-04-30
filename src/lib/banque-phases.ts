// banque-phases.ts
//
// Découpage des phases visibles dans la sidebar du dossier de crédit (segment Banque),
// filtré selon le rôle de l'utilisateur. Mirroir du PHASES de dashboard-config.ts
// pour le segment Programme.
//
// La structure (phases + modules) est définie en code car elle est stable.
// Les libellés affichables ("Diagnostic de bancabilité" → "Pré-instruction crédit")
// peuvent être overridés par preset.config_banque.branding au moment du rendu.

import {
  Upload, BookOpen, Users, FileSearch, BarChart3, FileSpreadsheet,
  FileText, Briefcase, ClipboardList, Target, Activity, Shield,
} from 'lucide-react';
import type { PhaseConfig } from '@/lib/dashboard-config';

// Mapping module_code → deliverable.type pour le sidebar (statut completed)
export const DELIV_TYPE_MAP_BANQUE: Record<string, string> = {
  diagnostic_bancabilite: 'diagnostic_bancabilite',
  modele_financier:       'credit_readiness_modele_financier',
  projections:            'credit_readiness_projections',
  bp_credit:              'credit_readiness_bp_credit',
  plan_financement:       'credit_readiness_plan_financement',
  organigramme:           'credit_readiness_organigramme',
  analyse_commerciale:    'credit_readiness_analyse_commerciale',
  matching:               'matching_produits',
  note_credit:            'note_credit',
};

// Phases complètes (toutes les actions possibles dans un dossier de crédit).
// Filtrées ensuite par rôle via getPhasesForBanqueRole.
export const PHASES_BANQUE_ALL: PhaseConfig[] = [
  {
    id: 'phase_donnees',
    label: 'Données',
    shortLabel: 'Données',
    color: 'violet',
    modules: [
      { code: 'upload',      label: 'Upload documents',     icon: Upload,   special: 'upload' },
      { code: 'coach_info',  label: 'Information conseiller', icon: Users,  special: 'upload' },
      { code: 'sources',     label: 'Sources & références', icon: BookOpen, special: 'upload' },
    ],
  },
  {
    id: 'phase_diagnostic',
    label: 'Diagnostic',
    shortLabel: 'Diag.',
    color: 'violet',
    modules: [
      { code: 'diagnostic_bancabilite', label: 'Diagnostic de bancabilité', icon: Shield, special: 'pre_screening' },
    ],
  },
  {
    id: 'phase_credit_readiness',
    label: 'Credit readiness',
    shortLabel: 'CR',
    color: 'amber',
    modules: [
      { code: 'modele_financier',    label: 'Modèle financier',     icon: BarChart3 },
      { code: 'projections',         label: 'Projections',          icon: Activity },
      { code: 'bp_credit',           label: 'BP crédit',            icon: FileText },
      { code: 'plan_financement',    label: 'Plan financement',     icon: FileSpreadsheet },
      { code: 'organigramme',        label: 'Organigramme',         icon: ClipboardList },
      { code: 'analyse_commerciale', label: 'Analyse commerciale',  icon: Target },
    ],
  },
  {
    id: 'phase_matching',
    label: 'Matching',
    shortLabel: 'Match.',
    color: 'violet',
    modules: [
      { code: 'matching', label: 'Matching produits', icon: FileSearch },
    ],
  },
  {
    id: 'phase_instruction',
    label: 'Instruction',
    shortLabel: 'Instr.',
    color: 'emerald',
    modules: [
      { code: 'note_credit', label: 'Note de crédit', icon: Briefcase },
    ],
  },
  {
    id: 'phase_monitoring',
    label: 'Monitoring',
    shortLabel: 'Suivi',
    color: 'rose',
    modules: [
      { code: 'monitoring', label: 'Suivi du crédit', icon: Activity },
    ],
  },
];

// Phases visibles par rôle.
// Conseiller PME : produit (Données → Credit readiness → Matching), pas de Note ni Monitoring
// Analyste Crédit : valide tout + Note de crédit + Monitoring
// Directeur PME : tout
const ROLE_VISIBLE_PHASES: Record<string, string[]> = {
  conseiller_pme:  ['phase_donnees', 'phase_diagnostic', 'phase_credit_readiness', 'phase_matching'],
  analyste_credit: ['phase_donnees', 'phase_diagnostic', 'phase_credit_readiness', 'phase_matching', 'phase_instruction', 'phase_monitoring'],
  directeur_pme:   ['phase_donnees', 'phase_diagnostic', 'phase_credit_readiness', 'phase_matching', 'phase_instruction', 'phase_monitoring'],
  direction_pme:   ['phase_donnees', 'phase_diagnostic', 'phase_credit_readiness', 'phase_matching', 'phase_instruction', 'phase_monitoring'],
  // owner/admin/manager : voient tout (cas test/admin)
  owner:           ['phase_donnees', 'phase_diagnostic', 'phase_credit_readiness', 'phase_matching', 'phase_instruction', 'phase_monitoring'],
  admin:           ['phase_donnees', 'phase_diagnostic', 'phase_credit_readiness', 'phase_matching', 'phase_instruction', 'phase_monitoring'],
  manager:         ['phase_donnees', 'phase_diagnostic', 'phase_credit_readiness', 'phase_matching', 'phase_instruction', 'phase_monitoring'],
};

/**
 * Retourne les phases visibles pour un rôle donné. Si le rôle n'est pas connu,
 * fallback sur la vue Conseiller (la plus restreinte) — défense en profondeur.
 */
export function getPhasesForBanqueRole(role: string | null | undefined): PhaseConfig[] {
  const visibleIds = role && ROLE_VISIBLE_PHASES[role]
    ? ROLE_VISIBLE_PHASES[role]
    : ROLE_VISIBLE_PHASES.conseiller_pme;
  return PHASES_BANQUE_ALL.filter(p => visibleIds.includes(p.id));
}
