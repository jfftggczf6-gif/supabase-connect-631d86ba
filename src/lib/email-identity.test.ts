import { describe, it, expect } from 'vitest';
import { computeSenderName, computeSignature, isValidEmail } from './email-identity';

describe('email-identity — signature/expéditeur calculés (brief 2)', () => {
  it('signature = réglage org quand renseigné', () => {
    expect(computeSignature({ name: 'OVO', email_signature: 'Chaleureusement, OVO' })).toBe('Chaleureusement, OVO');
  });

  it('signature calculée sur le nom d\'org quand vide (jamais en dur)', () => {
    expect(computeSignature({ name: 'OVO' })).toBe("— L'équipe OVO");
    expect(computeSignature({ name: 'Enabel' })).toBe("— L'équipe Enabel");
  });

  it('critère 6 : une org non-OVO ne voit jamais « L\'équipe OVO »', () => {
    expect(computeSignature({ name: 'GIZ' })).not.toContain('OVO');
    expect(computeSignature({ name: 'GIZ' })).toBe("— L'équipe GIZ");
  });

  it('repli ESONO seulement si aucun nom', () => {
    expect(computeSignature({ name: '' })).toBe("— L'équipe ESONO");
    expect(computeSignature(null)).toBe("— L'équipe ESONO");
  });

  it('sender_name = réglage, sinon nom, sinon ESONO', () => {
    expect(computeSenderName({ name: 'OVO', email_sender_name: 'OVO — SusTech' })).toBe('OVO — SusTech');
    expect(computeSenderName({ name: 'OVO' })).toBe('OVO');
    expect(computeSenderName({ name: '' })).toBe('ESONO');
  });

  it('validation de forme e-mail', () => {
    expect(isValidEmail('nathalie.schots@ondernemersvoorondernemers.be')).toBe(true);
    expect(isValidEmail('a+b@ex.co')).toBe(true);
    expect(isValidEmail('pas-un-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.d')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
