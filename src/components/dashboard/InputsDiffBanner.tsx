import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Plus, PenLine } from 'lucide-react';

interface InputsDiffBannerProps {
  enterpriseId: string;
}

export default function InputsDiffBanner({ enterpriseId }: InputsDiffBannerProps) {
  const [diffData, setDiffData] = useState<any>(null);

  useEffect(() => {
    supabase
      .from('inputs_history' as any)
      .select('diff, documents_added, created_at, trigger')
      .eq('enterprise_id', enterpriseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }: any) => {
        if (data?.diff && data.trigger !== 'initial') setDiffData(data);
      });
  }, [enterpriseId]);

  if (!diffData) return null;

  const d = diffData.diff;
  const hasChanges = (d.added?.length > 0) || (d.modified?.length > 0);
  if (!hasChanges) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800 mb-4">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-2">
          <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
              Données mises à jour le {new Date(diffData.created_at).toLocaleDateString('fr-FR')}
            </p>
            {diffData.documents_added?.length > 0 && (
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                Documents ajoutés : {diffData.documents_added.join(', ')}
              </p>
            )}

            {d.added?.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Nouvelles données
                </p>
                {d.added.slice(0, 8).map((a: string, i: number) => (
                  <p key={i} className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-4">+ {a}</p>
                ))}
                {d.added.length > 8 && (
                  <p className="text-[10px] text-emerald-500 ml-4">… et {d.added.length - 8} autres</p>
                )}
              </div>
            )}

            {d.modified?.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <PenLine className="h-3 w-3" /> Données modifiées
                </p>
                {d.modified.slice(0, 8).map((m: string, i: number) => (
                  <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400 ml-4">~ {m}</p>
                ))}
                {d.modified.length > 8 && (
                  <p className="text-[10px] text-amber-500 ml-4">… et {d.modified.length - 8} autres</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
