import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProgrammeCard from '@/components/programmes/ProgrammeCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function ProgrammeListPage() {
  const { role } = useAuth();
  const nav = useNavigate();
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'list' }
      });
      if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); }
      setProgrammes(data?.programmes || data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = statusFilter === 'all'
    ? programmes
    : programmes.filter(p => p.status === statusFilter);

  const isSuperAdmin = role === 'super_admin';

  return (
    <DashboardLayout title="Programmes" subtitle="Gérez vos appels à candidatures et programmes d'accompagnement">
      <div className="flex items-center justify-between mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrer par statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="open">Ouvert</SelectItem>
            <SelectItem value="closed">Clôturé</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => nav('/programmes/new')} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau programme
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">Aucun programme</p>
          <p className="text-sm mt-1">Créez votre premier appel à candidatures</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProgrammeCard key={p.id} programme={p} showChef={isSuperAdmin} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
