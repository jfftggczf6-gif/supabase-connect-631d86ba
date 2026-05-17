// src/components/ba/synthese/_card.tsx
// Card minimaliste utilisée dans BusinessSyntheseView.
// Re-export du Card shadcn avec padding par défaut.

import { Card as ShadCard } from '@/components/ui/card';
import type { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
  return <ShadCard className="p-3">{children}</ShadCard>;
}
