import { useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { humanizeRole } from '@/lib/roles';

// Re-export pour compat avec l'existant qui importe humanizeRole depuis ce hook
export { humanizeRole };

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
      // Tous les rôles dirigeants banque peuvent inviter (selon hiérarchie filtrée par getInvitableRoles)
      canInviteMembers: [
        'owner', 'admin', 'manager',
        'directeur_pme', 'direction_pme', 'directeur_agence', 'analyste_credit',
      ].includes(role || '') || isSuperAdmin,
      canManageProgramme: ['owner', 'admin', 'manager'].includes(role || '') || isSuperAdmin,
      canViewAllEnterprises: [
        'owner', 'admin', 'manager', 'analyst',
        'directeur_pme', 'direction_pme',
      ].includes(role || '') || isSuperAdmin,
      canGenerateDeliverables: [
        'owner', 'admin', 'manager', 'analyst', 'coach',
        'conseiller_pme', 'analyste_credit', 'directeur_pme', 'direction_pme', 'directeur_agence',
      ].includes(role || '') || isSuperAdmin,
      canWriteCoachingNotes: role === 'coach' || isSuperAdmin,
      canViewMetering: role === 'owner' || role === 'admin' || isSuperAdmin,
      canAssignCoaches: ['owner', 'admin', 'manager'].includes(role || '') || isSuperAdmin,
    };
  }, [currentRole, currentOrg, isSuperAdmin]);
}
