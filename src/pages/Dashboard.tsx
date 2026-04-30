import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import CoachDashboard from '@/components/dashboard/CoachDashboard';
import EntrepreneurDashboard from '@/components/dashboard/EntrepreneurDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import NoOrganizationScreen from '@/components/NoOrganizationScreen';

export default function Dashboard() {
  const { role: authRole, loading: authLoading, roleLoading, user } = useAuth();
  const { currentOrg, currentRole: orgRole, isSuperAdmin, loading: orgLoading } = useOrganization();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (user && !authRole && !authLoading && !roleLoading) {
      const timer = setTimeout(() => setWaited(true), 6000);
      return () => clearTimeout(timer);
    }
    if (authRole) setWaited(false);
  }, [user, authRole, authLoading, roleLoading]);

  // Still loading
  if (authLoading || roleLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Wait for role
  if (user && !authRole && !waited) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!authRole) return <Navigate to="/select-role" replace />;

  // Debug (aide à diagnostiquer les mauvaises redirections)
  if (typeof window !== 'undefined') {
    console.log('[Dashboard] Routing decision:', { authRole, orgRole, currentOrg: currentOrg?.name, isSuperAdmin });
  }

  // Super admin → god mode (SuperAdminDashboard)
  if (isSuperAdmin && authRole === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  // Pas d'org → écran NoOrganization
  if (!currentOrg) {
    return <NoOrganizationScreen />;
  }

  // Org PE → tout le monde (sauf entrepreneur) atterrit sur le pipeline PE
  const peRoles = [
    'owner', 'admin', 'manager',
    'managing_director', 'investment_manager', 'analyst', 'partner',
  ];
  if (currentOrg.type === 'pe' && orgRole && peRoles.includes(orgRole)) {
    return <Navigate to="/pe/pipeline" replace />;
  }

  // Dispatch par rôle dans l'org
  // manager = chef de programme / MD → redirige vers programmes
  if (orgRole === 'manager') {
    return <Navigate to="/programmes" replace />;
  }

  // coach = coach programme / analyste PE
  if (orgRole === 'coach' || orgRole === 'analyst') {
    return <CoachDashboard />;
  }

  // entrepreneur
  if (orgRole === 'entrepreneur') {
    return <EntrepreneurDashboard />;
  }

  // owner / admin → même vue que manager (programmes)
  if (orgRole === 'owner' || orgRole === 'admin') {
    return <Navigate to="/programmes" replace />;
  }

  // orgRole inconnu mais user a un authRole legacy → fallback
  if (authRole === 'chef_programme') return <Navigate to="/programmes" replace />;
  if (authRole === 'coach') return <CoachDashboard />;

  // Aucun rôle org reconnu → afficher NoOrganizationScreen plutôt que servir EntrepreneurDashboard par défaut
  // (évite que les owners atterrissent sur l'écran 'Ajouter un entrepreneur')
  if (!orgRole) {
    return <NoOrganizationScreen />;
  }

  // Rôle org inconnu (ex: rôle ajouté futur sans handler) — montrer entrepreneur dashboard par défaut
  return <EntrepreneurDashboard />;
}
