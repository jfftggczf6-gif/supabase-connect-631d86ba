import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Cpu, PenLine, Share2, Download, Eye } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ActivityEntry {
  id: string;
  action: string;
  actor_role: string;
  resource_type: string;
  deliverable_type: string | null;
  metadata: any;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  generate: { icon: Cpu, label: 'Génération IA', color: 'text-blue-500' },
  upload: { icon: Upload, label: 'Upload', color: 'text-green-500' },
  correction: { icon: PenLine, label: 'Correction', color: 'text-amber-500' },
  share: { icon: Share2, label: 'Partage', color: 'text-purple-500' },
  download: { icon: Download, label: 'Téléchargement', color: 'text-indigo-500' },
  view: { icon: Eye, label: 'Consultation', color: 'text-gray-500' },
};

const ROLE_LABELS: Record<string, string> = {
  ai: 'IA',
  coach: 'Coach',
  entrepreneur: 'Entrepreneur',
  system: 'Système',
};

interface Props {
  enterpriseId: string;
  limit?: number;
}

export default function ActivityTimeline({ enterpriseId, limit = 20 }: Props) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enterpriseId) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('enterprise_id', enterpriseId)
        .order('created_at', { ascending: false })
        .limit(limit) as any;
      setActivities(data || []);
      setLoading(false);
    };
    fetch();
  }, [enterpriseId, limit]);

  if (loading) return <p className="text-xs text-muted-foreground p-4">Chargement…</p>;
  if (activities.length === 0) return <p className="text-xs text-muted-foreground p-4">Aucune activité enregistrée</p>;

  return (
    <ScrollArea className="max-h-80">
      <div className="relative pl-6 space-y-3">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
        {activities.map(a => {
          const config = ACTION_CONFIG[a.action] || ACTION_CONFIG.view;
          const Icon = config.icon;
          const date = new Date(a.created_at);
          const timeStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
            ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={a.id} className="relative flex gap-3">
              <div className={`absolute -left-3.5 w-5 h-5 rounded-full bg-background border-2 flex items-center justify-center ${config.color}`}>
                <Icon className="h-2.5 w-2.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{config.label}</span>
                  {a.deliverable_type && (
                    <Badge variant="outline" className="text-[10px] px-1.5">{a.deliverable_type}</Badge>
                  )}
                  <span className="text-muted-foreground ml-auto shrink-0">{timeStr}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {ROLE_LABELS[a.actor_role] || a.actor_role}
                  {a.metadata?.version && ` — v${a.metadata.version}`}
                  {a.metadata?.score != null && ` — Score: ${a.metadata.score}`}
                  {a.metadata?.validation_errors > 0 && (
                    <span className="text-red-500"> ({a.metadata.validation_errors} erreur{a.metadata.validation_errors > 1 ? 's' : ''})</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
