import { describe, it, expect } from 'vitest';
import {
  resolveFieldLabel,
  resolveOptionLabel,
  resolvePresentation,
  resolveDefaultFieldOverride,
  computeLangCompleteness,
  type FormTranslations,
  type TranslatableField,
} from './form-i18n';

const field: TranslatableField = {
  id: 'q1',
  label: 'Quelle est la ville de votre projet ?',
  type: 'select',
  options: ['Dakar', 'Thiès'],
};

const tr: FormTranslations = {
  en: {
    presentation: 'English presentation',
    default_fields: { secteur: 'Sector of activity' },
    form_fields: {
      q1: { label: 'What is your project city?', options: { Dakar: 'Dakar', 'Thiès': 'Thies' } },
    },
  },
};

describe('resolveFieldLabel', () => {
  it('langue = base → libellé de base', () => {
    expect(resolveFieldLabel(field, 'fr', 'fr', tr)).toBe(field.label);
  });
  it('autre langue → traduction si présente', () => {
    expect(resolveFieldLabel(field, 'en', 'fr', tr)).toBe('What is your project city?');
  });
  it('autre langue sans traduction → repli sur la base', () => {
    expect(resolveFieldLabel({ ...field, id: 'q2' }, 'en', 'fr', tr)).toBe(field.label);
    expect(resolveFieldLabel(field, 'en', 'fr', {})).toBe(field.label);
    expect(resolveFieldLabel(field, 'en', 'fr', null)).toBe(field.label);
  });
  it('base=en → un affichage fr sans traduction retombe sur la base anglaise', () => {
    expect(resolveFieldLabel({ ...field, label: 'City?' }, 'fr', 'en', null)).toBe('City?');
  });
});

describe('resolveOptionLabel', () => {
  it('traduit une option, garde la valeur de base en repli', () => {
    expect(resolveOptionLabel(field, 'Thiès', 'en', 'fr', tr)).toBe('Thies');
    expect(resolveOptionLabel(field, 'Dakar', 'en', 'fr', tr)).toBe('Dakar');
    expect(resolveOptionLabel(field, 'Saint-Louis', 'en', 'fr', tr)).toBe('Saint-Louis'); // absente → repli
  });
  it('langue = base → valeur telle quelle', () => {
    expect(resolveOptionLabel(field, 'Thiès', 'fr', 'fr', tr)).toBe('Thiès');
  });
});

describe('resolvePresentation', () => {
  it('traduit si présent, sinon repli sur la base', () => {
    expect(resolvePresentation('Présentation FR', 'en', 'fr', tr)).toBe('English presentation');
    expect(resolvePresentation('Présentation FR', 'en', 'fr', {})).toBe('Présentation FR');
    expect(resolvePresentation('Présentation FR', 'fr', 'fr', tr)).toBe('Présentation FR');
  });
});

describe('resolveDefaultFieldOverride', () => {
  it('sans override → undefined (le libellé canon passe par i18n, pas ici)', () => {
    expect(resolveDefaultFieldOverride('secteur', undefined, 'en', 'fr', tr)).toBeUndefined();
    expect(resolveDefaultFieldOverride('secteur', '  ', 'en', 'fr', tr)).toBeUndefined();
  });
  it('override + traduction présente', () => {
    expect(resolveDefaultFieldOverride('secteur', "Domaine d'activité", 'en', 'fr', tr)).toBe('Sector of activity');
  });
  it('override sans traduction → repli sur override de base', () => {
    expect(resolveDefaultFieldOverride('pays', 'Pays cible', 'en', 'fr', tr)).toBe('Pays cible');
  });
});

describe('computeLangCompleteness (garde-fou anti-mélange)', () => {
  const surface = {
    presentation: 'Présentation FR',
    fields: [field],
    defaultOverrides: { secteur: "Domaine d'activité" },
  };

  it('langue de base → toujours complète', () => {
    expect(computeLangCompleteness(surface, 'fr', 'fr', tr).complete).toBe(true);
  });

  it('EN complet (présentation + question + 2 options + override) → complete', () => {
    expect(computeLangCompleteness(surface, 'en', 'fr', tr).complete).toBe(true);
  });

  it('EN incomplet → complete=false + liste des manquants', () => {
    const partial: FormTranslations = { en: { form_fields: { q1: { label: 'City?' } } } };
    const res = computeLangCompleteness(surface, 'en', 'fr', partial);
    expect(res.complete).toBe(false);
    expect(res.missing).toContain('présentation');
    expect(res.missing.some(m => m.includes('option'))).toBe(true);
    expect(res.missing.some(m => m.includes('libellé'))).toBe(true);
  });

  it('aucune traduction → tout manque', () => {
    const res = computeLangCompleteness(surface, 'en', 'fr', {});
    expect(res.complete).toBe(false);
    expect(res.missing.length).toBeGreaterThanOrEqual(4); // présentation + question + 2 options + override
  });
});
