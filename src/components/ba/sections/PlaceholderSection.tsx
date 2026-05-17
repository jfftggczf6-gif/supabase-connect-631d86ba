// src/components/ba/sections/PlaceholderSection.tsx
// Placeholder pour les sections du MandatShell dont la feature dédiée n'est pas
// encore buildée (upload_documents, info_analyste, pre_screening, etc.).
// Brief mandat_detail_layout critère #12 : "Composants vides (placeholder) pour
// les features pas encore buildées".

import { Card } from '@/components/ui/card';
import { Hammer } from 'lucide-react';

interface Props {
  /** Nom de la feature (ex: 'upload_documents'). Aide le user à comprendre quoi attendre. */
  featureName: string;
  /** Titre court affiché (ex: 'Documents du mandant'). */
  title: string;
  /** Brève description de ce que la section fera quand elle sera construite. */
  description: string;
}

export default function PlaceholderSection({ featureName, title, description }: Props) {
  return (
    <Card className="p-8 text-center max-w-2xl mx-auto mt-8">
      <div className="flex justify-center mb-3">
        <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
          <Hammer className="h-6 w-6 text-amber-600" />
        </div>
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-3 max-w-md mx-auto">
        {description}
      </p>
      <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
        Feature en cours · <span className="font-semibold">{featureName}</span>
      </div>
    </Card>
  );
}
