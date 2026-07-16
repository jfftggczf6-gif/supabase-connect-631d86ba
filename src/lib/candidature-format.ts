// Helpers de formatage partagés entre le drawer de détail candidature
// (CandidatureDetailDrawer) et le reporting PDF (export-candidature-report-pdf).
// Source unique : le rendu du PDF doit refléter exactement celui du drawer.

/** Extrait un texte lisible d'une valeur qui peut être une string ou un objet. */
export function safeText(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.titre || v.label || v.detail || v.description || v.name || JSON.stringify(v);
}

/** Formate un nombre en fr-FR, '—' si absent, avec suffixe optionnel. */
export function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '—';
  return v.toLocaleString('fr-FR') + (suffix ? ` ${suffix}` : '');
}

/**
 * Échappe le HTML. Indispensable pour le PDF : contrairement au drawer (React
 * échappe automatiquement), on construit ici des chaînes HTML brutes, et
 * form_data / screening_data contiennent du texte libre utilisateur qui peut
 * contenir <, >, &, " et casserait la mise en page (ou pire).
 */
export function escapeHtml(v: any): string {
  const s = typeof v === 'string' ? v : (v == null ? '' : String(v));
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
