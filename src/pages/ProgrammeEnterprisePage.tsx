import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen } from 'lucide-react';
import EntrepreneurDashboard from '@/components/dashboard/EntrepreneurDashboard';

export default function ProgrammeEnterprisePage() {
  const { t } = useTranslation();
  const { id: programmeId, enterpriseId } = useParams<{ id: string; enterpriseId: string }>();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-violet-50 border-b border-violet-200 px-6 py-2 flex items-center gap-3">
        <button onClick={() => nav(`/programmes/${programmeId}`)} className="flex items-center gap-1 text-sm text-violet-700 hover:text-violet-900">
          <ArrowLeft className="h-4 w-4" /> {t('programme.back_to_programme')}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm text-violet-600">
          <BookOpen className="h-4 w-4" />
          {t('programme.readonly_view')}
        </div>
      </div>
      <EntrepreneurDashboard
        enterpriseId={enterpriseId}
        coachMode={false}
        readOnly
      />
    </div>
  );
}
