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

/**
 * Statuts inclus dans le rapport agrégé de candidatures. On exclut 'received'
 * (les soumissions non triées, sources de doublons) et 'rejected' (refusées).
 */
export const REPORT_RETAINED_STATUSES = ['pre_selected', 'selected', 'enterprise'];

export function isRetainedForReport(status: string | null | undefined): boolean {
  return REPORT_RETAINED_STATUSES.includes(String(status));
}

/**
 * « Sourcing projet » : par quelle organisation l'entreprise est arrivée.
 * Cherche dans form_data la question « Quelle organisation vous a recommandé… »
 * par mot-clé (robuste aux formulations/programmes). '—' si absent.
 */
export function getProjectSourcing(candidature: any): string {
  const fd = candidature?.form_data;
  if (!fd || typeof fd !== 'object') return '—';
  const key = Object.keys(fd).find((k) => {
    const low = k.toLowerCase();
    return low.includes('recommand') || (low.includes('organisation') && low.includes('postul'));
  });
  if (!key) return '—';
  const raw = fd[key];
  // Si l'option choisie est un « champ libre » (ex. « Autre »), la vraie valeur est
  // dans la clé sœur des précisions (feature champ-libre) → on affiche le vrai nom.
  const precisions = (fd[`${key}__precisions`] && typeof fd[`${key}__precisions`] === 'object')
    ? fd[`${key}__precisions`]
    : {};
  const resolveOne = (v: string): string => {
    const p = precisions[v];
    const pTrim = (p == null ? '' : String(p)).trim();
    return pTrim || v;
  };
  const out = Array.isArray(raw)
    ? raw.map((v) => resolveOne(String(v))).map((x) => x.trim()).filter(Boolean).join(', ')
    : resolveOne(raw == null ? '' : String(raw)).trim();
  return out || '—';
}
