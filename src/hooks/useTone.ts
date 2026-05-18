// src/hooks/useTone.ts
// Détermine le ton à passer aux EFs de génération IA selon le type d'organisation.
// - 'ba' : organisation banque_affaires → ton vendeur (Equity story, séduire fonds)
// - 'pe' : par défaut → ton analytique factuel (évaluation comité d'invest)
//
// Utilisé par les composants PE réutilisés en wrapper BA pour switcher le prompt
// Railway worker sans dupliquer les composants (cf. CLAUDE.md décision Option A).

import { useOrganization } from '@/contexts/OrganizationContext';

export type Tone = 'pe' | 'ba';

export function useTone(): Tone {
  const { currentOrg } = useOrganization();
  return currentOrg?.type === 'banque_affaires' ? 'ba' : 'pe';
}
