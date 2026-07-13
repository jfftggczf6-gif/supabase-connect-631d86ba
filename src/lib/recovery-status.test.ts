import { describe, it, expect } from 'vitest';
import { getRecoveryStatus } from './recovery-status';

const future = new Date(Date.now() + 3 * 86400_000).toISOString();
const past = new Date(Date.now() - 86400_000).toISOString();

describe('getRecoveryStatus', () => {
  it('aucun lien envoyé → none', () => {
    expect(getRecoveryStatus({}).state).toBe('none');
    expect(getRecoveryStatus(null).state).toBe('none');
    expect(getRecoveryStatus({ recovery_token: null, recovery_expires_at: null }).state).toBe('none');
  });

  it('lien envoyé, non complété, non expiré → pending', () => {
    const rs = getRecoveryStatus({ recovery_token: 'tok', recovery_expires_at: future });
    expect(rs.state).toBe('pending');
    expect(rs.date).toBe(future);
  });

  it('lien envoyé, non complété, échéance passée → expired', () => {
    const rs = getRecoveryStatus({ recovery_token: 'tok', recovery_expires_at: past });
    expect(rs.state).toBe('expired');
  });

  it('complété → completed, prioritaire même si expiré', () => {
    const used = '2026-07-13T14:58:26.176Z';
    const rs = getRecoveryStatus({ recovery_token: 'tok', recovery_expires_at: past, recovery_used_at: used });
    expect(rs.state).toBe('completed');
    expect(rs.date).toBe(used);
  });

  it('complété sans token (régénération/nettoyage) → completed', () => {
    expect(getRecoveryStatus({ recovery_used_at: past }).state).toBe('completed');
  });
});
