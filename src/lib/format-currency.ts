/**
 * Formate un montant avec la bonne devise.
 * Utilise le format compact (M, B) pour les grands nombres.
 */
export function formatAmount(n: number | null | undefined, devise = 'FCFA'): string {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n);
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)}B ${devise}`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(0)}M ${devise}`;
  if (Math.abs(num) >= 1e3) return `${new Intl.NumberFormat('fr-FR').format(num)} ${devise}`;
  return `${num.toLocaleString('fr-FR')} ${devise}`;
}

/**
 * Format compact sans devise (pour les KPIs courts).
 */
export function formatCompact(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + 'k';
  return v.toLocaleString('fr-FR');
}

/**
 * Extrait la devise depuis les données d'un deliverable.
 * Cherche dans plusieurs chemins possibles.
 */
export function getDevise(data: Record<string, any>): string {
  return data?.devise
    || data?.currency
    || data?.metadata?.devise
    || data?.metadata?.currency
    || 'FCFA';
}
