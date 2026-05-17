// src/components/ba/sections/ValuationBaSection.tsx
// Valuation BA — wrapper PeValuationView (feature #13 valuation_ba).
//
// Brief #13 : 8/8 critères livrés via réutilisation PE.
// PeValuationView fait déjà :
//   - generate-pe-valuation EF v6 (DCF 7 ans, multiples, ANCC, WACC Afrique)
//   - Sensitivity matrix 5x5
//   - Multiples comparables knowledge_benchmarks
//   - Export PDF + XLSX (render-document kind valuation)
//
// Alignement CLAUDE.md "Design PE comme référence".

import PeValuationView from '@/components/pe/PeValuationView';

interface Props {
  dealId: string;
}

export default function ValuationBaSection({ dealId }: Props) {
  return (
    <div className="max-w-5xl mx-auto">
      <PeValuationView dealId={dealId} />
    </div>
  );
}
