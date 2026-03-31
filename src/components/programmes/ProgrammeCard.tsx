import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProgrammeStatusBadge from './ProgrammeStatusBadge';
import { MapPin, Banknote, Users, CalendarDays, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Programme {
  id: string;
  name: string;
  organization?: string | null;
  status: string;
  country_filter?: string[] | null;
  budget?: number | null;
  currency?: string | null;
  nb_places?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  candidatures_count?: number;
  chef_name?: string | null;
  type?: string | null;
}

export default function ProgrammeCard({ programme, showChef, onDeleted }: { programme: Programme; showChef?: boolean; onDeleted?: () => void }) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const fmt = (d: string | null | undefined) => d ? format(new Date(d), 'd MMM yyyy', { locale: fr }) : '—';

  const handleDelete = async () => {
    if (!confirm(`${t('common.delete')} "${programme.name}" ?`)) return;
    const { error } = await supabase.functions.invoke('manage-programme', {
      body: { action: 'delete', id: programme.id }
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${programme.name} ${t('common.delete').toLowerCase()}`);
    onDeleted?.();
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => nav(`/programmes/${programme.id}`)}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-base">🏢 {programme.name}</h3>
            {programme.organization && (
              <p className="text-xs text-muted-foreground">Organisation : {programme.organization}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {programme.type === 'cohorte_directe' && <Badge variant="outline" className="text-[10px]">Cohorte</Badge>}
            <ProgrammeStatusBadge status={programme.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {programme.country_filter?.length ? (
            <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {programme.country_filter.join(', ')}</div>
          ) : null}
          {programme.budget ? (
            <div className="flex items-center gap-1"><Banknote className="h-3 w-3" /> {programme.budget.toLocaleString()} {programme.currency || ''}</div>
          ) : null}
          {programme.nb_places ? (
            <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {programme.nb_places} places</div>
          ) : null}
          <div className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmt(programme.start_date)} — {fmt(programme.end_date)}</div>
        </div>

        {showChef && programme.chef_name && (
          <p className="text-xs text-muted-foreground">Chef : {programme.chef_name}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs font-medium">{programme.candidatures_count ?? 0} candidatures</span>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => nav(`/programmes/${programme.id}`)}>
              {t('dashboard_coach.view')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
