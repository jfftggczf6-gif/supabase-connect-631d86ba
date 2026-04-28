import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

type OrgRole =
  | 'owner' | 'admin' | 'manager' | 'coach' | 'analyst' | 'entrepreneur'
  // Rôles banque
  | 'conseiller_pme' | 'analyste_credit' | 'directeur_agence' | 'direction_pme' | 'directeur_pme' | 'partner';

interface RequireRoleProps {
  children: ReactNode;
  /** Liste des rôles d'org autorisés. super_admin passe toujours. */
  roles: OrgRole[];
  /** Redirection si refus. Par défaut /dashboard (Dashboard.tsx route alors selon le rôle réel). */
  fallback?: string;
}

export default function RequireRole({ children, roles, fallback = '/dashboard' }: RequireRoleProps) {
  const { currentRole, isSuperAdmin, loading } = useOrganization();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Super admin a tous les droits
  if (isSuperAdmin) return <>{children}</>;

  // Vérifier le rôle dans l'org active
  if (!currentRole || !roles.includes(currentRole as OrgRole)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
