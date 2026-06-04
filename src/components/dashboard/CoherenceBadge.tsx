// Brief 0.12 — Badge cohérence inter-livrables. Lit
// enterprise_financial_canonical.coherence_* et affiche un badge avec
// popover listant les divergences. Silencieux si tout est OK.
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CoherenceWarning {
  rule: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  fields?: string[];
}

interface CanonicalCoherence {
  coherence_validated: boolean | null;
  coherence_warnings: CoherenceWarning[] | null;
  coherence_last_check_at: string | null;
}

interface Props {
  enterpriseId: string;
  /** Si true, affiche aussi le badge vert "Cohérence validée" quand tout est OK. */
  showWhenClean?: boolean;
}

export default function CoherenceBadge({ enterpriseId, showWhenClean = false }: Props) {
  const [data, setData] = useState<CanonicalCoherence | null>(null);

  useEffect(() => {
    if (!enterpriseId) return;
    let active = true;
    (async () => {
      const { data: row } = await supabase
        .from('enterprise_financial_canonical')
        .select('coherence_validated, coherence_warnings, coherence_last_check_at')
        .eq('enterprise_id', enterpriseId)
        .maybeSingle();
      if (active) setData(row as CanonicalCoherence | null);
    })();
    return () => {
      active = false;
    };
  }, [enterpriseId]);

  if (!data) return null;

  const warnings = Array.isArray(data.coherence_warnings) ? data.coherence_warnings : [];
  const criticals = warnings.filter((w) => w.severity === 'error').length;
  const valid = !!data.coherence_validated;

  if (warnings.length === 0) {
    if (!showWhenClean) return null;
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Cohérence validée
      </Badge>
    );
  }

  const variant = valid ? 'secondary' : 'destructive';
  const className = valid ? 'gap-1 bg-amber-50 text-amber-900 border border-amber-300 cursor-pointer' : 'gap-1 cursor-pointer';
  const label = valid
    ? `${warnings.length} divergence${warnings.length > 1 ? 's' : ''} mineure${warnings.length > 1 ? 's' : ''}`
    : `${criticals} incohérence${criticals > 1 ? 's' : ''} critique${criticals > 1 ? 's' : ''}`;
  const Icon = valid ? AlertTriangle : ShieldAlert;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant={variant as any} className={className}>
          <Icon className="h-3 w-3" />
          {label}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-96 overflow-auto" align="start">
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            Cohérence inter-livrables {valid ? '(divergences mineures)' : '(critique)'}
          </p>
          {data.coherence_last_check_at && (
            <p className="text-xs text-muted-foreground">
              Dernier check : {new Date(data.coherence_last_check_at).toLocaleString('fr-FR')}
            </p>
          )}
          <ul className="space-y-2 text-xs">
            {warnings.map((w, i) => (
              <li key={i} className="border-l-2 border-l-muted pl-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={w.severity === 'error' ? 'destructive' : 'secondary'}
                    className="text-[10px]"
                  >
                    {w.severity === 'error' ? 'CRITIQUE' : 'WARNING'}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{w.rule}</span>
                </div>
                <p className="mt-1">{w.message}</p>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
