// ===========================================================================
// src/hooks/useSegment.ts
// Hook React qui expose la config segment-aware de l'organisation courante.
//
// Usage :
//   const { segment, label, vocab, modules, scoring } = useSegment();
//   <h1>{vocab.entity_plural} de votre programme</h1>
//   // → "Entreprises de votre programme" pour Programme
//   // → "Cibles de votre programme" pour PE
//
// Le segment est dérivé de currentOrg.type (depuis useOrganization).
// Si pas d'org sélectionnée ou type inconnu, fallback sur 'programme'.
// ===========================================================================

import { useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getSegmentConfigFront,
  type SegmentConfigFront,
  type SegmentType,
} from '@/lib/segment-config-front';

export interface UseSegmentReturn extends SegmentConfigFront {
  /** True si le segment est 'programme' (le défaut) */
  isProgramme: boolean;
  /** True si le segment est 'pe' */
  isPE: boolean;
  /** True si le segment est 'banque_affaires' */
  isBanqueAffaires: boolean;
  /** True si le segment est 'banque' (banque commerciale / IMF) */
  isBanque: boolean;
  /** True si le segment est PE ou BA (orgs investisseur) */
  isInvestisseur: boolean;
}

export function useSegment(): UseSegmentReturn {
  const { currentOrg } = useOrganization();

  return useMemo(() => {
    const orgType = currentOrg?.type ?? 'programme';
    const config = getSegmentConfigFront(orgType);
    const segment: SegmentType = config.segment;

    return {
      ...config,
      isProgramme: segment === 'programme',
      isPE: segment === 'pe',
      isBanqueAffaires: segment === 'banque_affaires',
      isBanque: segment === 'banque',
      isInvestisseur: segment === 'pe' || segment === 'banque_affaires',
    };
  }, [currentOrg?.type]);
}
