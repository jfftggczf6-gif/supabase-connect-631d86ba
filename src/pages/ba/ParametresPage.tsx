// src/pages/ba/ParametresPage.tsx
// Route standalone /ba/parametres — Partner only. Wrap ParametresContent dans
// le DashboardLayout. Aussi accessible via le tab Paramètres du BaWorkspacePage.

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import ParametresContent from '@/components/ba/parametres/ParametresContent';

export default function ParametresPage() {
  const { currentOrg } = useOrganization();
  return (
    <DashboardLayout title="Paramètres" subtitle={currentOrg?.name ?? 'Configuration du fonds'}>
      <ParametresContent />
    </DashboardLayout>
  );
}
