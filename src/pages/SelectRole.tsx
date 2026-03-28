import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Leaf, GraduationCap, Briefcase } from 'lucide-react';

export default function SelectRole() {
  const { t } = useTranslation();
  const { setRole, role } = useAuth();
  const navigate = useNavigate();

  if (role) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSelect = async (selectedRole: 'coach' | 'entrepreneur') => {
    const roleLabel = selectedRole === 'coach' ? t('auth.role_coach') : t('auth.role_entrepreneur');
    try {
      await setRole(selectedRole);
      toast.success(t('auth.role_activated', { role: roleLabel }));
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || t('auth.role_select_error'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Leaf className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">ESONO BIS</h1>
        </div>

        <h2 className="text-center text-xl font-display font-semibold mb-2">{t('auth.select_role')}</h2>
        <p className="text-center text-muted-foreground mb-8">{t('auth.role_permanent')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
            onClick={() => handleSelect('coach')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="font-display mt-4">{t('auth.role_coach')}</CardTitle>
              <CardDescription>
                {t('auth.coach_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>{t('auth.coach_feature_1')}</li>
                <li>{t('auth.coach_feature_2')}</li>
                <li>{t('auth.coach_feature_3')}</li>
                <li>{t('auth.coach_feature_4')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-secondary hover:shadow-lg transition-all group"
            onClick={() => handleSelect('entrepreneur')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <Briefcase className="h-8 w-8 text-secondary" />
              </div>
              <CardTitle className="font-display mt-4">{t('auth.role_entrepreneur')}</CardTitle>
              <CardDescription>
                {t('auth.entrepreneur_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>{t('auth.entrepreneur_feature_1')}</li>
                <li>{t('auth.entrepreneur_feature_2')}</li>
                <li>{t('auth.entrepreneur_feature_3')}</li>
                <li>{t('auth.entrepreneur_feature_4')}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
