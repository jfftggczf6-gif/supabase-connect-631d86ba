// tests/mocks/server.ts
// MSW server pour Node (utilisé par Vitest dans setup.ts).
// Pour les tests E2E Playwright, l'app appelle le vrai Supabase ou un MSW
// injecté via init script ; v1 = tests E2E avec back réel.

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
