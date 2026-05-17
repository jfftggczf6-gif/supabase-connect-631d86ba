// tests/unit/setup.ts
// Setup global pour Vitest : matchers jest-dom + MSW server lifecycle.

import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';

// Démarre MSW avant tous les tests, reset les handlers après chaque, ferme à la fin.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
