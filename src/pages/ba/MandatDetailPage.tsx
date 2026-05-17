// src/pages/ba/MandatDetailPage.tsx
// Route /ba/deals/:dealId — page d'accueil d'un mandat BA.
// Wraps MandatShell dans DashboardLayout. Charge le bundle via useMandatDetail.

import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useMandatDetail } from '@/hooks/useMandatDetail';
import MandatShell from '@/components/ba/MandatShell';

export default function MandatDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { currentOrg } = useOrganization();
  const { role } = useCurrentRole();
  const { bundle, loading, error } = useMandatDetail(dealId, currentOrg?.id);

  const title = bundle?.mandat?.enterprise_name || bundle?.mandat?.deal_ref || 'Mandat';

  if (loading) {
    return (
      <DashboardLayout title="Chargement…">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !bundle) {
    return (
      <DashboardLayout title="Mandat introuvable">
        <Card className="p-8 text-center max-w-lg mx-auto mt-12">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold mb-1">Mandat introuvable</h2>
          <p className="text-sm text-muted-foreground">
            {error || "Ce mandat n'existe pas ou vous n'y avez pas accès."}
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={title} fullscreen>
      <MandatShell bundle={bundle} role={role} />
    </DashboardLayout>
  );
}
