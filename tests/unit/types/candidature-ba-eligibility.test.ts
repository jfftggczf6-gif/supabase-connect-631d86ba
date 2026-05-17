// tests/unit/types/candidature-ba-eligibility.test.ts
// Test du helper computeEligibility qui calcule le niveau d'éligibilité
// d'une candidature BA à partir de ses form_data (rule-based, 5 critères).

import { describe, expect, it } from 'vitest';
import { computeEligibility } from '@/types/candidature-ba';

describe('computeEligibility', () => {
  it('retourne green quand les 5 critères sont satisfaits', () => {
    const result = computeEligibility({
      "Secteur d'activité": 'FinTech',
      "Pays d'opération": "Côte d'Ivoire",
      'Ticket recherché (M USD)': '10',
      'Année de création': 2020,
      'Email de contact': 'ceo@finhub.ci',
    });

    expect(result.level).toBe('green');
    expect(result.criteriaPassed).toBe(5);
    expect(result.criteria).toHaveLength(5);
    expect(result.criteria.every(c => c.ok)).toBe(true);
  });

  it('retourne orange quand 3-4 critères sont satisfaits', () => {
    const result = computeEligibility({
      "Secteur d'activité": 'Agro',
      "Pays d'opération": 'Mali',
      'Ticket recherché (M USD)': '50',          // hors fourchette 2-25
      'Année de création': 2024,                  // moins de 3 ans
      'Email de contact': 'contact@example.com',
    });

    expect(result.level).toBe('orange');
    expect(result.criteriaPassed).toBe(3);
  });

  it('retourne red quand ≤ 2 critères satisfaits', () => {
    const result = computeEligibility({
      "Secteur d'activité": '',                    // vide
      "Pays d'opération": 'France',                // hors UEMOA
      'Ticket recherché (M USD)': '0.5',           // sous fourchette
      'Année de création': 2025,                   // trop récent
      'Email de contact': 'pas-un-email',          // pas de @
    });

    expect(result.level).toBe('red');
    expect(result.criteriaPassed).toBeLessThanOrEqual(2);
  });

  it('tolère un form_data vide (aucun critère)', () => {
    const result = computeEligibility({});
    expect(result.level).toBe('red');
    expect(result.criteriaPassed).toBe(0);
  });

  it('extrait le ticket même formaté "2-5M USD"', () => {
    const result = computeEligibility({
      "Secteur d'activité": 'Pharma',
      "Pays d'opération": "Côte d'Ivoire",
      'Ticket recherché (M USD)': '2-5M USD',     // extraction du premier nombre = 2
      'Année de création': 2018,
      'Email de contact': 'pharma@example.ci',
    });

    expect(result.criteria.find(c => c.label.includes('fourchette'))?.ok).toBe(true);
    expect(result.level).toBe('green');
  });

  it('matche par pattern même si le Partner personnalise les labels FR', () => {
    // Le Partner a renommé les champs mais les regex FR matchent.
    const result = computeEligibility({
      'Secteur principal': 'Énergie',
      'Pays HQ': 'Sénégal',
      'Ticket cible': '8',
      "Année de création société": 2017,
      'Email contact principal': 'founder@solar.sn',
    });

    expect(result.level).toBe('green');
    expect(result.criteriaPassed).toBe(5);
  });

  it('exporte chaque critère individuellement avec son label', () => {
    const result = computeEligibility({ "Secteur d'activité": 'Agro' });
    expect(result.criteria.map(c => c.label)).toEqual([
      'Secteur renseigné',
      'Pays UEMOA / CEDEAO francophone',
      'Ticket dans la fourchette (2-25 M USD)',
      'Ancienneté société ≥ 3 ans',
      'Email de contact fourni',
    ]);
    expect(result.criteria[0].ok).toBe(true);
    expect(result.criteria.slice(1).every(c => !c.ok)).toBe(true);
  });
});
