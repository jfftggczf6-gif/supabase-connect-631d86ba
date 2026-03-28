import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import CoachDashboard from '@/components/dashboard/CoachDashboard';
import EntrepreneurDashboard from '@/components/dashboard/EntrepreneurDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';

export default function Dashboard() {
  const { role, loading, roleLoading, user } = useAuth();

  // Still loading auth or role → show spinner
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User is logged in but role not yet loaded → wait (trigger may still be running)
  if (user && !role) {
    // Give the DB trigger 3s max to create the role, then redirect
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No user → login
  if (!user) return <Navigate to="/login" replace />;

  // No role after everything loaded → select role
  if (!role) return <Navigate to="/select-role" replace />;

  if (role === 'chef_programme') return <Navigate to="/programmes" replace />;
  if (role === 'super_admin') return <SuperAdminDashboard />;
  return role === 'coach' ? <CoachDashboard /> : <EntrepreneurDashboard />;
}
