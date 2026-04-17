import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProgrammeCard from '@/components/programmes/ProgrammeCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Users } from 'lucide-react';
import CreateCohorteDialog from '@/components/programmes/CreateCohorteDialog';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from '@/hooks/use-toast';

export default function ProgrammeListPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const { isSuperAdmin: isSuperAdminOrg } = useOrganization();
  const nav = useNavigate();
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCohorte, setShowCohorte] = useState(false);

  const fetchProgrammes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'list' }
      });
      if (error) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); }
      const list = Array.isArray(data?.programmes) ? data.programmes : Array.isArray(data) ? data : [];
      setProgrammes(list);
    } catch (e: any) {
      toast({ title: t('common.error'), description: e.message, variant: 'destructive' });
      setProgrammes([]);
    }
    setLoading(false);
  };

  // Reload on every mount (navigation back)
  useEffect(() => { fetchProgrammes(); }, []);

  const filtered = statusFilter === 'all'
    ? programmes
    : programmes.filter(p => p.status === statusFilter);

  const isSuperAdmin = isSuperAdminOrg || role === 'super_admin';

  return (
    <DashboardLayout title={t('programme.title')} subtitle={t('programme.subtitle')}>
      <div className="flex items-center justify-between mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('programme.filter_status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('programme.all_statuses')}</SelectItem>
            <SelectItem value="draft">{t('programme.status_draft')}</SelectItem>
            <SelectItem value="open">{t('programme.status_open')}</SelectItem>
            <SelectItem value="closed">{t('programme.status_closed')}</SelectItem>
            <SelectItem value="in_progress">{t('programme.status_in_progress')}</SelectItem>
            <SelectItem value="completed">{t('programme.status_completed')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setShowCohorte(true)} className="gap-2">
          <Users className="h-4 w-4" /> {t('programme.create_cohorte')}
        </Button>
        <Button onClick={() => nav('/programmes/new')} className="gap-2">
          <Plus className="h-4 w-4" /> {t('programme.create')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">{t('programme.no_programmes')}</p>
          <p className="text-sm mt-1">{t('programme.create_first')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProgrammeCard key={p.id} programme={p} showChef={isSuperAdmin} onDeleted={() => setProgrammes(prev => prev.filter(x => x.id !== p.id))} />
          ))}
        </div>
      )}
      <CreateCohorteDialog open={showCohorte} onOpenChange={setShowCohorte} />
    </DashboardLayout>
  );
}
