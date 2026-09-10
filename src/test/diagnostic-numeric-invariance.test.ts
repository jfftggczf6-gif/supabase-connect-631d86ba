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
} from '@/lib/numeric-tokens';
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
  it('une traduction fidèle conserve exactement les mêmes tokens', () => {
    const d = diffMultisets(numericMultiset(PROSE_FR), numericMultiset(PROSE_EN_OK));
    expect(
      d.equal,
      `tokens fr absents en en : ${JSON.stringify(d.onlyInA)}\n` +
      `tokens en absents en fr : ${JSON.stringify(d.onlyInB)}`,
    ).toBe(true);
  });

  it('détecte un arrondi (« 22 289 209 » → « 22.3 million »)', () => {
    const d = diffMultisets(numericMultiset(PROSE_FR), numericMultiset(PROSE_EN_ARRONDIE));
    expect(d.equal).toBe(false);
    expect(d.onlyInA.map((x) => x.token)).toContain('22289209|');
  });

  it('détecte un chiffre altéré (209 → 290)', () => {
    const d = diffMultisets(numericMultiset(PROSE_FR), numericMultiset(PROSE_EN_FAUTE_DE_FRAPPE));
    expect(d.equal).toBe(false);
    expect(d.onlyInB.map((x) => x.token)).toContain('22289290|');
  });

  it('détecte une omission (« 8 pièces, 7 exploitables » → « several »)', () => {
    const d = diffMultisets(numericMultiset(PROSE_FR), numericMultiset(PROSE_EN_OMISSION));
    expect(d.equal).toBe(false);
    const manquants = d.onlyInA.map((x) => x.token);
    expect(manquants).toContain('8|');
    expect(manquants).toContain('7|');
  });

  it('ne compare que la prose : le déterministe n\'entre pas dans le calcul', () => {
    // Un screening_data complet, dont le score 62 n'apparaît dans aucune phrase.
    const sd = { score: 62, resume_comite: 'Aucun chiffre ici.', qualite_dossier: { total_documents: 8, note_qualite: 'Rien.' } };
    const prose = extractProse(sd);
    expect(numericMultiset(prose).size).toBe(0);
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

const FIXTURE = path.resolve(__dirname, 'fixtures/renders-en.json');

describe('dossiers réellement rendus en anglais', () => {
  it('compare chaque dossier exporté, ou signale qu\'il n\'y en a pas', () => {
    if (!fs.existsSync(FIXTURE)) {
      // Pas un échec : une absence de données, déclarée comme telle.
      console.warn(
        '[invariance numérique] aucun dossier rendu en anglais à ce jour — ' +
        'déposer src/test/fixtures/renders-en.json ({ candidature, prose_fr, prose_en }[]) ' +
        'pour activer cette vérification sur données réelles.',
      );
      expect(true).toBe(true);
      return;
    }
    const dossiers = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as
      { candidature: string; prose_fr: unknown; prose_en: unknown }[];
    expect(dossiers.length).toBeGreaterThan(0);
    for (const d of dossiers) {
      const diff = diffMultisets(numericMultiset(d.prose_fr), numericMultiset(d.prose_en));
      expect(
        diff.equal,
        `${d.candidature} — tokens divergents\n` +
        `  présents en fr seulement : ${JSON.stringify(diff.onlyInA)}\n` +
        `  présents en en seulement : ${JSON.stringify(diff.onlyInB)}`,
      ).toBe(true);
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

const PROSCRIT = [
  /certificate\s+to\s+commence\s+business/i,
  /certificate\s+of\s+commencement\s+of\s+business/i,
  /certified\s+financial\s+statements/i,
];

function violationsGlossaire(prose: unknown): string[] {
  const found: string[] = [];
  for (const s of flattenProse(prose)) {
    for (const re of PROSCRIT) {
      const m = s.match(re);
      if (m) found.push(m[0]);
    }
  }
  return found;
}

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
