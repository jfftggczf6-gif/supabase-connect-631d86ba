import DashboardLayout from '@/components/dashboard/DashboardLayout';
import KnowledgeBaseManager from '@/components/dashboard/KnowledgeBaseManager';
import { useAuth } from '@/hooks/useAuth';

export default function KnowledgePage() {
  const { role } = useAuth();
  const isAdmin = role === 'super_admin';

  return (
    <DashboardLayout title="Base de connaissances" subtitle="Documents, ressources et benchmarks sectoriels">
      <KnowledgeBaseManager isAdmin={isAdmin} />
    </DashboardLayout>
  );
}
