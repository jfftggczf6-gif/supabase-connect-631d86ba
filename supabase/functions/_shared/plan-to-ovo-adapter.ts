/**
 * Adapts the plan_financier output format to the OVO Excel fill format.
 *
 * IMPORTANT: This function passes through the data as-is, keeping "produits"
 * in French. The Python adapter on Railway (plan_financier_adapter.py) handles
 * the actual v2→v1 conversion with per_year mapping.
 *
 * DO NOT convert produits→products here — it would bypass Railway's adapter
 * and lose the per_year data.
 */
export function adaptPlanFinancierToOvoFormat(plan: any): any {
  if (!plan || typeof plan !== 'object') return plan;
  // Pass through as-is — Railway's adapter handles the conversion
  return { ...plan };
}
