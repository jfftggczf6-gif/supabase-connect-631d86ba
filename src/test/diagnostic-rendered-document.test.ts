// Garde-fou de SORTIE : les assertions portent sur le document PRODUIT, pas sur
// le code qui le produit.
//
// Pourquoi ce fichier existe, et pourquoi il ne remplace pas le scan de source.
//
// Le 11/09, trois défauts sont sortis d'un contrôle sur document rendu alors que
// le scan de source (diagnostic-hardcoded-french.test.ts) était vert :
//
//   D1. Onze `{L.label('…')}` écrits SANS le `$`. Le gabarit s'imprimait
//       littéralement dans le document — en français comme en anglais. Le scan ne
//       pouvait pas le voir : la chaîne fautive n'est pas française, et sa regex
//       de texte JSX exclut explicitement les accolades.  → CLOS (ed044267).
//   D2. Des énumérations rendues brutes, sans passer par le référentiel. Ce sont
//       des VALEURS D'EXÉCUTION, absentes du source par construction.  → CLOS ici.
//   D3. Des libellés français en dur absents du référentiel. Le scan ne signale
//       que ce qui duplique une entrée du référentiel ; ce qui n'y figure pas lui
//       est invisible.  → CLOS ici.
//
// Ces trois classes échappent à un scan statique par construction, pas par
// oubli. Un contrôle qui lit le code ne peut pas établir ce que le lecteur
// recevra. Les deux contrôles sont complémentaires : le scan attrape la dérive
// à l'écriture, celui-ci attrape ce que l'écriture ne dit pas.
//
// ── Ce qui a changé le 12/09 ────────────────────────────────────────────────
//
// 1. LE DOSSIER. Le précédent portait des noms de champs que le schéma
//    producteur n'émet pas (`dimensions_diagnostiques`, `matching_criteres.
//    valides`, `besoin_financement.montant`, énumérations en snake_case).
//    Mesuré : quatre blocs du document ne sortaient pas du tout. Un garde-fou
//    qui n'atteint pas un bloc ne dit rien de ce bloc — il dit seulement qu'il
//    ne l'a pas regardé. Le dossier est désormais aligné sur SCREENING_SCHEMA
//    (esono-ai-worker/api/agents/screen_candidatures.py) et porte au moins une
//    valeur par bloc et par famille d'énumération.
//
// 2. LE DOCUMENT ANGLAIS EST CONSTRUIT COMME EN PRODUCTION : screening_data
//    fusionné avec la prose rendue (diagnosticForLocale), pas screening_data
//    seul. Sans cela le test validerait un chemin qui n'existe pas.
//
// 3. LA MÉTHODE DE COMPTAGE. Trois recensements manuels de suite ont
//    sous-estimé (5 comparaisons annoncées → 7 réelles ; « une soixantaine de
//    libellés » jamais vérifiée ; 17 sites annoncés → 44 fuites mesurées). Ce
//    fichier ne recense plus : il compare le document français et le document
//    anglais, et exige que tout segment IDENTIQUE dans les deux soit justifié —
//    par le référentiel, qui déclare ce qui ne se traduit pas, ou par une
//    exception écrite ici avec sa raison. Personne n'a plus à énumérer.

import { describe, it, expect, vi } from 'vitest';

// Stub de module, pas capture de rejection.
//
// Le référentiel n'est PAS résolu par le builder : il lui est injecté par
// `__setRenderContext(locale, rows)`. Ce stub ne sert donc pas à fournir des
// libellés — le test n'en a pas besoin.
//
// Ce qu'il compense est un couplage de MODULE : `buildHtml` partage son fichier
// avec `resolveDiagnostics` et les quatre points d'entrée d'export, qui importent
// le client Supabase. Importer le builder pur construit donc le client, qui
// démarre son auto-refresh sous jsdom et laisse une rejection non gérée — vitest
// signale alors un risque de faux positif sur TOUTE la suite, ce qu'un garde-fou
// ne doit surtout pas causer.
//
// Le découplage réel est de sortir les fonctions pures dans leur propre module,
// avec l'état de rendu qu'elles portent. Ce n'est pas une modification mécanique
// et ce n'est pas le sujet de ce commit : c'est consigné dans les points ouverts
// du brief. En attendant, ce stub est aligné sur export-single-candidature.test,
// qui fait déjà exactement la même chose pour la même raison.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { buildSingleHtml, buildHtml, __setRenderContext } from '@/lib/export-candidature-report-pdf';
import { diagnosticForLocale } from '@/lib/diagnostic-prose';
import { normalizeEnum, type DiagnosticLabelRow } from '@/lib/diagnostic-labels';
import { seedLabelRows } from './helpers/label-seed';
import {
  screeningDataComplet, proseEnComplet, candidatureComplete,
  valeursDonnees, ENUMS_STOCKES, ENUMS_NON_RENDUS,
} from './helpers/dossier-complet';

// ── Construction des deux documents, comme en production ────────────────────

const ROWS: DiagnosticLabelRow[] = seedLabelRows();
const PROGRAMME = 'Neutral Programme';

function documents(locale: 'fr' | 'en'): { solo: string; cohorte: string } {
  const sd = screeningDataComplet();
  const diagnostic = diagnosticForLocale(
    sd, locale, locale === 'en' ? { prose: proseEnComplet() } : null,
  );
  const cand = { ...candidatureComplete(), screening_data: diagnostic };
  __setRenderContext(locale, ROWS);
  return {
    solo: buildSingleHtml(cand, PROGRAMME),
    cohorte: buildHtml([cand], PROGRAMME),
  };
}

/** Texte effectivement lu : hors CSS, hors balises, entités décodées. */
function texteVisible(html: string): string[] {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .split(/<[^>]*>/g)
    .map((s) => s
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .trim())
    .filter(Boolean);
}

const FR = documents('fr');
const EN = documents('en');
const TEXTE_EN = [...new Set([...texteVisible(EN.solo), ...texteVisible(EN.cohorte)])];
const TEXTE_FR = [...new Set([...texteVisible(FR.solo), ...texteVisible(FR.cohorte)])];

// ═══ D1 — gabarits non interpolés ══════════════════════════════════════════

/** Gabarit resté littéral dans la sortie : `{L.label('x')}`, `{esc(y)}`, `{x}`. */
const GABARIT_NON_INTERPOLE = /\{[A-Za-z_$][\w$]*(?:\.[\w$]+)*\([^{}]*\)\}/g;

describe('D1 — document rendu, aucun gabarit non interpolé', () => {
  for (const [locale, docs] of [['fr', FR], ['en', EN]] as const) {
    it(`extract solo (${locale})`, () => {
      const fuites = [...new Set(docs.solo.match(GABARIT_NON_INTERPOLE) ?? [])];
      expect(fuites, `gabarits imprimés tels quels : ${fuites.join(' | ')}`).toEqual([]);
    });
    it(`reporting multi-dossiers (${locale})`, () => {
      const fuites = [...new Set(docs.cohorte.match(GABARIT_NON_INTERPOLE) ?? [])];
      expect(fuites, `gabarits imprimés tels quels : ${fuites.join(' | ')}`).toEqual([]);
    });
  }

  it('le détecteur attrape bien un gabarit oublié', () => {
    // Sans cette contre-épreuve, un détecteur cassé rendrait les assertions
    // ci-dessus vertes en permanence — c'est exactement le mode de défaillance
    // qu'on cherche à éviter.
    const faux = `<span class="score-lbl">{L.label('champ.score_ia')}</span>`;
    expect(faux.match(GABARIT_NON_INTERPOLE)).toEqual([`{L.label('champ.score_ia')}`]);
  });
});

// ═══ D2 — énumérations ═════════════════════════════════════════════════════
//
// Une énumération est une VALEUR stockée en français dans screening_data. Le
// code la compare telle quelle (enumIs) mais ne doit jamais l'AFFICHER telle
// quelle : l'affichage passe par enumLabel(), qui la rapproche du référentiel.
// On vérifie les deux sens — la forme anglaise présente, la forme française
// absente — parce qu'afficher les deux serait aussi faux qu'afficher la mauvaise.

/** Rapproche une valeur stockée de sa ligne de référentiel, comme enumLabel(). */
function ligneReferentiel(famille: string, valeur: string): DiagnosticLabelRow | undefined {
  const cible = normalizeEnum(valeur);
  return ROWS.find((r) => r.category === famille && r.match_fr && normalizeEnum(r.match_fr) === cible);
}

describe('D2 — énumérations habillées par le référentiel', () => {
  it('chaque famille du dossier est bien couverte par le référentiel', () => {
    // Une famille absente ferait passer les assertions suivantes sans rien
    // vérifier : enumLabel replie sur la valeur stockée, et le test ne saurait
    // pas distinguer « traduit » de « non référencé ».
    const orphelines = Object.entries(ENUMS_STOCKES)
      .filter(([famille, valeur]) => !ligneReferentiel(famille, valeur))
      .map(([famille, valeur]) => `${famille} → « ${valeur} »`);
    expect(
      orphelines,
      `familles d'énumération absentes du référentiel : ${orphelines.join(', ')}`,
    ).toEqual([]);
  });

  it('les énumérations non rendues le sont bien — la couverture ne se vide pas', () => {
    // Anti-vacuité. Le jour où un bloc affiche l'une d'elles, cette assertion
    // tombe et force à la déplacer vers les familles vérifiées, au lieu de la
    // laisser passer sans contrôle de langue.
    const apparues: string[] = [];
    for (const famille of Object.keys(ENUMS_NON_RENDUS)) {
      const row = ligneReferentiel(famille, ENUMS_STOCKES[famille]);
      if (!row) continue;
      const vue = [...TEXTE_FR, ...TEXTE_EN].some((s) => s.includes(row.fr) || s.includes(row.en));
      if (vue) apparues.push(`${famille} : « ${row.fr} » / « ${row.en} » est désormais rendu — à sortir de ENUMS_NON_RENDUS`);
    }
    expect(apparues, apparues.join('\n')).toEqual([]);
  });

  it('le document anglais porte la forme anglaise, jamais la française', () => {
    const fautes: string[] = [];
    for (const [famille, valeur] of Object.entries(ENUMS_STOCKES)) {
      if (famille in ENUMS_NON_RENDUS) continue;
      const row = ligneReferentiel(famille, valeur);
      if (!row || row.fr === row.en) continue;
      const enPresent = TEXTE_EN.some((s) => s.includes(row.en));
      const frPresent = TEXTE_EN.some((s) => s.includes(row.fr));
      if (!enPresent) fautes.push(`${famille} : « ${row.en} » absent du document EN`);
      if (frPresent)  fautes.push(`${famille} : « ${row.fr} » (français) présent dans le document EN`);
    }
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('le document français porte bien la forme française', () => {
    const fautes: string[] = [];
    for (const [famille, valeur] of Object.entries(ENUMS_STOCKES)) {
      if (famille in ENUMS_NON_RENDUS) continue;
      const row = ligneReferentiel(famille, valeur);
      if (!row || row.fr === row.en) continue;
      if (!TEXTE_FR.some((s) => s.includes(row.fr))) {
        fautes.push(`${famille} : « ${row.fr} » absent du document FR`);
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('le détecteur attrape une énumération laissée brute', () => {
    const row = ligneReferentiel('fiabilite', 'Élevée')!;
    expect(row.fr).toBe('Élevée');
    expect(row.en).toBe('High');
    const fauxDocument = ['Reliability: Élevée'];
    expect(fauxDocument.some((s) => s.includes(row.fr))).toBe(true);
  });
});

// ═══ D3 — libellés ═════════════════════════════════════════════════════════
//
// Méthode différentielle. Un segment de texte présent à l'identique dans le
// document français ET dans le document anglais est l'un des trois :
//   a. une DONNÉE du dossier (nom d'entreprise, ville, devise, prose) ;
//   b. un libellé que le référentiel déclare identique dans les deux langues
//      (« Contact », « Email », « Impact ») — décision explicite, tracée ;
//   c. un libellé qui n'a pas été traduit — le défaut.
// Tout ce qui n'est ni (a) ni (b) est (c). Aucune énumération manuelle.

/** Exceptions, chacune justifiée. Sans raison écrite, c'est une dette, pas une exemption. */
const EXCEPTIONS: { valeur: string; pourquoi: string }[] = [
  { valeur: '—', pourquoi: 'cadratin de séparation, pas du texte' },
  { valeur: '/100', pourquoi: 'dénominateur de score, invariant par langue' },
  { valeur: '✓', pourquoi: 'marque de critère validé, pas du texte' },
  { valeur: '~', pourquoi: 'marque de critère partiel, pas du texte' },
  { valeur: '✗', pourquoi: 'marque de critère non rempli, pas du texte' },
];
const EXCEPTE = new Set(EXCEPTIONS.map((e) => e.valeur));

/** Valeurs du dossier : ce qui vient de la donnée et non du code. */
const DONNEES = valeursDonnees(
  screeningDataComplet(), proseEnComplet(), candidatureComplete(), PROGRAMME,
);

/** Libellés que le référentiel déclare identiques fr/en — décision tracée. */
const IDENTIQUES_ASSUMES = new Set(ROWS.filter((r) => r.fr === r.en).map((r) => r.fr));

/**
 * Ce qui reste d'un segment une fois retirés la donnée, les nombres et la
 * ponctuation : la part écrite par le CODE. Vide ⇒ le segment est de la donnée.
 */
function partCode(segment: string): string {
  let reste = segment;
  for (const d of [...DONNEES].sort((a, b) => b.length - a.length)) {
    if (d.length >= 3) reste = reste.split(d).join(' ');
  }
  return reste.replace(/[0-9\s.,;:!?'"«»()[\]{}%/\\+\-–—…×✓✗~<>&]+/g, ' ').trim();
}

describe('D3 — libellés traduits, ou déclarés identiques', () => {
  it('aucun segment identique fr/en qui ne soit donnée, décision ou exception', () => {
    const communs = TEXTE_EN.filter((s) => TEXTE_FR.includes(s));
    const suspects = communs.filter((s) => {
      if (EXCEPTE.has(s)) return false;
      if (IDENTIQUES_ASSUMES.has(s)) return false;
      const code = partCode(s);
      if (!code) return false;                      // segment entièrement constitué de donnée
      if (IDENTIQUES_ASSUMES.has(code)) return false;
      return /[A-Za-zÀ-ÿ]{2,}/.test(code);
    });

    expect(
      suspects,
      `${suspects.length} segment(s) identique(s) fr/en sans justification.\n` +
      `Chacun doit passer par L.label()/L.enumLabel(), ou être déclaré identique ` +
      `au référentiel, ou rejoindre EXCEPTIONS avec sa raison :\n` +
      suspects.map((s) => `   « ${s} »   [part code : « ${partCode(s)} »]`).join('\n'),
    ).toEqual([]);
  });

  it('aucun diacritique français dans le document anglais', () => {
    const DIACRITIQUE = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/;
    const accentues = TEXTE_EN.filter((s) => DIACRITIQUE.test(s) && partCode(s) !== '');
    expect(
      accentues,
      `segments accentués dans le document anglais :\n` +
      accentues.map((s) => `   « ${s} »`).join('\n'),
    ).toEqual([]);
  });

  it('le document déclare la langue qu\'il porte', () => {
    expect(EN.solo).toContain('<html lang="en"');
    expect(EN.cohorte).toContain('<html lang="en"');
    expect(FR.solo).toContain('<html lang="fr"');
  });

  it('la typographie des deux-points suit la langue', () => {
    // « Reliability : High » signe un document anglais traduit du français à
    // chaque ligne de la fiche. L'espace avant deux-points est une convention
    // française, pas une décoration.
    expect(EN.solo).not.toMatch(/[A-Za-z] :<\/strong>/);
    expect(FR.solo).toMatch(/ :<\/strong>/);
  });

  it('le détecteur attrape un libellé non traduit', () => {
    // Contre-épreuve : un segment de code identique dans les deux langues et
    // absent du référentiel doit être signalé.
    expect(partCode('Recommandation d\'accompagnement')).toBe('Recommandation d accompagnement');
    expect(IDENTIQUES_ASSUMES.has('Recommandation d\'accompagnement')).toBe(false);
  });

  it('le détecteur ne signale pas une donnée du dossier', () => {
    expect(partCode('NEUTRAL TRADING LTD')).toBe('');
    expect(partCode('Neutral committee summary over three documented years.')).toBe('');
  });
});

// ═══ Classe C — libellé de dimension et type de risque, rendus par le modèle ═

describe('classe C — libellé de dimension et type de risque suivent la langue', () => {
  it('le libellé de dimension rendu par le modèle sort en anglais', () => {
    expect(TEXTE_EN.some((s) => s.includes('Growing'))).toBe(true);
    expect(TEXTE_EN.some((s) => s.includes('En croissance'))).toBe(false);
    expect(TEXTE_FR.some((s) => s.includes('En croissance'))).toBe(true);
  });

  it('le type de risque rendu par le modèle sort en anglais', () => {
    expect(TEXTE_EN.some((s) => s.includes('operational'))).toBe(true);
    expect(TEXTE_EN.some((s) => s.includes('opérationnel'))).toBe(false);
    expect(TEXTE_FR.some((s) => s.includes('opérationnel'))).toBe(true);
  });

  it('la CLÉ de dimension, elle, reste structurelle et passe par le référentiel', () => {
    // C'est la distinction qui justifie l'arbitrage : la clé est du schéma, le
    // libellé est une appréciation. La clé ne part jamais au modèle.
    expect(TEXTE_EN.some((s) => s.includes('Financial capacity'))).toBe(true);
    expect(TEXTE_EN.some((s) => s.includes('capacite financiere'))).toBe(false);
    expect(TEXTE_FR.some((s) => s.includes('Capacité financière'))).toBe(true);
  });
});
