// Contrôles de sortie sur une PROSE RENDUE.
//
// Ces contrôles s'exécutent sur DEUX chemins : la suite de tests, et la
// vérification d'un rendu réel produit en base. Deux implémentations d'une même
// règle finiraient par diverger, et c'est la vérification sur données réelles
// qui serait fausse — celle dont on a le plus besoin.

import { flattenProse } from './numeric-tokens';

// ── Glossaire juridique Ghana ───────────────────────────────────────────────

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

// ── Séparateurs numériques ──────────────────────────────────────────────────

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
    for (const m of s.matchAll(/\d[\s   ]\d{3}(?!\d)/g)) trouves.push(m[0]);
    // virgule décimale : une virgule suivie de 1 ou 2 chiffres seulement
    for (const m of s.matchAll(/\d,\d{1,2}(?!\d)/g)) trouves.push(m[0]);
  }
  return trouves;
}

// ── Sigles : la quatrième classe ────────────────────────────────────────────
//
// « CA » a survécu trois fois dans la prose anglaise de RUJO — « CA ≥ 20,000
// EUR » — alors que les TROIS garde-fous existants étaient verts. Aucun ne
// pouvait le voir, et ce n'est pas un oubli :
//   • le contrôle de diacritiques ne le voit pas : « CA » n'en porte aucun ;
//   • le référentiel ne couvre que libellés et énumérations, pas la prose ;
//   • le bloc de terminologie ne couvre que deux champs.
//
// Une liste d'abréviations proscrites attraperait « CA » et manquerait la
// suivante. On inverse donc la charge de la preuve, exactement comme le
// garde-fou de libellés : TOUT sigle du rendu anglais doit être DÉCLARÉ, dans
// l'un des deux registres ci-dessous. Un sigle non déclaré échoue.
//
// Hypothèse écartée par la mesure : dériver les sigles légitimes des réponses
// au formulaire du candidat. Vérifié sur les deux dossiers — les sigles
// d'institutions (GRA, SSNIT, ORC, GSFP, GADCO, GIZ) n'y figurent PAS, le
// modèle les apporte de sa propre connaissance. La dérivation ne marche pas ;
// la déclaration explicite, si.

/**
 * Sigles INVARIANTS : identiques dans les deux langues, donc légitimes dans un
 * rendu anglais. Chacun porte sa raison — une entrée sans justification est un
 * aveu de dette, pas une exemption.
 */
export const SIGLES_INVARIANTS: Record<string, string> = {
  // Devises — codes ISO 4217, invariants par définition
  EUR: 'code devise ISO 4217', USD: 'code devise ISO 4217',
  GHS: 'code devise ISO 4217 (cedi ghanéen)', XOF: 'code devise ISO 4217 (franc CFA)',
  NGN: 'code devise ISO 4217', GBP: 'code devise ISO 4217',

  // Niveaux de preuve du schéma de screening
  N0: 'niveau de preuve du schéma (déclaratif)', N1: 'niveau de preuve du schéma',
  N2: 'niveau de preuve du schéma', N3: 'niveau de preuve du schéma',

  // Vocabulaire d'affaires anglais ou international
  SME: 'small and medium enterprise — terme anglais, traduit depuis PME',
  CEO: 'chief executive officer — terme anglais', CFO: 'chief financial officer — terme anglais',
  CV: 'curriculum vitae — latin, invariant', HR: 'human resources — terme anglais, traduit depuis RH',
  B2B: 'business to business — terme anglais', B2C: 'business to consumer — terme anglais',
  EBITDA: 'indicateur financier international', VAT: 'value added tax — terme anglais',
  KPI: 'key performance indicator — terme anglais', ESG: 'environnement social gouvernance — international',
  ROI: 'return on investment — terme anglais', IRR: 'internal rate of return — terme anglais',
  NPV: 'net present value — terme anglais', NGO: 'non-governmental organisation — terme anglais',

  // Normes et référentiels
  ISO: 'organisation internationale de normalisation', HACCP: 'norme de sécurité alimentaire',
  GMP: 'good manufacturing practices — norme', CE: 'marquage de conformité européenne',
  SDG: 'sustainable development goals — traduit depuis ODD',

  // Institutions et programmes — noms propres, non traduisibles
  ORC: 'Office of the Registrar of Companies (Ghana)', GRA: 'Ghana Revenue Authority',
  SSNIT: 'Social Security and National Insurance Trust (Ghana)', FDA: 'Food and Drugs Authority (Ghana)',
  GAIP: 'Ghana Agricultural Insurance Pool', GSFP: 'Ghana School Feeding Programme',
  GADCO: 'Global Agri Development Company (Ghana)', GSS: 'Ghana Statistical Service',
  PAYE: 'pay as you earn — régime fiscal ghanéen', GIZ: 'coopération allemande',
  USAID: 'agence de coopération américaine', USDA: "département américain de l'agriculture",
  IDF: 'International Diabetes Federation', AFD: 'Agence française de développement',
  IFC: 'International Finance Corporation', EIB: 'European Investment Bank',

  // Zones géographiques
  USA: 'United States of America', UK: 'United Kingdom', EU: 'European Union',

  // Notation d'exercices comptables — « Y-2, Y-1, Y0 », invariante
  Y0: 'exercice courant en notation comptable', Y1: 'exercice N+1 en notation comptable',
  Y2: 'exercice N+2 en notation comptable', Y3: 'exercice N+3 en notation comptable',

  // Mots anglais en capitales que la règle de minuscule ne rattrape pas quand
  // leur forme minuscule n'apparaît nulle part ailleurs dans la même prose.
  // Relevés sur le rendu de Sweet Life : « DO NOT decide in committee » et la
  // citation « 'YES' response to the question ».
  DO: "mot anglais en capitales (emphase) — jamais une abréviation française",
  NO: "mot anglais en capitales (emphase) — jamais une abréviation française",
  NOT: "mot anglais en capitales (emphase) — jamais une abréviation française",
  YES: "citation de la réponse du candidat au formulaire — ses mots, non traduits",
};

/**
 * Abréviations FRANÇAISES proscrites dans un rendu anglais, avec leur
 * équivalent attendu. Ce registre est le pendant du glossaire juridique Ghana :
 * il fixe du vocabulaire, il n'autorise aucun ajout de valeur.
 *
 * Il ne remplace PAS la règle de déclaration — il la double. Une abréviation
 * proscrite échoue même si quelqu'un l'ajoutait par erreur aux invariants.
 */
export const ABREVIATIONS_PROSCRITES: Record<string, string> = {
  CA: 'revenue', CAHT: 'net revenue', CAF: 'self-financing capacity',
  BFR: 'working capital requirement', EBE: 'gross operating surplus',
  RN: 'net income', VA: 'value added', TVA: 'VAT', HT: 'excluding tax', TTC: 'including tax',
  PME: 'SME', PMI: 'industrial SME', RH: 'HR', ODD: 'SDG',
  DG: 'CEO', PDG: 'chairman and CEO', GMS: 'retail chains',
  BAD: 'AfDB', SARL: 'limited liability company', EURL: 'single-member LLC',
  CDI: 'permanent contract', CDD: 'fixed-term contract',
};

/** Sigles d'une prose : majuscules de 2 à 6 caractères, chiffres admis. */
export function sigles(prose: unknown): Map<string, number> {
  const compte = new Map<string, number>();
  for (const s of flattenProse(prose)) {
    for (const m of s.match(/\b[A-Z][A-Z0-9]{1,5}\b/g) ?? []) {
      compte.set(m, (compte.get(m) ?? 0) + 1);
    }
  }
  return compte;
}

/**
 * Mots anglais écrits en capitales pour l'emphase — « DO NOT decide in
 * committee ». Ce ne sont pas des sigles, et les énumérer serait sans fin.
 *
 * Règle, pas liste : un mot dont la forme minuscule apparaît AILLEURS dans la
 * même prose comme mot autonome est un mot, pas un sigle. « not » et « do »
 * abondent dans un texte anglais ; « ca » et « gra » n'y apparaissent jamais.
 */
function motsEnCapitales(prose: unknown): Set<string> {
  const texte = flattenProse(prose).join('\n');
  const out = new Set<string>();
  for (const sigle of sigles(prose).keys()) {
    const bas = sigle.toLowerCase();
    if (!/^[a-z]+$/.test(bas)) continue;
    if (new RegExp(`\\b${bas}\\b`).test(texte)) out.add(sigle);
  }
  return out;
}

export interface FuiteSigle { sigle: string; occurrences: number; attendu?: string }

/**
 * Sigles du rendu qui ne sont NI déclarés invariants, NI reconnus comme mots
 * anglais en capitales. Chacun est soit une abréviation française à traduire,
 * soit un invariant légitime à déclarer — dans les deux cas, quelqu'un doit
 * trancher une fois.
 */
export function siglesNonDeclares(prose: unknown): FuiteSigle[] {
  const mots = motsEnCapitales(prose);
  const out: FuiteSigle[] = [];
  for (const [sigle, occurrences] of sigles(prose)) {
    if (mots.has(sigle)) continue;
    if (sigle in SIGLES_INVARIANTS) continue;
    out.push({ sigle, occurrences, attendu: ABREVIATIONS_PROSCRITES[sigle] });
  }
  return out.sort((a, b) => a.sigle.localeCompare(b.sigle));
}

/** Abréviations françaises présentes dans un rendu anglais. Toujours une faute. */
export function abreviationsFrancaises(prose: unknown): FuiteSigle[] {
  const out: FuiteSigle[] = [];
  for (const [sigle, occurrences] of sigles(prose)) {
    if (sigle in ABREVIATIONS_PROSCRITES) {
      out.push({ sigle, occurrences, attendu: ABREVIATIONS_PROSCRITES[sigle] });
    }
  }
  return out.sort((a, b) => a.sigle.localeCompare(b.sigle));
}
