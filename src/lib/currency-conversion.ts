// currency-conversion — Convertit un montant entre devises supportées
// (XOF, XAF, EUR, USD).
//
// Les taux sont normalement injectés depuis fx_rates_cache (table DB,
// alimentée quotidiennement par l'edge fn fetch-fx-rates qui interroge
// Frankfurter / ECB). Si aucun taux n'est fourni, on retombe sur les
// parités fixes (XOF/XAF) + une approximation USD.

export type SupportedCurrency = 'XOF' | 'XAF' | 'EUR' | 'USD';

/**
 * Taux exprimés en "1 EUR = X devise". Aligné sur la convention Frankfurter / ECB.
 */
export type FxRates = Partial<Record<SupportedCurrency, number>>;

const DEFAULT_RATES: Record<SupportedCurrency, number> = {
  EUR: 1,
  XOF: 655.957,
  XAF: 655.957,
  USD: 1.08,
};

export function convertCurrency(
  amount: number,
  from: string | null | undefined,
  to: string,
  rates?: FxRates | null,
): number {
  if (!amount || !isFinite(amount)) return 0;
  const f = (from ?? to) as SupportedCurrency;
  const t = to as SupportedCurrency;
  if (f === t) return amount;
  const merged = { ...DEFAULT_RATES, ...(rates ?? {}) };
  const rateFrom = merged[f] ?? 1;
  const rateTo = merged[t] ?? 1;
  // amount est dans `from` ; on ramène à EUR puis on convertit vers `to`.
  const inEur = amount / rateFrom;
  return inEur * rateTo;
}
