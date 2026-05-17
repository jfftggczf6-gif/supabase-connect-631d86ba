// src/components/ba/synthese/SyntheseContent.tsx
// Contenu pur du dashboard Synthèse Partner BA (sans DashboardLayout).
// Brief synthese_partner — 4 KPIs + Business + Mini Kanban + Activité récente.

import { Loader2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSyntheseBa } from '@/hooks/useSyntheseBa';
import SyntheseKpisView from './SyntheseKpis';
import BusinessSyntheseView from './BusinessSyntheseView';
import MiniKanban from './MiniKanban';
import RecentActivity from '@/components/ba/RecentActivity';

export default function SyntheseContent() {
  const { currentOrg } = useOrganization();
  const { bundle, loading, error } = useSyntheseBa(currentOrg?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-rose-600 py-8 text-sm">
        Erreur : {error}
      </div>
    );
  }

  return (
    <>
      <SyntheseKpisView kpis={bundle.kpis} />
      <BusinessSyntheseView business={bundle.business} />
      <MiniKanban mandats={bundle.mandats} />
      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Activité récente
        </h2>
        <RecentActivity organizationId={currentOrg?.id} limit={10} />
      </div>
    </>
  );
}
