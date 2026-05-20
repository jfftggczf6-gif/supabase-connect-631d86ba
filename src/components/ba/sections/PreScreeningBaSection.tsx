// src/components/ba/sections/PreScreeningBaSection.tsx
// Pre-screening 360° pour les mandats BA. Réutilise le composant PE
// PreScreening360Dashboard (95% équivalent) + empty state BA dédié
// (brief P7 #26 — bouton ✨ Générer centré).

import { useEffect, useState } from 'react';
import PreScreening360Dashboard from '@/components/pe/PreScreening360Dashboard';
import EmptyStateGenerate from '@/components/shared/EmptyStateGenerate';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  dealId: string;
}

export default function PreScreeningBaSection({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [hasContent, setHasContent] = useState(false);

  const check = async () => {
    setLoading(true);
    const { data: memo } = await supabase
      .from('investment_memos')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle();
    if (!memo) { setHasContent(false); setLoading(false); return; }
    const { data: vers } = await supabase
      .from('memo_versions')
      .select('id')
      .eq('memo_id', (memo as any).id)
      .eq('stage', 'pre_screening')
      .limit(1);
    setHasContent(Array.isArray(vers) && vers.length > 0);
    setLoading(false);
  };

  useEffect(() => { check(); }, [dealId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!hasContent) {
    return (
      <EmptyStateGenerate
        dealId={dealId}
        edgeFunction="generate-pe-pre-screening"
        label="Générer le pré-screening"
        description="L'IA va analyser les documents du dossier et produire un pré-screening 360° (11 sections, score, red flags, recommandation)."
        toastLabel="Pré-screening 360°"
        onLaunched={check}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PreScreening360Dashboard dealId={dealId} />
    </div>
  );
}
