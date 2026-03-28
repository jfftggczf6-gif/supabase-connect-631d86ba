import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SectionEditButtonProps {
  enterpriseId: string;
  deliverableType: string;
  sectionPath: string;
  sectionTitle: string;
  onUpdated: () => void;
}

const SUPPORTED_TYPES = [
  'bmc_analysis', 'sic_analysis', 'diagnostic_data', 'business_plan',
  'odd_analysis', 'pre_screening', 'valuation', 'screening_report',
  'plan_financier', 'inputs_data', 'framework_data',
  'onepager', 'investment_memo',
];

const FINANCE_TYPES = ['plan_financier', 'inputs_data', 'framework_data'];

const FINANCE_PLACEHOLDERS: Record<string, string> = {
  plan_financier: "Ex: Le CA réel 2024 est de 500M, pas 460M. Ajoute 2 commerciaux en 2026. Réduis l'OPEX marketing de 30%...",
  inputs_data: "Ex: Le bilan actif total est de 250M, pas 204M. Ajoute une ligne Crédit-bail de 40M...",
  framework_data: "Ex: Le ratio d'endettement devrait être de 45%, pas 59%. Ajoute un scénario pessimiste avec -20% de CA...",
};

export default function SectionEditButton({
  enterpriseId,
  deliverableType,
  sectionPath,
  sectionTitle,
  onUpdated,
}: SectionEditButtonProps) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);

  // Only coaches and super_admins can edit
  if (role !== 'coach' && role !== 'super_admin') return null;
  if (!SUPPORTED_TYPES.includes(deliverableType)) return null;

  const isFinanceType = FINANCE_TYPES.includes(deliverableType);

  const handleSubmit = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    const controller = new AbortController();
    const timeout = isFinanceType ? 45000 : 30000;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-deliverable-section`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enterprise_id: enterpriseId,
            deliverable_type: deliverableType,
            section_path: sectionPath,
            instruction: instruction.trim(),
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timer);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(err.error || `Erreur ${response.status}`);
      }

      const result = await response.json();
      toast({
        title: isFinanceType
          ? `✅ Données financières mises à jour (v${result.version || '?'})`
          : `✅ Section modifiée (v${result.version || '?'})`,
        description: isFinanceType
          ? `${sectionTitle} — L'Excel sera regénéré au prochain téléchargement.`
          : sectionTitle,
      });
      setOpen(false);
      setInstruction('');
      onUpdated();
    } catch (err: any) {
      clearTimeout(timer);
      toast({
        title: '❌ Erreur de modification',
        description: err.name === 'AbortError' ? 'Délai dépassé — réessayez' : (err.message || 'Erreur inconnue'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-5 w-5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-primary"
        title={`Modifier : ${sectionTitle}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[450px]">
          <SheetHeader>
            <SheetTitle>✏️ Modifier : {sectionTitle}</SheetTitle>
            <SheetDescription>
              Décrivez la modification souhaitée. L'IA appliquera le changement sur cette section.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {isFinanceType && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠️ <strong>Modification financière</strong> : les changements de chiffres seront recalculés en cascade sur les projections et ratios. Le cache Excel sera invalidé et regénéré au prochain téléchargement.
              </div>
            )}

            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={FINANCE_PLACEHOLDERS[deliverableType] || "Ex: Reformule cette section, ajoute un concurrent, corrige le montant à 500M..."}
              rows={4}
              disabled={loading}
              className="resize-none"
            />

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !instruction.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isFinanceType ? 'Recalcul en cours...' : 'Modification en cours...'}
                  </>
                ) : (
                  isFinanceType ? 'Appliquer et recalculer ✨' : 'Appliquer ✨'
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
