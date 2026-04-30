import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useParams } from 'react-router-dom';

export default function PeDealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  return <DashboardLayout title="Deal"><p>Stub deal {dealId} — remplacé en Task 12</p></DashboardLayout>;
}
