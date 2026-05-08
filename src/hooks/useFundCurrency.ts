// useFundCurrency — Lit la devise par défaut du fonds depuis
// organizations.settings.pe_thesis.currency (paramétrée dans l'onglet
// "Paramètres" du workspace MD). Sert à uniformiser l'affichage des
// montants (reporting, KPIs, deal headers) sur toute l'app PE.
//
// Fallback : 'XOF' si l'org n'a pas encore enregistré de thèse.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FundCurrency = 'XOF' | 'XAF' | 'EUR' | 'USD';

export function useFundCurrency(organizationId: string | null | undefined) {
  const [currency, setCurrency] = useState<FundCurrency>('XOF');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', organizationId)
        .single();
      if (cancelled) return;
      const settings = (data?.settings as any) || {};
      const cur = settings.pe_thesis?.currency;
      if (cur === 'XOF' || cur === 'XAF' || cur === 'EUR' || cur === 'USD') {
        setCurrency(cur);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [organizationId]);

  return { currency, loading };
}
