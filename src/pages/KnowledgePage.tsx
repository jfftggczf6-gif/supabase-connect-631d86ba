import DashboardLayout from '@/components/dashboard/DashboardLayout';
import KnowledgeBaseManager from '@/components/dashboard/KnowledgeBaseManager';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function KnowledgePage() {
  const { role } = useAuth();
  const { isSuperAdmin, currentRole: orgRole } = useOrganization();
  // Admin KB = super_admin (legacy ou org) OU owner/admin d'une org
  const isAdmin = isSuperAdmin || role === 'super_admin' || orgRole === 'owner' || orgRole === 'admin';

  return (
    <DashboardLayout title="Base de connaissances" subtitle="Documents, ressources et benchmarks sectoriels">
      <KnowledgeBaseManager isAdmin={isAdmin} />
    </DashboardLayout>
  );
}
