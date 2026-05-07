// PeNextStepCta — bouton violet "Étape suivante" stage-aware.
// Lance l'edge function correspondante puis bascule sur l'item de sidebar cible.
// Utilisé dans le header de PeDealDetailPage et dans les empty states de livrables.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { getPeNextStep } from '@/lib/pe-next-step';

interface Props {
  dealId: string;
  dealStage: string | undefined | null;
  onNavigate?: (item: string) => void;
  /** Variante visuelle : 'default' = bouton standard, 'large' = empty state hero. */
  variant?: 'default' | 'large';
  /**
   * Si true, masque le CTA aux stages sourcing/pre_screening
   * (utilisé dans le header — le pré-screening a son propre CTA dans Upload).
   */
  hidePreScreening?: boolean;
}

const PRE_SCREENING_STAGES = new Set(['sourcing', 'pre_screening']);

export default function PeNextStepCta({ dealId, dealStage, onNavigate, variant = 'default', hidePreScreening }: Props) {
  const [launching, setLaunching] = useState(false);
  const next = getPeNextStep(dealStage);
  if (!next) return null;
  if (hidePreScreening && dealStage && PRE_SCREENING_STAGES.has(dealStage)) return null;

  async function handleClick() {
    if (!next || launching) return;
    setLaunching(true);
    try {
      if (!next.edgeFunction) {
        onNavigate?.(next.navigateTo);
        return;
      }
      const token = await getValidAccessToken(null);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${next.edgeFunction}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ deal_id: dealId }),
        },
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Échec du lancement');
      toast.success(`${next.toastLabel} lancé`, {
        description: 'Tu vas être redirigé vers la page de progression.',
      });
      onNavigate?.(next.navigateTo);
    } catch (e: any) {
      toast.error(`Lancement échoué : ${e.message}`);
    } finally {
      setLaunching(false);
    }
  }

  if (variant === 'large') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-violet-600" />
        </div>
        <p className="text-sm text-muted-foreground">Lancer le pipeline IA</p>
        <Button
          onClick={handleClick}
          disabled={launching}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          size="lg"
        >
          {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {next.label}
          {!launching && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={launching}
      size="sm"
      className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
    >
      {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {next.label}
    </Button>
  );
}
