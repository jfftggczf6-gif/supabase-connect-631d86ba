// src/components/ba/MandatSideNav.tsx
// Sidebar BA — wrapper du composant partagé `shared/DealSideNav`.
//
// Brief #37 [CROSS] Mutualiser sidebar PE + BA : le rendu visuel est dans
// `DealSideNav` (shared). Ce wrapper passe les types BA-spécifiques + la
// progress bar en haut (brief #33).

import DealSideNav, {
  type SharedSidebarGroup, type SharedSidebarItem, type SharedSectionStatus,
} from '@/components/shared/DealSideNav';
import MandatProgressBar from './MandatProgressBar';
import type { SidebarGroup, SectionCode, MandatStats } from '@/types/ba-shell';

interface Props {
  groups: SidebarGroup[];
  active: SectionCode;
  onSelect: (code: SectionCode) => void;
  stats?: MandatStats;
}

// Mappe les types BA → types Shared (1:1 pour le moment, mais sépare contre
// les drifts futurs côté types BA).
function toSharedGroup(group: SidebarGroup): SharedSidebarGroup<SectionCode> {
  return {
    code: group.code,
    label: group.label,
    visibleForRoles: group.visibleForRoles,
    items: group.items.map<SharedSidebarItem<SectionCode>>(item => ({
      code: item.code,
      label: item.label,
      status: item.status as SharedSectionStatus,
      caption: item.caption,
      disabled: item.disabled,
    })),
  };
}

export default function MandatSideNav({ groups, active, onSelect, stats }: Props) {
  return (
    <DealSideNav<SectionCode>
      groups={groups.map(toSharedGroup)}
      active={active}
      onSelect={onSelect}
      topContent={stats ? <MandatProgressBar stats={stats} /> : undefined}
    />
  );
}

// Re-export les MEMO_SECTIONS pour le BA-specific (reste utilisé par MandatShell)
export { default as DealSideNav, StatusLegend } from '@/components/shared/DealSideNav';
