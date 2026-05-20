// src/components/ba/sections/ValuationBaSection.tsx
// Valuation BA — wrapper PeValuationView (feature #13 valuation_ba).
//
// Brief P7 ordre 26 : empty state aligné PE (violet + ✨) au lieu de Calculator gris.
//
// PeValuationView fait déjà :
//   - generate-pe-valuation EF v6 (DCF 7 ans, multiples, ANCC, WACC Afrique)
//   - Sensitivity matrix 5x5
//   - Multiples comparables knowledge_benchmarks
//   - Export PDF + XLSX (render-document kind valuation)
//
// Alignement CLAUDE.md "Design PE comme référence".

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PeValuationView from '@/components/pe/PeValuationView';
import EmptyStateGenerate from '@/components/shared/EmptyStateGenerate';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  dealId: string;
}

export default function ValuationBaSection({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [hasContent, setHasContent] = useState(false);

  const check = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pe_valuation')
      .select('id,status')
      .eq('deal_id', dealId)
      .maybeSingle();
    setHasContent(!!data && (data as any).status === 'ready');
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
        edgeFunction="generate-pe-valuation"
        label="Générer la valorisation"
        description="L'IA produit une valorisation selon 3 méthodes (DCF 7 ans, Multiples sectoriels, ANCC) avec synthèse pondérée et matrice de sensibilité. Le memo IM vendeur sera automatiquement synchronisé."
        toastLabel="Valorisation"
        onLaunched={check}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PeValuationView dealId={dealId} />
    </div>
  );
}
