// RoleGate — affiche ses children uniquement si le rôle de l'utilisateur
// fait partie de la liste autorisée. Optionnellement, peut aussi gater
// selon l'état d'un livrable (validation_status).
//
// Usage :
//   <RoleGate roles={['conseiller_pme']}>
//     <Button>Régénérer IA</Button>
//   </RoleGate>
//
//   <RoleGate roles={['analyste_credit','directeur_pme']} statuses={['submitted']}>
//     <Button>Valider livrable</Button>
//   </RoleGate>

import { ReactNode } from 'react';
import { useCurrentRole } from '@/hooks/useCurrentRole';

export type BanqueRole =
  | 'owner' | 'admin' | 'manager'
  | 'conseiller_pme' | 'analyste_credit' | 'directeur_pme' | 'direction_pme' | 'directeur_agence'
  | 'partner';

interface RoleGateProps {
  children: ReactNode;
  /** Liste des rôles autorisés. owner/admin/manager passent toujours sauf si exclus explicitement. */
  roles: BanqueRole[];
  /** (Optionnel) Restreint aussi aux états de livrable autorisés. */
  statuses?: (string | null)[];
  /** Statut courant du livrable (à fournir si statuses est utilisé). */
  status?: string | null;
  /** (Optionnel) Si true, owner/admin/manager ne contournent PAS la check. */
  strict?: boolean;
}

export default function RoleGate({ children, roles, statuses, status, strict = false }: RoleGateProps) {
  const { role, isSuperAdmin } = useCurrentRole();

  // Super admin passe toujours (sauf strict)
  if (!strict && isSuperAdmin) return <>{children}</>;

  // Check rôle
  if (!role || !roles.includes(role as BanqueRole)) return null;

  // Check état si fourni
  if (statuses && statuses.length > 0 && !statuses.includes(status ?? null)) return null;

  return <>{children}</>;
}

/**
 * Hook léger qui calcule les capacités selon le rôle + état d'un livrable.
 * Utile pour conditionner des boutons sans wrapper avec RoleGate.
 */
export function useDeliverableCapabilities(status: string | null | undefined) {
  const { role } = useCurrentRole();

  const isProducer = role === 'conseiller_pme';
  const isReviewer = role === 'analyste_credit' || role === 'directeur_pme' || role === 'direction_pme';
  const isAdmin = role === 'owner' || role === 'admin' || role === 'manager';

  // Le statut effectif (null = pas encore touché par le workflow → équivaut à 'draft')
  const effectiveStatus = status || 'draft';

  return {
    role,
    isProducer,
    isReviewer,
    isAdmin,
    effectiveStatus,

    // Capacités par état
    // Producteur : ne peut régénérer qu'en draft ou révision demandée (pas pendant qu'analyste examine)
    // Admin : peut régénérer tant que pas validé/locked
    canRegenerate:
      (isProducer && (effectiveStatus === 'draft' || effectiveStatus === 'revision_requested'))
      || (isAdmin && effectiveStatus !== 'validated' && effectiveStatus !== 'locked'),
    canSubmit:     (isProducer || isAdmin) && (effectiveStatus === 'draft' || effectiveStatus === 'revision_requested'),
    canValidate:   (isReviewer || isAdmin) && effectiveStatus === 'submitted',
    canRequestRevision: (isReviewer || isAdmin) && effectiveStatus === 'submitted',
    canComment:    (isReviewer || isAdmin || isProducer),
    canUnlock:     isAdmin && effectiveStatus === 'validated',
    isLocked:      effectiveStatus === 'validated' || effectiveStatus === 'locked',
  };
}
