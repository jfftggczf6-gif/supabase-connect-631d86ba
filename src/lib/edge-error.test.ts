import { describe, it, expect } from 'vitest';
import { extractEdgeError } from './edge-error';

describe('extractEdgeError', () => {
  it('returns null when there is neither error nor data error', async () => {
    expect(await extractEdgeError(null, { membership: true })).toBeNull();
  });

  it('prefers a data-level error (function returned 2xx with {error})', async () => {
    expect(await extractEdgeError(null, { error: 'Rôle invalide' })).toBe('Rôle invalide');
  });

  it('reads the real message from error.context (FunctionsHttpError body)', async () => {
    // supabase-js puts the non-2xx response in error.context as a Response
    const error = {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ error: 'Création compte: email already registered' }) },
    };
    expect(await extractEdgeError(error, null)).toBe('Création compte: email already registered');
  });

  it('falls back to body.message when there is no body.error', async () => {
    const error = {
      message: 'non-2xx',
      context: { json: async () => ({ message: 'Boom' }) },
    };
    expect(await extractEdgeError(error, null)).toBe('Boom');
  });

  it('falls back to error.message when context body is not JSON', async () => {
    const error = {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => { throw new Error('not json'); } },
    };
    expect(await extractEdgeError(error, null)).toBe('Edge Function returned a non-2xx status code');
  });

  it('falls back to error.message when there is no context', async () => {
    expect(await extractEdgeError({ message: 'Network error' }, null)).toBe('Network error');
  });
});
