// La quatrième classe : une abréviation française dans la prose anglaise.
//
// « CA » a survécu trois fois dans le rendu de RUJO — « CA ≥ 20,000 EUR » —
// alors que les trois garde-fous existants étaient verts. Aucun ne pouvait le
// voir, et ce n'est pas un oubli d'écriture :
//
//   • le contrôle de diacritiques ne le voit pas — « CA » n'en porte aucun ;
//   • le référentiel de libellés ne couvre pas la prose, qui est rendue par le
//     modèle et non habillée à l'affichage ;
//   • le bloc de terminologie de v3 ne couvrait que deux champs structurés.
//
// C'est la QUATRIÈME fois dans ce chantier qu'une classe entière échappe au
// comptage. Une liste d'abréviations proscrites attraperait « CA » et manquerait
// la suivante. La charge de la preuve est donc inversée, comme pour les
// libellés : tout sigle du rendu doit être DÉCLARÉ.

import { describe, it, expect } from 'vitest';
import {
  sigles, siglesNonDeclares, abreviationsFrancaises,
  SIGLES_INVARIANTS, ABREVIATIONS_PROSCRITES,
  violationsGlossaire, separateursEtrangers,
} from '@/lib/prose-controls';

describe('extraction des sigles', () => {
  it('capture les majuscules de 2 à 6 caractères, chiffres compris', () => {
    const s = sigles({ a: 'Revenue of 30,000 EUR filed with the ORC, level N0.' });
    expect([...s.keys()].sort()).toEqual(['EUR', 'N0', 'ORC']);
  });

  it('compte les occurrences', () => {
    expect(sigles({ a: 'EUR here', b: 'EUR there, EUR again' }).get('EUR')).toBe(3);
  });

  it('ignore un mot capitalisé ordinaire', () => {
    expect([...sigles({ a: 'Revenue Growth Potential' }).keys()]).toEqual([]);
  });
});

describe('un sigle non déclaré échoue — la règle, pas la liste', () => {
  it('attrape « CA », le défaut constaté sur RUJO', () => {
    const fuites = siglesNonDeclares({ a: 'Turnover of CA ≥ 20,000 EUR for the last year.' });
    expect(fuites.map((f) => f.sigle)).toEqual(['CA']);
    expect(fuites[0].attendu).toBe('revenue');
  });

  it('attrape un sigle INCONNU des deux registres — c\'est tout l\'intérêt', () => {
    // Ni invariant déclaré, ni abréviation proscrite connue. La liste ne
    // l'aurait pas vu ; la règle le remonte pour arbitrage.
    const fuites = siglesNonDeclares({ a: 'Financed by the XYZW programme.' });
    expect(fuites.map((f) => f.sigle)).toEqual(['XYZW']);
    expect(fuites[0].attendu).toBeUndefined();
  });

  it('laisse passer les invariants déclarés', () => {
    const prose = { a: 'Audited statements filed with the ORC, reviewed by the GRA. EBITDA in EUR.' };
    expect(siglesNonDeclares(prose)).toEqual([]);
  });

  it('laisse passer un mot anglais en capitales, sans liste de mots', () => {
    // « DO NOT decide » — la forme minuscule apparaît ailleurs dans la prose,
    // donc c'est un mot, pas un sigle. Règle, pas énumération.
    const prose = {
      a: 'Recommendation: DO NOT decide in committee at this stage.',
      b: 'The committee should not decide before the documents are provided, and we do expect them.',
    };
    expect(siglesNonDeclares(prose)).toEqual([]);
  });

  it('mais ne laisse pas passer un sigle qui n\'est pas un mot anglais', () => {
    const prose = {
      a: 'Recommendation: DO NOT decide. CA is unverified.',
      b: 'The committee should not decide, and we do expect documents.',
    };
    expect(siglesNonDeclares(prose).map((f) => f.sigle)).toEqual(['CA']);
  });
});

describe('registre des abréviations françaises — le doublon de sécurité', () => {
  it('attrape les abréviations que tu as nommées', () => {
    const prose = { a: 'CA and BFR and EBE and RN and VA and TVA and CAHT.' };
    expect(abreviationsFrancaises(prose).map((f) => f.sigle))
      .toEqual(['BFR', 'CA', 'CAHT', 'EBE', 'RN', 'TVA', 'VA']);
  });

  it('attrape aussi celles relevées sur les proses françaises des deux dossiers', () => {
    // PME, RH, ODD, DG, GMS, BAD apparaissent dans les proses FR et doivent
    // avoir disparu du rendu EN.
    const prose = { a: 'PME, RH, ODD, DG, GMS, BAD.' };
    expect(abreviationsFrancaises(prose).map((f) => f.sigle))
      .toEqual(['BAD', 'DG', 'GMS', 'ODD', 'PME', 'RH']);
  });

  it('chaque abréviation proscrite porte son équivalent anglais', () => {
    for (const [fr, en] of Object.entries(ABREVIATIONS_PROSCRITES)) {
      expect(en.length, `abréviation sans équivalent : ${fr}`).toBeGreaterThan(1);
    }
  });

  it('aucune abréviation proscrite n\'est déclarée invariante — les deux registres sont disjoints', () => {
    const collision = Object.keys(ABREVIATIONS_PROSCRITES).filter((k) => k in SIGLES_INVARIANTS);
    expect(collision, `sigles déclarés dans les deux registres : ${collision.join(', ')}`).toEqual([]);
  });

  it('chaque invariant porte sa raison', () => {
    for (const [sigle, raison] of Object.entries(SIGLES_INVARIANTS)) {
      expect(raison.length, `invariant sans justification : ${sigle}`).toBeGreaterThan(10);
    }
  });

  it('les sigles arbitrés sur rendu réel sont déclarés, pas ignorés', () => {
    // Premier passage du détecteur sur les rendus réels : il a remonté DO, YES
    // et Y0 sur Sweet Life. Aucun n'est une abréviation française — « DO NOT
    // decide » est une emphase, « 'YES' » cite la réponse du candidat, « Y0 »
    // est une notation d'exercice. Ils sont donc DÉCLARÉS, avec leur raison,
    // plutôt qu'écartés par une exception muette.
    const prose = {
      a: "Recommendation: DO NOT decide in committee at this stage.",
      b: "The company declares having existed for more than 3 years ('YES' response).",
      c: 'Revenue history over 3 financial years (Y-2, Y-1, Y0).',
    };
    expect(siglesNonDeclares(prose)).toEqual([]);
    for (const s of ['DO', 'NOT', 'YES', 'Y0']) {
      expect(s in SIGLES_INVARIANTS, `${s} devrait être déclaré`).toBe(true);
    }
  });

  it('deuxième arbitrage, sur le troisième dossier rendu', () => {
    // Le rendu de la candidature Sweet Life du 12/09 a remonté six sigles
    // nouveaux d'un coup. C'est le coût annoncé de la règle — un dossier neuf
    // apporte ses institutions et ses normes — et c'est aussi sa valeur : il a
    // fallu les regarder une fois, et aucun n'était français.
    const prose = {
      a: 'Export quality certifications (HACCP, BRC, IFS).',
      b: 'Recommendation by COLEAD, an organisation recognised in agricultural export support.',
      c: 'Assess repayment capacity (DSCR) and tonnes of CO2 avoided, with GHG reduction.',
    };
    expect(siglesNonDeclares(prose)).toEqual([]);
    for (const s of ['BRC', 'IFS', 'COLEAD', 'DSCR', 'GHG', 'CO2']) {
      expect(s in SIGLES_INVARIANTS, `${s} devrait être déclaré`).toBe(true);
    }
  });

  it('ne signale rien sur une prose anglaise propre', () => {
    const prose = { a: 'Revenue of at least 30,000 EUR, audited statements filed with the ORC.' };
    expect(abreviationsFrancaises(prose)).toEqual([]);
    expect(siglesNonDeclares(prose)).toEqual([]);
  });
});

describe('les deux contrôles déplacés depuis le test gardent leur comportement', () => {
  it('glossaire Ghana', () => {
    expect(violationsGlossaire({ a: 'a certificate to commence business' })).toHaveLength(1);
    expect(violationsGlossaire({ a: 'Certificate of Incorporation from the ORC' })).toEqual([]);
  });

  it('séparateurs français', () => {
    expect(separateursEtrangers({ a: 'Revenue of 250 000 EUR' })).toContain('0 000');
    expect(separateursEtrangers({ a: 'Revenue of 250,000 EUR and 84.39%' })).toEqual([]);
  });
});
