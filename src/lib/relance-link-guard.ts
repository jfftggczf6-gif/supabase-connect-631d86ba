// Garde anti-fuite de lien pour la relance groupée (brief 1).
//
// Logique en ALLOWLIST (vérifier que rien d'autre n'est présent), pas en blocklist :
// une blocklist « cherche /candidature/recovery/ » rate les URLs encodées en
// entités HTML et le cas « placeholder présent MAIS un lien en dur en plus ».
//
// Invariant du gabarit relance (buildCompletionEmail) : le lien de récupération
// apparaît exactement 2× en HTML (href du bouton + lien de secours en texte
// visible) et 1× en version texte, et le HTML ne contient QU'UN seul <a href>,
// pointant sur le placeholder. Aucun autre lien légitime. Si buildCompletionEmail
// change le nombre de placements du lien, mettre à jour ces constantes ET la garde
// miroir dans supabase/functions/candidature-email-send/index.ts.

export const RECOVERY_URL_PLACEHOLDER = '{{__RECOVERY_URL__}}';
export const RELANCE_PLACEHOLDER_COUNT_HTML = 2;
export const RELANCE_PLACEHOLDER_COUNT_TEXT = 1;

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Vérifie qu'un e-mail de relance ne porte QUE le placeholder de lien, au bon
 * nombre, et aucun lien en dur (href non conforme ou chemin de récupération).
 * Retourne { ok:false, raison } au premier écart.
 */
export function checkRelanceLinks(input: { html: string; text?: string }): { ok: boolean; raison?: string } {
  const html = input.html ?? '';
  const text = input.text ?? '';

  // 1. Le placeholder apparaît EXACTEMENT le nombre attendu — ni moins (lien
  //    manquant), ni plus (contenu de lien parasite).
  const nHtml = count(html, RECOVERY_URL_PLACEHOLDER);
  if (nHtml !== RELANCE_PLACEHOLDER_COUNT_HTML) {
    return { ok: false, raison: `placeholder présent ${nHtml}× dans le HTML (attendu ${RELANCE_PLACEHOLDER_COUNT_HTML})` };
  }
  if (text) {
    const nText = count(text, RECOVERY_URL_PLACEHOLDER);
    if (nText !== RELANCE_PLACEHOLDER_COUNT_TEXT) {
      return { ok: false, raison: `placeholder présent ${nText}× dans le texte (attendu ${RELANCE_PLACEHOLDER_COUNT_TEXT})` };
    }
  }

  // 2. TOUT href du HTML doit pointer EXACTEMENT sur le placeholder. Attrape les
  //    URLs en dur, y compris encodées en entités (elles ne seront pas === placeholder).
  for (const m of html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)) {
    if (m[1] !== RECOVERY_URL_PLACEHOLDER) {
      return { ok: false, raison: `href non conforme : ${m[1].slice(0, 80)}` };
    }
  }

  // 3. Ceinture : aucun chemin de récupération en dur (HTML ou texte visible),
  //    avant remplacement du placeholder par le vrai lien.
  if (/\/candidature\/recovery\//.test(html) || /\/candidature\/recovery\//.test(text)) {
    return { ok: false, raison: 'URL de récupération en dur détectée' };
  }

  return { ok: true };
}
