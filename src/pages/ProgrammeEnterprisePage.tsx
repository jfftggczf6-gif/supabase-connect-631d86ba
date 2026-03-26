import { useParams, useNavigate } from 'react-router-dom';
import EntrepreneurDashboard from '@/components/dashboard/EntrepreneurDashboard';

/**
 * Read-only enterprise view for chef_programme.
 * Uses EntrepreneurDashboard with readOnly=true (no edit/regen buttons).
 */
export default function ProgrammeEnterprisePage() {
  const { id: programmeId, enterpriseId } = useParams<{ id: string; enterpriseId: string }>();
  const nav = useNavigate();

  return (
    <EntrepreneurDashboard
      enterpriseId={enterpriseId}
      showBackButton
      onBack={() => nav(`/programmes/${programmeId}`)}
      coachMode={false}
      readOnly
    />
  );
}
