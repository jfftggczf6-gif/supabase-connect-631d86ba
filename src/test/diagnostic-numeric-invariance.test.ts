// Invariance NUMÉRIQUE entre la prose fr et la prose en d'un même dossier.
//
// L'invariance structurelle (score, statut, pièces) passe trivialement : le
// déterministe n'est jamais transmis au rendu. Elle ne couvre donc PAS le vrai
// risque, qui est un nombre reformulé À L'INTÉRIEUR de la prose — « CA 460M XOF »
// qui ressort « revenue of around 460 million », ou « 22 289 209 » qui devient
// « 22,289,290 ». Le prompt l'interdit (règle 3) ; ce test le vérifie.
//
// Comparaison en MULTIENSEMBLES : un même nombre cité trois fois doit l'être
// trois fois dans les deux langues. Séparateurs normalisés au préalable, sans
// quoi le test échouerait sur du correct — et finirait désactivé.

import { describe, it, expect } from 'vitest';
import {
  canonicalNumber, extractNumericTokens, numericMultiset, diffMultisets, flattenProse,
  compareProse, numericValueMultiset,
} from '@/lib/numeric-tokens';
import { violationsGlossaire, separateursEtrangers } from '@/lib/prose-controls';
import { extractProse } from '@/lib/diagnostic-prose';

describe('normalisation des séparateurs', () => {
  it('1 234,56 (fr) et 1,234.56 (en) sont le même token', () => {
    expect(canonicalNumber('1 234,56')).toBe(canonicalNumber('1,234.56'));
    expect(canonicalNumber('1 234,56')).toBe('1234.56');
  });

  it('groupement de milliers dans les deux conventions', () => {
    expect(canonicalNumber('22 289 209')).toBe('22289209');
    expect(canonicalNumber('22,289,209')).toBe('22289209');
    expect(canonicalNumber('22.289.209')).toBe('22289209');
  });

  it('distingue décimale française et milliers anglais', () => {
    expect(canonicalNumber('84,39')).toBe('84.39');   // décimal fr
    expect(canonicalNumber('1,234')).toBe('1234');    // milliers en
  });

  it('espace insécable et fine ne cassent pas le nombre', () => {
    expect(canonicalNumber('15 000 000')).toBe('15000000');
    expect(canonicalNumber('15 000 000')).toBe('15000000');
  });
});

describe('extraction des tokens', () => {
  it('capture montants, pourcentages, multiples, durées', () => {
    const t = extractNumericTokens('CA 460M XOF, marge 21,4 %, valorisation 5x, 3 ans, 8 pièces');
    const keys = t.map((x) => `${x.value}|${x.unit}`);
    expect(keys).toContain('460|M');
    expect(keys).toContain('21.4|%');
    expect(keys).toContain('5|x');
    expect(keys).toContain('3|AN');
    expect(keys).toContain('8|');
  });

  it('×  et x sont le même multiple', () => {
    expect(extractNumericTokens('5×')[0].unit).toBe('x');
    expect(extractNumericTokens('5x')[0].unit).toBe('x');
  });

  it('reconnaît les durées dans les deux langues', () => {
    expect(extractNumericTokens('4 ans')[0].unit).toBe('AN');
    expect(extractNumericTokens('4 years')[0].unit).toBe('AN');
  });
});

// ── Le cas nominal ──────────────────────────────────────────────────────────

const PROSE_FR = {
  resume_comite: 'CA 22 289 209 FCFA en 2025, en progression de 84,39 % sur deux ans. Demande de 15 000 000 FCFA.',
  resume_executif: {
    synthese: 'Marge brute de 21,4 %, valorisation implicite 5x l\'EBITDA.',
    points_forts: ['Croissance 84,39 %', '3 exercices documentés'],
  },
  qualite_dossier: { note_qualite: '8 pièces reçues, 7 exploitables.' },
};

const PROSE_EN_OK = {
  resume_comite: 'Revenue XOF 22,289,209 in 2025, up 84.39% over two years. Request for XOF 15,000,000.',
  resume_executif: {
    synthese: 'Gross margin of 21.4%, implied valuation 5x EBITDA.',
    points_forts: ['Growth 84.39%', '3 documented financial years'],
  },
  qualite_dossier: { note_qualite: '8 documents received, 7 usable.' },
};

/** Reformulations réelles que le prompt interdit — le test doit les attraper. */
const PROSE_EN_ARRONDIE = {
  ...PROSE_EN_OK,
  resume_comite: 'Revenue of about XOF 22.3 million in 2025, up roughly 84% over two years. Request for XOF 15,000,000.',
};
const PROSE_EN_FAUTE_DE_FRAPPE = {
  ...PROSE_EN_OK,
  resume_comite: 'Revenue XOF 22,289,290 in 2025, up 84.39% over two years. Request for XOF 15,000,000.',
};
const PROSE_EN_OMISSION = {
  ...PROSE_EN_OK,
  qualite_dossier: { note_qualite: 'Several documents received, most usable.' },
};

describe('invariance numérique fr ↔ en', () => {
  it('une traduction fidèle conserve exactement les mêmes valeurs', () => {
    const c = compareProse(PROSE_FR, PROSE_EN_OK);
    expect(
      c.valeursIdentiques,
      `valeurs fr absentes en en : ${JSON.stringify(c.ecartValeurs.onlyInA)}\n` +
      `valeurs en absentes en fr : ${JSON.stringify(c.ecartValeurs.onlyInB)}`,
    ).toBe(true);
  });

  it('détecte un arrondi (« 22 289 209 » → « 22.3 million »)', () => {
    const c = compareProse(PROSE_FR, PROSE_EN_ARRONDIE);
    expect(c.valeursIdentiques).toBe(false);
    expect(c.ecartValeurs.onlyInA.map((x) => x.token)).toContain('22289209');
  });

  it('détecte un chiffre altéré (209 → 290)', () => {
    const c = compareProse(PROSE_FR, PROSE_EN_FAUTE_DE_FRAPPE);
    expect(c.valeursIdentiques).toBe(false);
    expect(c.ecartValeurs.onlyInB.map((x) => x.token)).toContain('22289290');
  });

  it('détecte une omission (« 8 pièces, 7 exploitables » → « several »)', () => {
    const c = compareProse(PROSE_FR, PROSE_EN_OMISSION);
    expect(c.valeursIdentiques).toBe(false);
    const manquants = c.ecartValeurs.onlyInA.map((x) => x.token);
    expect(manquants).toContain('8');
    expect(manquants).toContain('7');
  });

  it('ne compare que la prose : le déterministe n\'entre pas dans le calcul', () => {
    // Un screening_data complet, dont le score 62 n'apparaît dans aucune phrase.
    const sd = { score: 62, resume_comite: 'Aucun chiffre ici.', qualite_dossier: { total_documents: 8, note_qualite: 'Rien.' } };
    const prose = extractProse(sd);
    expect(numericValueMultiset(prose).size).toBe(0);
  });
});

// ── Exécution sur données réelles ───────────────────────────────────────────
//
// À ce jour AUCUN dossier n'a de rendu anglais : les migrations ne sont pas
// appliquées, candidature_diagnostic_renders n'existe pas en base, et aucun
// rendu n'a été produit. Ce bloc est le harnais prêt à recevoir ces dossiers ;
// il se déclenchera dès qu'un fichier d'export sera déposé, plutôt que de
// prétendre vérifier des données qui n'existent pas.

import fs from 'node:fs';
import path from 'node:path';

// Deux formats acceptés, pour éviter une étape de préparation manuelle :
//   - fixtures-raw.json      : { candidature, screening_data, prose_en }[]
//     (export direct de la base ; la prose fr est DÉRIVÉE par extractProse,
//      exactement comme le fait l'edge function avant d'appeler le modèle)
//   - fixtures/renders-en.json : { candidature, prose_fr, prose_en }[]
const RAW = path.resolve(__dirname, 'fixtures-raw.json');
const FIXTURE = path.resolve(__dirname, 'fixtures/renders-en.json');

function chargerDossiers(): { candidature: string; prose_fr: unknown; prose_en: unknown }[] | null {
  if (fs.existsSync(RAW)) {
    const raw = JSON.parse(fs.readFileSync(RAW, 'utf-8')) as any[];
    return raw.map((r) => ({
      candidature: r.candidature,
      prose_fr: r.prose_fr ?? extractProse(r.screening_data),
      prose_en: r.prose_en,
    }));
  }
  if (fs.existsSync(FIXTURE)) return JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'));
  return null;
}

describe('dossiers réellement rendus en anglais', () => {
  const dossiers = chargerDossiers();

  it('compare chaque dossier rendu, ou signale qu\'il n\'y en a pas', () => {
    if (!dossiers) {
      console.warn(
        '[invariance numérique] aucun dossier rendu en anglais — déposer ' +
        'src/test/fixtures-raw.json pour activer la vérification sur données réelles.',
      );
      expect(true).toBe(true);
      return;
    }
    expect(dossiers.length).toBeGreaterThan(0);

    const echecs: string[] = [];
    for (const d of dossiers) {
      const c = compareProse(d.prose_fr, d.prose_en);
      if (c.valeursIdentiques) {
        const unites = c.ecartUnites.equal
          ? 'unités identiques'
          : `${c.ecartUnites.onlyInA.length + c.ecartUnites.onlyInB.length} écart(s) d'unité (informatif)`;
        console.log(`  ✓ ${d.candidature} — ${c.nbValeursDistinctes} valeurs distinctes identiques fr/en, ${unites}`);
        if (!c.ecartUnites.equal) {
          console.log(`      unités fr seulement : ${JSON.stringify(c.ecartUnites.onlyInA)}`);
          console.log(`      unités en seulement : ${JSON.stringify(c.ecartUnites.onlyInB)}`);
        }
      } else {
        echecs.push(
          `  ✗ ${d.candidature}\n` +
          `      valeurs fr seulement : ${JSON.stringify(c.ecartValeurs.onlyInA)}\n` +
          `      valeurs en seulement : ${JSON.stringify(c.ecartValeurs.onlyInB)}`,
        );
      }
    }
    if (echecs.length) throw new Error(`VALEURS numériques divergentes :\n${echecs.join('\n')}`);
  });

  it('aucune formulation proscrite par le glossaire dans les rendus réels', () => {
    if (!dossiers) { expect(true).toBe(true); return; }
    for (const d of dossiers) {
      const v = violationsGlossaire(d.prose_en);
      expect(v, `${d.candidature} — formulations proscrites : ${v.join(', ')}`).toEqual([]);
    }
  });
});

// ── Glossaire juridique Ghana ───────────────────────────────────────────────
//
// Deux erreurs vérifiées, à ne jamais produire dans un rendu anglais :
//   1. le certificat de commencement d'activité est supprimé depuis le
//      Companies Act 2019 (Act 992) ; seul subsiste le Certificate of
//      Incorporation, délivré par l'Office of the Registrar of Companies ;
//   2. la formulation exigible pour les comptes est « audited financial
//      statements filed with the ORC », jamais « certified ».
//
// On vérifie ici deux choses distinctes : que le prompt porte l'interdiction,
// et qu'un rendu produit ne contient pas les formulations proscrites.

describe('glossaire juridique Ghana', () => {
  const promptSql = fs.readFileSync(
    path.resolve(__dirname, '../../supabase/migrations/20260910180100_ai_prompt_registry.sql'),
    'utf-8',
  );

  it('RENDER_DIAGNOSTIC interdit explicitement le certificat de commencement', () => {
    expect(promptSql).toMatch(/Act 992/);
    expect(promptSql).toMatch(/certificate to commence business/i);
    expect(promptSql).toMatch(/CERTIFICATE OF INCORPORATION/i);
    expect(promptSql).toMatch(/OFFICE OF THE REGISTRAR OF COMPANIES/i);
  });

  it('RENDER_DIAGNOSTIC impose « audited … filed with the ORC »', () => {
    expect(promptSql).toMatch(/audited financial statements filed with the ORC/i);
    expect(promptSql).toMatch(/certified financial statements/i); // cité comme proscrit
  });

  it('un rendu conforme ne déclenche aucune violation', () => {
    const ok = {
      legal: 'Certificate of Incorporation issued by the Office of the Registrar of Companies.',
      comptes: 'Audited financial statements filed with the ORC for 2023-2025.',
    };
    expect(violationsGlossaire(ok)).toEqual([]);
  });

  it('détecte le certificat supprimé par l\'Act 992', () => {
    const ko = { legal: 'The company must provide a certificate to commence business.' };
    expect(violationsGlossaire(ko)).toHaveLength(1);
  });

  it('détecte « certified » là où « audited … ORC » est exigé', () => {
    const ko = { comptes: 'Certified financial statements for the last three years.' };
    expect(violationsGlossaire(ko)).toHaveLength(1);
  });
});

describe('le trait d\'union ne casse plus l\'unité', () => {
  it('« 3-year » et « 3 ans » portent la même unité', () => {
    expect(extractNumericTokens('3-year history')[0].unit).toBe('AN');
    expect(extractNumericTokens('3 ans')[0].unit).toBe('AN');
  });

  it('le trait d\'union de plage reste sans effet', () => {
    // « 6-12 months » : 6 sans unité (suivi d'un chiffre), 12 en mois.
    const t = extractNumericTokens('the last 6-12 months');
    expect(t.map((x) => `${x.value}|${x.unit}`)).toEqual(['6|', '12|MOIS']);
  });

  it('un écart d\'unité seul ne bloque pas', () => {
    const fr = { a: 'historique sur 3 ans' };
    const en = { a: '3 financial years of history' }; // unité perdue, valeur intacte
    const c = compareProse(fr, en);
    expect(c.valeursIdentiques).toBe(true);
    expect(c.ecartUnites.equal).toBe(false);
  });
});

describe('deux nombres séparés par une virgule ne fusionnent pas', () => {
  it('« 22,289,209, 8 documents » donne bien deux valeurs', () => {
    const t = extractNumericTokens('Revenue XOF 22,289,209, 8 documents received, 7 usable');
    expect(t.map((x) => x.value)).toEqual(['22289209', '8', '7']);
  });

  it('« 22 289 209 FCFA, 8 pièces » aussi', () => {
    const t = extractNumericTokens('CA 22 289 209 FCFA, 8 pièces reçues, 7 exploitables');
    expect(t.map((x) => x.value)).toEqual(['22289209', '8', '7']);
  });

  it('et les deux formulations sont donc équivalentes', () => {
    const c = compareProse(
      { a: 'CA 22 289 209 FCFA, 8 pièces reçues, 7 exploitables' },
      { a: 'Revenue XOF 22,289,209, 8 documents received, 7 usable' },
    );
    expect(c.valeursIdentiques).toBe(true);
  });
});

// ── Formatage numérique du rendu ────────────────────────────────────────────
//
// Le rendu section par section traduit chaque section isolément : rien ne
// garantit la cohérence de formatage entre elles. Constaté sur RUJO v2 —
// « 250 000 » deux fois et « 250,000 » une fois dans le même document anglais.
// Un normaliseur déterministe passe côté worker AVANT l'écriture ; cette
// assertion vérifie le résultat côté lecture.

describe('aucun séparateur français dans un rendu EN', () => {
  const dossiers = chargerDossiers();

  it('les rendus servis utilisent le formatage anglais', () => {
    if (!dossiers) { expect(true).toBe(true); return; }
    for (const d of dossiers) {
      const restants = separateursEtrangers(d.prose_en);
      expect(
        restants,
        `${d.candidature} — séparateurs français résiduels : ${restants.slice(0, 8).join(' · ')}`,
      ).toEqual([]);
    }
  });

  it('détecte un séparateur français s\'il y en a un', () => {
    expect(separateursEtrangers({ a: 'Revenue of 250 000 EUR' })).toContain('0 000');
    expect(separateursEtrangers({ a: 'margin of 84,39%' })).toContain('4,39');
    expect(separateursEtrangers({ a: 'Revenue of 250,000 EUR and 84.39%' })).toEqual([]);
  });
});
