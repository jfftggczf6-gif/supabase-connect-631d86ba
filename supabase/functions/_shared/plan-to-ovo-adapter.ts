/**
 * Adapts the plan_financier output format to the OVO Excel fill format.
 * Maps the unified plan financier JSON to the structure expected by Railway's fill_ovo().
 */
export function adaptPlanFinancierToOvoFormat(plan: any): any {
  if (!plan || typeof plan !== 'object') return plan;

  // The plan_financier already has most fields in OVO-compatible format
  // This adapter handles any remaining differences
  const adapted = { ...plan };

  // Ensure products/services arrays exist
  if (!adapted.products) adapted.products = [];
  if (!adapted.services) adapted.services = [];

  // Map projections to per-year format if needed
  if (adapted.projections && Array.isArray(adapted.projections)) {
    adapted.years = adapted.projections.map((p: any) => p.annee || p.year);
  }

  // Ensure staff is array
  if (adapted.staff && !Array.isArray(adapted.staff)) {
    adapted.staff = [];
  }

  // Ensure capex is array
  if (adapted.capex && !Array.isArray(adapted.capex)) {
    adapted.capex = [];
  }

  return adapted;
}
