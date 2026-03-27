import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CoachDashboard from '@/components/dashboard/CoachDashboard';
import EntrepreneurDashboard from '@/components/dashboard/EntrepreneurDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
export default function Dashboard() {
  const { role, loading, roleLoading, user, setRole } = useAuth();
  const [retried, setRetried] = useState(false);

  // After fresh signup, role might not be loaded yet — retry once from DB
  useEffect(() => {
    if (user && !role && !roleLoading && !loading && !retried) {
      setRetried(true);
      supabase.from('user_roles').select('role').eq('user_id', user.id).then(({ data }) => {
        if (data && data.length > 0) {
          setRole(data[0].role);
        }
      });
    }
  }, [user, role, roleLoading, loading, retried]);

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Wait for retry before redirecting to select-role
  if (!role && user && !retried) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role) return <Navigate to="/select-role" replace />;

  // Chef de programme → redirige vers /programmes
  if (role === 'chef_programme') return <Navigate to="/programmes" replace />;

  if (role === 'super_admin') return <SuperAdminDashboard />;
  return role === 'coach' ? <CoachDashboard /> : <EntrepreneurDashboard />;
}
