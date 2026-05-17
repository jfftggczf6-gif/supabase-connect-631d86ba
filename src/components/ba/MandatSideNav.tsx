// src/components/ba/MandatSideNav.tsx
// Sidebar gauche du MandatShell — 6 groupes navigables avec statut + caption par item.
// Brief mandat_detail_layout critères #3, #4, #5, #6, #8.

import { cn } from '@/lib/utils';
import {
  Database, FileSearch, FileText, Calculator, Eye, Send,
  Circle, CircleDashed, CircleDot, CircleAlert, CircleCheck, MinusCircle,
} from 'lucide-react';
import type {
  SidebarGroup, SectionCode, SectionStatus,
} from '@/types/ba-shell';

interface Props {
  groups: SidebarGroup[];
  active: SectionCode;
  onSelect: (code: SectionCode) => void;
}

const STATUS_META: Record<SectionStatus, { Icon: typeof Circle; cls: string; label: string }> = {
  not_started: { Icon: Circle,       cls: 'text-muted-foreground/40', label: 'Non commencé' },
  empty:       { Icon: CircleDashed, cls: 'text-muted-foreground',    label: 'Vide' },
  draft:       { Icon: CircleDot,    cls: 'text-blue-500',            label: 'Brouillon' },
  submitted:   { Icon: CircleDot,    cls: 'text-amber-500',           label: 'Soumis' },
  correction:  { Icon: CircleAlert,  cls: 'text-orange-600',          label: 'À corriger' },
  validated:   { Icon: CircleCheck,  cls: 'text-emerald-600',         label: 'Validé' },
};

const GROUP_ICONS: Record<string, typeof Database> = {
  donnees: Database,
  pre_screening: FileSearch,
  memo: FileText,
  valuation: Calculator,
  teaser: Eye,
  diffusion: Send,
};

function StatusIcon({ status }: { status: SectionStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <Icon
      className={cn('h-3 w-3 shrink-0', meta.cls)}
      aria-label={meta.label}
    />
  );
}

export default function MandatSideNav({ groups, active, onSelect }: Props) {
  return (
    <nav className="w-[240px] shrink-0 border-r bg-muted/20 overflow-y-auto" aria-label="Navigation mandat">
      <div className="py-2">
        {groups.map(group => {
          const GroupIcon = GROUP_ICONS[group.code] || Database;
          return (
            <div key={group.code} className="mb-1">
              <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                        onClick={() => !item.disabled && onSelect(item.code)}
                        disabled={item.disabled}
                        className={cn(
                          'w-full text-left px-3 py-1.5 flex items-start gap-2 text-xs transition-colors',
                          'hover:bg-muted/60',
                          isActive && 'bg-background border-l-2 border-primary font-semibold',
                          !isActive && 'border-l-2 border-transparent',
                          item.disabled && 'opacity-50 cursor-not-allowed',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                        data-testid={`sidenav-${item.code}`}
                      >
                        <StatusIcon status={item.status} />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{item.label}</span>
                          {item.caption && (
                            <span className="block text-[10px] text-muted-foreground mt-0.5 truncate">
                              {item.caption}
                            </span>
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

/** Legend statuts — utilisable en footer ou tooltip. */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground p-2">
      {(['not_started', 'draft', 'submitted', 'correction', 'validated'] as SectionStatus[]).map(s => {
        const meta = STATUS_META[s];
        const Icon = meta.Icon;
        return (
          <span key={s} className="inline-flex items-center gap-1">
            <Icon className={cn('h-2.5 w-2.5', meta.cls)} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

/** Export pour réutilisation hors composant. */
export { STATUS_META, GROUP_ICONS, MinusCircle };
