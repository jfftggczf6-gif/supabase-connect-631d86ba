// src/pages/ba/BaPipelinePage.tsx
// Page standalone du pipeline BA (kanban + table).
// Utilisée par Analyste/Senior (route /ba/pipeline). Le Partner accède au
// même contenu via BaWorkspacePage (/ba) onglet Mandats.
import { useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import BaPipelineContent from '@/components/ba/BaPipelineContent';

export default function BaPipelinePage() {
  const { currentOrg } = useOrganization();
  const { role } = useCurrentRole();

  const subtitle = useMemo(() => {
    if (!currentOrg) return '';
    const isAnalyst = role === 'analyst' || role === 'analyste';
    const isSenior = role === 'investment_manager';
    const suffix = isAnalyst ? ' · Mes mandats' : isSenior ? ' · Vue Senior' : ' · Tous les mandats';
    return `${currentOrg.name}${suffix}`;
  }, [currentOrg, role]);

  return (
    <DashboardLayout title="Pipeline mandats" subtitle={subtitle}>
      <BaPipelineContent />
    </DashboardLayout>
  );
}
