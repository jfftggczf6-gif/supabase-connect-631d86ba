import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import CoachDashboard from '@/components/dashboard/CoachDashboard';
import EntrepreneurDashboard from '@/components/dashboard/EntrepreneurDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
export default function Dashboard() {
  const { role, loading, roleLoading, user } = useAuth();

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role) return <Navigate to="/select-role" replace />;

  if (role === 'super_admin') return <SuperAdminDashboard />;
  return role === 'coach' ? <CoachDashboard /> : <EntrepreneurDashboard />;
}
