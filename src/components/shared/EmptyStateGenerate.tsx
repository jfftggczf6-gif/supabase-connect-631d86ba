// shared/EmptyStateGenerate — État vide centré "✨ Générer..." aligné PE/BA.
//
// Brief #38 [CROSS] Mutualiser composants communs PE + BA. Avant : composant
// BA-only (BaEmptyStateGenerate). Réutilisable par tout viewer vide (PE ou BA)
// qui doit déclencher une génération IA via une edge function.
//
// Pattern : Card centré + Sparkles violet + description + bouton violet.

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface Props {
  dealId: string;
  /** Edge function à invoquer. */
  edgeFunction: string;
  /** Label du bouton (ex: "Générer le pré-screening"). */
  label: string;
  /** Texte court explicatif au-dessus du bouton. */
  description?: string;
  /** Toast de succès. */
  toastLabel?: string;
  /** Tone à passer dans le body — défaut 'ba'. Le PE peut passer 'pe' ou omettre. */
  tone?: 'pe' | 'ba';
  /** Body additionnel pour l'EF (mergé avec deal_id + tone). */
  extraBody?: Record<string, unknown>;
  /** Callback appelé après lancement (ex: reload local). */
  onLaunched?: () => void;
}

export default function EmptyStateGenerate({
  dealId, edgeFunction, label, description, toastLabel, tone = 'ba', extraBody, onLaunched,
}: Props) {
  const [launching, setLaunching] = useState(false);

  async function handleClick() {
    if (launching) return;
    setLaunching(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${edgeFunction}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ deal_id: dealId, tone, ...(extraBody ?? {}) }),
        },
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Échec du lancement');
      toast.success(`${toastLabel || label} lancé`, {
        description: 'Génération en cours. Le viewer se rafraîchit automatiquement.',
      });
      onLaunched?.();
    } catch (e: any) {
      toast.error(`Lancement échoué : ${e.message}`);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="p-0">
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
          <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-violet-600" />
          </div>
          {description && (
            <p className="text-sm text-muted-foreground max-w-md">{description}</p>
          )}
          <Button
            onClick={handleClick}
            disabled={launching}
            size="lg"
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {label}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
