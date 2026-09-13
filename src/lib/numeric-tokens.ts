// Extraction et normalisation des tokens numériques d'une prose.
//
// Le vrai risque du rendu linguistique n'est pas qu'un score change de colonne —
// la construction l'interdit — mais qu'un NOMBRE SOIT REFORMULÉ DANS LA PROSE.
// « CA 460M XOF » qui ressort « revenue of around 460 million » a perdu sa
// précision ; « 22 289 209 » qui ressort « 22,289,290 » est faux et personne ne
// le verra. Le prompt l'interdit (règle 3), ce module le vérifie.

/**
 * Normalise un nombre écrit à la française ou à l'anglaise vers une forme
 * canonique comparable.
 *
 * 1 234,56 (fr) et 1,234.56 (en) sont le MÊME nombre : sans cette normalisation
 * le test échouerait sur du parfaitement correct, ce qui est pire qu'inutile —
 * on finirait par le désactiver.
 */
export function canonicalNumber(raw: string): string {
  let s = raw.trim()
    // espaces de groupement, y compris insécables et fines
    .replace(/[\s   ]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // Le séparateur décimal est le DERNIER des deux ; l'autre groupe les milliers.
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    // « 1,234 » = milliers à l'anglaise ; « 84,39 » = décimal à la française.
    // Un groupe de 3 chiffres exactement après la virgule, et plusieurs groupes,
    // trahissent un séparateur de milliers.
    const thousands = parts.length > 1 && parts.slice(1).every((p) => /^\d{3}$/.test(p));
    s = thousands ? parts.join('') : s.replace(',', '.');
  } else if (hasDot) {
    // Le point groupe aussi les milliers dans plusieurs conventions
    // (« 22.289.209 »). On ne le lit comme séparateur de milliers que si CHAQUE
    // groupe après le premier fait exactement 3 chiffres et qu'il y en a
    // plusieurs — « 21.4 » et « 0.5 » restent des décimaux.
    const parts = s.split('.');
    const thousands = parts.length > 2 && parts.slice(1).every((p) => /^\d{3}$/.test(p));
    if (thousands) s = parts.join('');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return raw.trim();
  // Forme canonique sans zéros de queue : 84.39, 460, 0.5
  return String(n);
}

export interface NumericToken {
  /** Valeur canonique comparable. */
  value: string;
  /** Suffixe signifiant, normalisé : %, x, M, K, Md… Vide si aucun. */
  unit: string;
  /** Token tel qu'écrit, pour un message d'erreur lisible. */
  raw: string;
}

/** Suffixes d'échelle et unités qui changent le SENS du nombre. */
const UNIT_RE = /^(%|x|×|k|m|md|bn|b|ans?|years?|mois|months?|jours?|days?)$/i;

const UNIT_CANON: Record<string, string> = {
  '×': 'x', x: 'x', '%': '%',
  k: 'K', m: 'M', md: 'MD', bn: 'MD', b: 'MD',
  an: 'AN', ans: 'AN', year: 'AN', years: 'AN',
  mois: 'MOIS', month: 'MOIS', months: 'MOIS',
  jour: 'JOUR', jours: 'JOUR', day: 'JOUR', days: 'JOUR',
};

/**
 * Extrait tous les tokens numériques d'un texte.
 * Capture le nombre et, s'il est immédiatement suivi (ou séparé d'une espace)
 * d'un suffixe signifiant, ce suffixe : 5x, 84,39 %, 460M, 3 ans.
 */
export function extractNumericTokens(text: string): NumericToken[] {
  if (!text) return [];
  const out: NumericToken[] = [];
  // Nombre, puis unité éventuelle. `[\s-]*` franchit le trait d'union composé :
  // « 3-year history » doit donner la même unité que « 3 ans ». Sans cela la
  // forme composée anglaise perdait son unité et produisait un faux écart.
  // Le trait d'union de plage (« 6-12 ») reste sans effet : le groupe d'unité
  // n'accepte aucun chiffre, donc « 6 » ressort simplement sans unité.
  // Alternation ORDONNÉE, du plus spécifique au plus général. Une classe de
  // caractères permissive (`[\d\s.,]*`) avalait « 22,289,209, 8 documents »
  // comme UN seul nombre : deux valeurs séparées par « , » fusionnaient, ce qui
  // pouvait aussi bien masquer un écart qu'en inventer un.
  // Chaque forme exige désormais des groupes de 3 chiffres exacts.
  const re = new RegExp(
    '(' + [
      String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?`,                    // 22,289,209 · 1,234.56
      String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?`,                    // 22.289.209
      String.raw`\d{1,3}(?:[\s   ]\d{3})+(?:[.,]\d+)?`, // 22 289 209 · 1 234,56
      String.raw`\d+(?:[.,]\d+)?`,                                 // 84,39 · 21.4 · 8
    ].map((x) => x).join('|') + String.raw`)[\s-]*([%×a-zA-Z]{1,6})?`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const rawNum = m[1];
    const rawUnit = (m[2] || '').trim();
    const unit = UNIT_RE.test(rawUnit) ? (UNIT_CANON[rawUnit.toLowerCase()] ?? rawUnit.toUpperCase()) : '';
    out.push({ value: canonicalNumber(rawNum), unit, raw: (rawNum + (unit ? ` ${rawUnit}` : '')).trim() });
  }
  return out;
}

/** Parcourt récursivement une prose et concatène toutes ses chaînes. */
export function flattenProse(node: unknown, acc: string[] = []): string[] {
  if (typeof node === 'string') { acc.push(node); return acc; }
  if (Array.isArray(node)) { node.forEach((n) => flattenProse(n, acc)); return acc; }
  if (node && typeof node === 'object') {
    Object.values(node as Record<string, unknown>).forEach((v) => flattenProse(v, acc));
  }
  return acc;
}

/** Multiensemble de tokens d'une prose entière, clé « valeur|unité ». */
export function numericMultiset(prose: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of flattenProse(prose)) {
    for (const t of extractNumericTokens(s)) {
      const key = `${t.value}|${t.unit}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export interface MultisetDiff {
  onlyInA: { token: string; count: number }[];
  onlyInB: { token: string; count: number }[];
  equal: boolean;
}

/** Compare deux multiensembles et rend un écart lisible. */
export function diffMultisets(a: Map<string, number>, b: Map<string, number>): MultisetDiff {
  const onlyInA: { token: string; count: number }[] = [];
  const onlyInB: { token: string; count: number }[] = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    const ca = a.get(k) ?? 0;
    const cb = b.get(k) ?? 0;
    if (ca > cb) onlyInA.push({ token: k, count: ca - cb });
    if (cb > ca) onlyInB.push({ token: k, count: cb - ca });
  }
  return { onlyInA, onlyInB, equal: onlyInA.length === 0 && onlyInB.length === 0 };
}


// ── Comparaison : valeurs d'abord, unités ensuite ───────────────────────────
//
// L'unité accolée ne peut PAS servir de critère bloquant entre deux langues :
// sa composition diffère légitimement. « 3 ans » devient « 3 financial years »
// — l'unité se perd parce que « financial » s'intercale — et « 6-12 derniers
// mois » devient « the last 6-12 months », où l'ordre des mots change
// l'attachement. Dans les deux cas la VALEUR est identique, et c'est elle qui
// porte le sens : un montant, un ratio, un comptage de pièces.
//
// D'où la séparation : les valeurs en égalité stricte (bloquant), les unités
// en écart signalé (informatif). Un nombre altéré, arrondi ou omis reste
// attrapé par le contrôle des valeurs.

/** Multiensemble des VALEURS seules, unité ignorée. Contrôle bloquant. */
export function numericValueMultiset(prose: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of flattenProse(prose)) {
    for (const t of extractNumericTokens(s)) {
      counts.set(t.value, (counts.get(t.value) ?? 0) + 1);
    }
  }
  return counts;
}

export interface ProseComparison {
  /** Vrai si toutes les valeurs numériques coïncident. Seul critère bloquant. */
  valeursIdentiques: boolean;
  ecartValeurs: MultisetDiff;
  /** Écarts d'unité accolée. Informatif : ne bloque jamais. */
  ecartUnites: MultisetDiff;
  nbValeursDistinctes: number;
}

/** Compare deux proses : valeurs en strict, unités en secondaire. */
export function compareProse(proseFr: unknown, proseEn: unknown): ProseComparison {
  const vFr = numericValueMultiset(proseFr);
  const vEn = numericValueMultiset(proseEn);
  const ecartValeurs = diffMultisets(vFr, vEn);
  const ecartUnites = diffMultisets(numericMultiset(proseFr), numericMultiset(proseEn));
  return {
    valeursIdentiques: ecartValeurs.equal,
    ecartValeurs,
    ecartUnites,
    nbValeursDistinctes: vFr.size,
  };
}

// ── Contrôles de sortie sur une prose rendue ────────────────────────────────
//
// Ces deux contrôles vivaient dans le fichier de test. Ils en sortent parce
// qu'ils doivent s'exécuter sur DEUX chemins : la suite de tests, et la
// vérification d'un rendu réel produit en base. Deux implémentations d'une même
// règle finiraient par diverger, et c'est la vérification sur données réelles
// qui serait fausse — celle dont on a le plus besoin.

/** Formulations proscrites par le glossaire juridique Ghana (Act 992). */
export const FORMULATIONS_PROSCRITES: readonly RegExp[] = [
  /certificate\s+to\s+commence\s+business/i,
  /certificate\s+of\s+commencement\s+of\s+business/i,
  /certified\s+financial\s+statements/i,
];

/** Occurrences de formulations proscrites dans une prose. */
export function violationsGlossaire(prose: unknown): string[] {
  const trouvees: string[] = [];
  for (const s of flattenProse(prose)) {
    for (const re of FORMULATIONS_PROSCRITES) {
      const m = s.match(re);
      if (m) trouvees.push(m[0]);
    }
  }
  return trouvees;
}

/**
 * Séparateurs d'une autre locale subsistant dans un rendu EN.
 *
 * Le rendu section par section traduit chaque section isolément : rien ne
 * garantit la cohérence de formatage entre elles. Constaté sur RUJO v2 —
 * « 250 000 » deux fois et « 250,000 » une fois dans le même document anglais.
 * Un normaliseur déterministe passe côté worker AVANT l'écriture ; cette
 * fonction vérifie le résultat côté lecture.
 */
export function separateursEtrangers(prose: unknown): string[] {
  const trouves: string[] = [];
  for (const s of flattenProse(prose)) {
    // espace (y compris insécable/fine) utilisée comme séparateur de milliers
    for (const m of s.matchAll(/\d[\s   ]\d{3}(?!\d)/g)) trouves.push(m[0]);
    // virgule décimale : une virgule suivie de 1 ou 2 chiffres seulement
    for (const m of s.matchAll(/\d,\d{1,2}(?!\d)/g)) trouves.push(m[0]);
  }
  return trouves;
}
