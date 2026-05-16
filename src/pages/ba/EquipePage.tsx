// src/pages/ba/EquipePage.tsx
// Page standalone Équipe BA (deep link). Le Partner accède au même contenu
// via BaWorkspacePage (/ba?tab=equipe). Gardée pour les bookmarks directs.
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import EquipeContent from '@/components/ba/EquipeContent';

export default function EquipePage() {
  const { currentOrg } = useOrganization();
  const subtitle = currentOrg?.name ?? '';
  return (
    <DashboardLayout title="Équipe" subtitle={subtitle}>
      <EquipeContent />
    </DashboardLayout>
  );
}
