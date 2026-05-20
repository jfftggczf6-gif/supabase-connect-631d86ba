// src/components/shared/DealSideNav.tsx
// Sidebar partagée PE + BA — composant data-driven.
//
// Brief #37 [CROSS] Mutualiser sidebar PE + BA. Les 2 modules avaient des
// implémentations séparées (PeDealSidebar 500+ lignes avec stage-gating ;
// MandatSideNav 100 lignes data-driven). Ce composant est le commun :
//   - Layout fixe 240px, border-r, scroll vertical
//   - Groupes navigables avec header violet + icône
//   - Items avec status icon + label + caption + active border-left violet
//   - Progress bar optionnelle en haut
//
// PE et BA construisent leurs groupes selon leur métier puis passent en props.

import { cn } from '@/lib/utils';
import {
  Database, FileSearch, FileText, Calculator, Eye, Send, Briefcase,
  Circle, CircleDashed, CircleDot, CircleAlert, CircleCheck, MinusCircle,
  type LucideIcon,
} from 'lucide-react';

/** Statut générique d'un item — couvre PE et BA. */
export type SharedSectionStatus =
  | 'not_started'
  | 'empty'
  | 'draft'
  | 'submitted'
  | 'pending_validation'  // alias PE
  | 'correction'
  | 'needs_revision'      // alias PE
  | 'validated';

export interface SharedSidebarItem<TCode extends string = string> {
  code: TCode;
  label: string;
  status: SharedSectionStatus;
  /** Sous-texte affiché (ex: "8/12 sections validées"). */
  caption?: string;
  /** Si true, le clic est bloqué. */
  disabled?: boolean;
}

export interface SharedSidebarGroup<TCode extends string = string> {
  /** Identifiant unique (utilisé pour le lookup d'icône). */
  code: string;
  label: string;
  items: SharedSidebarItem<TCode>[];
  /** Visible uniquement pour ces rôles. undefined = visible pour tous. */
  visibleForRoles?: string[];
  /** Override de l'icône du groupe (sinon lookup dans GROUP_ICONS_DEFAULT). */
  icon?: LucideIcon;
}

interface Props<TCode extends string = string> {
  groups: SharedSidebarGroup<TCode>[];
  active: TCode;
  onSelect: (code: TCode) => void;
  /** Render-prop optionnel pour afficher une progress bar / metric en haut. */
  topContent?: React.ReactNode;
  /** Largeur custom (défaut 240px). */
  width?: string;
}

// ─── Icônes par défaut pour les groupes communs PE+BA ───────────────────────
const GROUP_ICONS_DEFAULT: Record<string, LucideIcon> = {
  vue_360: Eye,
  donnees: Database,
  pre_screening: FileSearch,
  memo: FileText,
  valuation: Calculator,
  teaser: Eye,
  diffusion: Send,
  // PE-specific
  ic1: FileText,
  dd: FileSearch,
  closing: Briefcase,
  portfolio: Briefcase,
};

// ─── Métadonnée statut : icône + couleur ────────────────────────────────────
// Couvre les 2 conventions (BA : submitted/correction ; PE : pending_validation/needs_revision).
const STATUS_META: Record<SharedSectionStatus, { Icon: LucideIcon; cls: string; label: string }> = {
  not_started:        { Icon: Circle,        cls: 'text-muted-foreground/40',  label: 'Non commencé' },
  empty:              { Icon: CircleDashed,  cls: 'text-muted-foreground/60',  label: 'Vide' },
  draft:              { Icon: CircleDot,     cls: 'text-violet-600',           label: 'Brouillon' },
  submitted:          { Icon: CircleAlert,   cls: 'text-amber-600',            label: 'Soumis (à valider)' },
  pending_validation: { Icon: CircleAlert,   cls: 'text-amber-600',            label: 'À valider' },
  correction:         { Icon: MinusCircle,   cls: 'text-orange-600',           label: 'En correction' },
  needs_revision:     { Icon: MinusCircle,   cls: 'text-orange-600',           label: 'À réviser' },
  validated:          { Icon: CircleCheck,   cls: 'text-emerald-600',          label: 'Validé' },
};

function StatusIcon({ status }: { status: SharedSectionStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <Icon
      className={cn('h-3 w-3 shrink-0', meta.cls)}
      aria-label={meta.label}
    />
  );
}

export default function DealSideNav<TCode extends string = string>({
  groups, active, onSelect, topContent, width = 'w-[240px]',
}: Props<TCode>) {
  return (
    <nav className={cn(width, 'shrink-0 border-r bg-muted/20 overflow-y-auto')} aria-label="Navigation deal">
      {topContent}
      <div className="py-2">
        {groups.map(group => {
          const GroupIcon = group.icon || GROUP_ICONS_DEFAULT[group.code] || Database;
          return (
            <div key={group.code} className="mb-1">
              <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                <GroupIcon className="h-3 w-3" />
                {group.label}
              </div>
              <ul>
                {group.items.map(item => {
                  const isActive = item.code === active;
                  return (
                    <li key={item.code}>
                      <button
                        type="button"
                        disabled={item.disabled}
                        onClick={() => onSelect(item.code)}
                        className={cn(
                          'w-full flex items-start gap-2 px-3 py-1.5 text-left text-[12px] transition-colors',
                          isActive
                            ? 'border-l-[3px] border-violet-600 bg-violet-50 text-violet-900 font-semibold'
                            : 'border-l-[3px] border-transparent hover:bg-muted/40 text-foreground/80',
                          item.disabled && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        <StatusIcon status={item.status} />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{item.label}</span>
                          {item.caption && (
                            <span className="block text-[10px] text-muted-foreground truncate">{item.caption}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// Re-export pour usage direct dans PE / BA.
export { STATUS_META as SHARED_STATUS_META };

/** Légende des statuts — utilisable au bas d'une sidebar ou en bas de page. */
export function StatusLegend() {
  return (
    <div className="px-3 py-2 border-t bg-muted/10">
      <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Statuts</div>
      <div className="space-y-1">
        {(Object.entries(STATUS_META) as [SharedSectionStatus, typeof STATUS_META[SharedSectionStatus]][])
          .filter(([k]) => !['pending_validation','needs_revision'].includes(k)) // dédoublonner avec submitted/correction
          .map(([k, meta]) => {
            const Icon = meta.Icon;
            return (
              <div key={k} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Icon className={`h-2.5 w-2.5 ${meta.cls}`} />
                {meta.label}
              </div>
            );
          })}
      </div>
    </div>
  );
}
