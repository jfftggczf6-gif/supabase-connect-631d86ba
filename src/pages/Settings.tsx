import DashboardLayout from '@/components/dashboard/DashboardLayout';
import MFAEnrollment from '@/components/security/MFAEnrollment';
import GDPRPanel from '@/components/security/GDPRPanel';

export default function Settings() {
  return (
    <DashboardLayout title="Paramètres" subtitle="Sécurité et données personnelles">
      <div className="max-w-2xl space-y-6">
        <MFAEnrollment />
        <GDPRPanel />
      </div>
    </DashboardLayout>
  );
}
