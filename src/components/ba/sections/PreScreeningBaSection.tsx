// src/components/ba/sections/PreScreeningBaSection.tsx
// Pre-screening 360° pour les mandats BA.
//
// Brief #11 pre_screening_ba (Ordre 11) — wireframe PreScreenPage (11 sections).
//
// Stratégie (cf. CLAUDE.md "Design PE comme référence") :
// On RÉUTILISE le composant PE PreScreening360Dashboard qui :
//   - appelle déjà generate-pe-pre-screening (EF Railway v7)
//   - rend les 11 blocs (activité · actionnariat · management · KPIs · snapshot
//     financier 3 ans · utilisation fonds · scénarios BEAR/BASE/BULL · adéquation
//     thèse · red flags SYSCOHADA · qualité dossier · benchmark · recommandation)
//   - intègre knowledge_benchmarks, IFC standards, scoring
//   - gère regenerate / save brouillon
//
// Le wireframe BA et le composant PE sont à 95% équivalents en termes de structure.
// Une variation de prompt "ton vendeur" sera intégrée dans une session prompt-engineering
// dédiée (sans toucher au front).

import PreScreening360Dashboard from '@/components/pe/PreScreening360Dashboard';

interface Props {
  dealId: string;
}

export default function PreScreeningBaSection({ dealId }: Props) {
  return (
    <div className="max-w-5xl mx-auto">
      <PreScreening360Dashboard dealId={dealId} />
    </div>
  );
}
