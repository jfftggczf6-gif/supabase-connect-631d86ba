import { Navigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export default function PeRequireType({ children }: Props) {
  const { currentOrg, loading } = useOrganization();
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!currentOrg || currentOrg.type !== 'pe') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
