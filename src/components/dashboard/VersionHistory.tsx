import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { History, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Version {
  id: string;
  version: number;
  score: number | null;
  generated_by: string;
  trigger_reason: string | null;
  created_at: string;
  data: any;
  validation_report: any;
}

interface Props {
  deliverableId?: string;
  enterpriseId: string;
  deliverableType: string;
  onRestore?: () => void;
}

export default function VersionHistory({ deliverableId, onRestore }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState<[Version, Version] | null>(null);

  const fetchVersions = async () => {
    if (!deliverableId) return;
    setLoading(true);
    const { data } = await supabase
      .from('deliverable_versions')
      .select('*')
      .eq('deliverable_id', deliverableId)
      .order('version', { ascending: false })
      .limit(10) as any;
    setVersions(data || []);
    setLoading(false);
  };

  const handleRestore = async (version: Version) => {
    if (!deliverableId) return;
    const { error } = await supabase
      .from('deliverables')
      .update({ data: version.data, score: version.score, version: version.version })
      .eq('id', deliverableId);
    if (error) {
      toast.error('Erreur lors de la restauration');
    } else {
      toast.success(`Version ${version.version} restaurée`);
      onRestore?.();
    }
  };

  const diffKeys = (a: any, b: any, prefix = ''): string[] => {
    if (!a || !b) return [];
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      if (key.startsWith('_')) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof a[key] === 'object' && typeof b[key] === 'object' && !Array.isArray(a[key])) {
        changes.push(...diffKeys(a[key], b[key], path));
      } else if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        changes.push(path);
      }
    }
    return changes.slice(0, 30);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchVersions}>
          <History className="h-3.5 w-3.5" /> Historique
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Historique des versions
          </DialogTitle>
        </DialogHeader>

        {comparing ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setComparing(null)} className="mb-3 gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Retour
            </Button>
            <h4 className="text-sm font-medium mb-2">
              Diff v{comparing[0].version} → v{comparing[1].version}
            </h4>
            <ScrollArea className="h-64">
              <div className="space-y-1 text-xs">
                {diffKeys(comparing[0].data, comparing[1].data).map(path => (
                  <div key={path} className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/20 font-mono">
                    <span className="text-amber-600">{path}</span>
                  </div>
                ))}
                {diffKeys(comparing[0].data, comparing[1].data).length === 0 && (
                  <p className="text-muted-foreground">Aucune différence détectée</p>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            {loading ? (
              <p className="text-sm text-muted-foreground p-4">Chargement…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Aucune version antérieure</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v, i) => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">v{v.version}</Badge>
                        {v.score != null && (
                          <span className="text-xs text-muted-foreground">Score: {v.score}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(v.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {v.trigger_reason && ` — ${v.trigger_reason}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {i < versions.length - 1 && (
                        <Button variant="ghost" size="sm" className="text-xs h-7"
                          onClick={() => setComparing([versions[i + 1], v])}>
                          Diff
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1"
                        onClick={() => handleRestore(v)}>
                        <RotateCcw className="h-3 w-3" /> Restaurer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
