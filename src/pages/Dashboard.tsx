import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import CoachDashboard from '@/components/dashboard/CoachDashboard';
import EntrepreneurDashboard from '@/components/dashboard/EntrepreneurDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';

export default function Dashboard() {
  const { role, loading, roleLoading, user } = useAuth();
  const [waited, setWaited] = useState(false);

  // If user is logged in but role is null after loading, wait 3s then give up
  useEffect(() => {
    if (user && !role && !loading && !roleLoading) {
      const timer = setTimeout(() => setWaited(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [user, role, loading, roleLoading]);

  // Still loading
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User logged in but no role yet — wait up to 3s
  if (user && !role && !waited) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/select-role" replace />;

  if (role === 'chef_programme') return <Navigate to="/programmes" replace />;
  if (role === 'super_admin') return <SuperAdminDashboard />;
  return role === 'coach' ? <CoachDashboard /> : <EntrepreneurDashboard />;
}
