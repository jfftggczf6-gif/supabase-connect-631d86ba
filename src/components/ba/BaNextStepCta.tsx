// BaNextStepCta — bouton violet "Étape suivante" stage-aware pour BA.
// Aligné sur PeNextStepCta. Affiché dans MandatSubHeader.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { getBaNextStep } from '@/lib/ba-next-step';
import type { MandatDetailBundle } from '@/types/ba-shell';

interface Props {
  dealId: string;
  stats: MandatDetailBundle['stats'];
  onNavigate?: (item: string) => void;
  /** Brief P8 fix #4 — appelé après dispatch EF pour rafraîchir les stats parent. */
  onLaunched?: () => void;
}

export default function BaNextStepCta({ dealId, stats, onNavigate, onLaunched }: Props) {
  const [launching, setLaunching] = useState(false);
  const next = getBaNextStep(stats);
  if (!next) return null;

  async function handleClick() {
    if (!next || launching) return;
    setLaunching(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${next.edgeFunction}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ deal_id: dealId, tone: 'ba' }),
        },
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Échec du lancement');
      toast.success(`${next.toastLabel} lancé`, {
        description: 'Tu vas être redirigé. Le bouton se mettra à jour automatiquement à la fin de la génération.',
      });
      onNavigate?.(next.navigateTo);
      onLaunched?.();
    } catch (e: any) {
      toast.error(`Lancement échoué : ${e.message}`);
    } finally {
      setLaunching(false);
    }
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
