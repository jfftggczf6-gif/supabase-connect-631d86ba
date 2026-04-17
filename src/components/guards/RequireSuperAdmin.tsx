import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useOrganization();

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
