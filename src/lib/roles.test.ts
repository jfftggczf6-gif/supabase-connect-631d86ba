import { describe, it, expect } from 'vitest';
import { getInvitableRoles, humanizeRole } from './roles';

describe('getInvitableRoles — PE', () => {
  it("retourne les rôles PE pour un owner d'org PE", () => {
    const roles = getInvitableRoles('pe', 'owner').map(r => r.value);
    expect(roles).toContain('admin');
    expect(roles).toContain('managing_director');
    expect(roles).toContain('investment_manager');
    expect(roles).toContain('analyst');
    expect(roles).not.toContain('coach');
  });

  it('un MD ne peut pas inviter un admin', () => {
    const roles = getInvitableRoles('pe', 'managing_director').map(r => r.value);
    expect(roles).not.toContain('admin');
    expect(roles).toContain('investment_manager');
    expect(roles).toContain('analyst');
  });

  it("un IM ne peut pas inviter un MD ni un admin (mais peut inviter un autre IM en pair)", () => {
    const roles = getInvitableRoles('pe', 'investment_manager').map(r => r.value);
    expect(roles).not.toContain('admin');
    expect(roles).not.toContain('managing_director');
    expect(roles).toContain('investment_manager'); // pair-invite OK par design
    expect(roles).toContain('analyst');
  });

  it('un analyste invite des pairs/entrepreneurs uniquement (pas de MD, IM, admin)', () => {
    const roles = getInvitableRoles('pe', 'analyst').map(r => r.value);
    expect(roles).not.toContain('admin');
    expect(roles).not.toContain('managing_director');
    expect(roles).not.toContain('investment_manager');
    expect(roles).toContain('analyst'); // pair OK
    expect(roles).toContain('entrepreneur');
  });

  it('un super_admin invite tout y compris depuis analyst', () => {
    const roles = getInvitableRoles('pe', 'analyst', true).map(r => r.value);
    expect(roles.length).toBeGreaterThan(0);
    expect(roles).toContain('managing_director');
  });
});

describe('humanizeRole', () => {
  it('libelle MD pour PE', () => {
    expect(humanizeRole('managing_director', 'pe')).toBe('Managing Director');
  });

  it('libelle IM pour PE', () => {
    expect(humanizeRole('investment_manager', 'pe')).toBe('Investment Manager');
  });

  it("libelle analyst pour PE", () => {
    expect(humanizeRole('analyst', 'pe')).toBe('Analyste');
  });
});
