import { describe, it, expect } from 'vitest';
import { estAutoriseEmission } from './email-emission-auth';

const base = { superAdmin: false, orgManager: false, sentBy: 'coach-1' };

describe('estAutoriseEmission (bouton message + envoi groupé)', () => {
  it('super_admin : autorisé', () => {
    expect(estAutoriseEmission({ ...base, superAdmin: true, recipientCoachIds: [null] })).toBe(true);
  });

  it('owner/admin/manager de l\'org : autorisé', () => {
    expect(estAutoriseEmission({ ...base, orgManager: true, recipientCoachIds: [null, 'x'] })).toBe(true);
  });

  it('coach assigné de TOUS les destinataires : autorisé', () => {
    expect(estAutoriseEmission({ ...base, recipientCoachIds: ['coach-1', 'coach-1', 'coach-1'] })).toBe(true);
  });

  it('coach assigné à UNE PARTIE (2/3) : refusé sur toute l\'opération', () => {
    expect(estAutoriseEmission({ ...base, recipientCoachIds: ['coach-1', 'coach-1', 'coach-2'] })).toBe(false);
  });

  it('coach avec un destinataire NON assigné (null) : refusé', () => {
    expect(estAutoriseEmission({ ...base, recipientCoachIds: ['coach-1', null] })).toBe(false);
  });

  it('coach mono-destinataire assigné : autorisé', () => {
    expect(estAutoriseEmission({ ...base, recipientCoachIds: ['coach-1'] })).toBe(true);
  });

  it('aucun destinataire : refusé (pas de coach de rien)', () => {
    expect(estAutoriseEmission({ ...base, recipientCoachIds: [] })).toBe(false);
  });
});
