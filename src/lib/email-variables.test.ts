import { describe, it, expect } from 'vitest';
import {
  EMAIL_VARIABLES, resolveRecipientVariables, extractUsedVariables,
  applyVariables, findEmptyVariables, inspectContact,
} from './email-variables';

const src = {
  contact_name: 'Khady Diallo',
  company_name: 'GIE Mame Malick',
  programme_name: 'SusTech4Africa',
  pays: 'Sénégal',
};

describe('email-variables — jeu validé', () => {
  it('offre exactement contact, entreprise, programme, pays (ni civilité ni prénom/nom)', () => {
    expect(EMAIL_VARIABLES.map((v) => v.key)).toEqual(['contact', 'entreprise', 'programme', 'pays']);
  });

  it('résout les variables depuis la candidature', () => {
    const r = resolveRecipientVariables(src);
    expect(r).toEqual({ contact: 'Khady Diallo', entreprise: 'GIE Mame Malick', programme: 'SusTech4Africa', pays: 'Sénégal' });
  });

  it('extrait les variables connues utilisées, ignore les inconnues', () => {
    expect(extractUsedVariables('Bonjour {{contact}} de {{entreprise}} — {{inconnue}}').sort())
      .toEqual(['contact', 'entreprise']);
  });

  it('applique les variables ; laisse les inconnues telles quelles', () => {
    const out = applyVariables('Bonjour {{ contact }}, {{entreprise}} au {{pays}}. {{xyz}}', resolveRecipientVariables(src));
    expect(out).toBe('Bonjour Khady Diallo, GIE Mame Malick au Sénégal. {{xyz}}');
  });

  it('signale les variables utilisées vides (critère 7)', () => {
    const r = resolveRecipientVariables({ ...src, pays: '' });
    expect(findEmptyVariables('Bonjour {{contact}} au {{pays}}', r)).toEqual(['pays']);
    expect(findEmptyVariables('Bonjour {{contact}}', r)).toEqual([]);
  });
});

describe('inspectContact — contrôle automatique (cas réels)', () => {
  it('ok pour un nom propre normal', () => {
    expect(inspectContact('Khady Diallo').suspect).toBe(false);
  });

  it('signale une valeur vide', () => {
    expect(inspectContact('   ').suspect).toBe(true);
  });

  it('signale un numéro de téléphone (contient un chiffre)', () => {
    expect(inspectContact('779473709').raisons).toContain('contient un chiffre');
    expect(inspectContact('77 636 56 57').raisons).toContain('contient un chiffre');
  });

  it('signale un token unique de moins de 3 caractères', () => {
    expect(inspectContact('Ba').raisons).toContain('trop court');
  });

  it('signale une civilité en tête et propose la valeur nettoyée', () => {
    const i = inspectContact('Mme CISSE');
    expect(i.suspect).toBe(true);
    expect(i.raisons).toContain('commence par une civilité');
    expect(i.valeurNettoyee).toBe('CISSE');
    expect(inspectContact('M. Diallo').valeurNettoyee).toBe('Diallo');
    expect(inspectContact('Dr. Sow').valeurNettoyee).toBe('Sow');
  });

  it('ne sur-signale pas un nom composé ou en capitales sans chiffre ni civilité', () => {
    expect(inspectContact('El Hadji Bitèye').suspect).toBe(false);
    expect(inspectContact('ABDOULAYE NIANG').suspect).toBe(false);
  });
});
