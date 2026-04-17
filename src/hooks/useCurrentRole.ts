import { useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

// Labels humains par type d'org + rôle technique
const ROLE_LABELS: Record<string, Record<string, string>> = {
  programme: {
    owner: 'Directeur',
    admin: 'Administrateur',
    manager: 'Chef de programme',
    analyst: 'Analyste',
    coach: 'Coach',
    entrepreneur: 'Entrepreneur',
  },
  pe: {
    owner: 'Managing Partner',
    admin: 'Administrateur',
    manager: 'Managing Director',
    analyst: 'Investment Manager',
    coach: 'Analyste',
    entrepreneur: 'Entrepreneur',
  },
  mixed: {
    owner: 'Directeur',
    admin: 'Administrateur',
    manager: 'Responsable',
    analyst: 'Analyste',
    coach: 'Coach',
    entrepreneur: 'Entrepreneur',
  },
};

export function humanizeRole(role: string | null, orgType: string | null): string {
  if (!role) return '';
  const type = orgType || 'programme';
  return ROLE_LABELS[type]?.[role] || role;
}

export function useCurrentRole() {
  const { currentRole, currentOrg, isSuperAdmin } = useOrganization();

  return useMemo(() => {
    const role = currentRole;
    const orgType = currentOrg?.type || 'programme';

    return {
      role,
      orgType,
      humanLabel: humanizeRole(role, orgType),
      isSuperAdmin,

      // Checks par rôle
      isOwner: role === 'owner',
      isAdmin: role === 'admin',
      isManager: role === 'manager',
      isAnalyst: role === 'analyst',
      isCoach: role === 'coach',
      isEntrepreneur: role === 'entrepreneur',

      // Permissions agrégées
      canManageOrg: role === 'owner' || role === 'admin' || isSuperAdmin,
      canInviteMembers: ['owner', 'admin', 'manager'].includes(role || '') || isSuperAdmin,
      canManageProgramme: ['owner', 'admin', 'manager'].includes(role || '') || isSuperAdmin,
      canViewAllEnterprises: ['owner', 'admin', 'manager', 'analyst'].includes(role || '') || isSuperAdmin,
      canGenerateDeliverables: ['owner', 'admin', 'manager', 'analyst', 'coach'].includes(role || '') || isSuperAdmin,
      canWriteCoachingNotes: role === 'coach' || isSuperAdmin,
      canViewMetering: role === 'owner' || role === 'admin' || isSuperAdmin,
      canAssignCoaches: ['owner', 'admin', 'manager'].includes(role || '') || isSuperAdmin,
    };
  }, [currentRole, currentOrg, isSuperAdmin]);
}
