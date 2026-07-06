import { describe, it, expect } from 'vitest';
import {
  resolveFieldLabel,
  resolveOptionLabel,
  resolvePresentation,
  resolveDefaultFieldOverride,
  computeLangCompleteness,
  collectTranslatableSegments,
  buildMarkedPrompt,
  parseMarkedResponse,
  type FormTranslations,
  type TranslatableField,
  type TranslatableSurface,
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

describe('traduction auto : round-trip segments <-> réponse marquée', () => {
  const surface: TranslatableSurface = {
    presentation: '# Appel Ghana\n\nRejoignez le programme.\n\n- point un',
    fields: [
      { id: 'q1', label: 'Ville du projet ?', type: 'select', options: ['Dakar', 'Thiès'] },
      { id: 'q2', label: 'Décrivez votre activité', type: 'textarea' },
    ],
    defaultOverrides: { secteur: "Domaine d'activité" },
  };

  it('collecte les segments non vides, présentation découpée par ligne (lignes vides ignorées)', () => {
    const segs = collectTranslatableSegments(surface);
    const presSegs = segs.filter(s => s.descriptor.kind === 'presentation');
    // 3 lignes non vides sur 5 (2 vides ignorées)
    expect(presSegs.length).toBe(3);
    expect(segs.some(s => s.descriptor.kind === 'field_label' && s.descriptor.id === 'q1')).toBe(true);
    expect(segs.filter(s => s.descriptor.kind === 'field_option').length).toBe(2);
    expect(segs.some(s => s.descriptor.kind === 'default_label')).toBe(true);
  });

  it('buildMarkedPrompt numérote les segments [0]…[N]', () => {
    const segs = collectTranslatableSegments(surface);
    const prompt = buildMarkedPrompt(segs);
    expect(prompt.startsWith('[0] ')).toBe(true);
    expect(prompt.split('\n').length).toBe(segs.length);
  });

  it('parseMarkedResponse reconstruit un FormLangTranslations complet + réassemble la présentation', () => {
    const segs = collectTranslatableSegments(surface);
    // Réponse simulée : on renvoie chaque marqueur avec un texte "EN:<i>"
    const raw = segs.map((_, i) => `[${i}] EN${i}`).join('\n');
    const tr = parseMarkedResponse(raw, segs, surface);
    // structure
    expect(tr.form_fields?.q1?.label).toBeTruthy();
    expect(tr.form_fields?.q1?.options?.['Dakar']).toBeTruthy();
    expect(tr.form_fields?.q1?.options?.['Thiès']).toBeTruthy();
    expect(tr.form_fields?.q2?.label).toBeTruthy();
    expect(tr.default_fields?.secteur).toBeTruthy();
    // présentation réassemblée : même nombre de lignes que l'original (lignes vides préservées)
    expect(tr.presentation!.split('\n').length).toBe(surface.presentation!.split('\n').length);
    expect(tr.presentation).toContain('\n\n'); // conserve les lignes vides (structure Markdown)
  });

  it('round-trip complet → langue jugée complète par le garde-fou', () => {
    const segs = collectTranslatableSegments(surface);
    const raw = segs.map((_, i) => `[${i}] translated ${i}`).join('\n');
    const tr = parseMarkedResponse(raw, segs, surface);
    const res = computeLangCompleteness(surface, 'en', 'fr', { en: tr });
    expect(res.complete).toBe(true);
  });

  it('réponse partielle (marqueurs manquants) → segments omis → langue incomplète (fail-safe)', () => {
    const segs = collectTranslatableSegments(surface);
    // On ne renvoie que le premier segment
    const raw = `[0] only first`;
    const tr = parseMarkedResponse(raw, segs, surface);
    const res = computeLangCompleteness(surface, 'en', 'fr', { en: tr });
    expect(res.complete).toBe(false);
  });
});
