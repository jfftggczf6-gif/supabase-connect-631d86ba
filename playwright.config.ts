// playwright.config.ts
// Tests E2E (flows complets) — exécute des scénarios utilisateur dans Chromium.
// baseURL pointe sur le dev server local (port 8080, override projet vs 5173 Vite default).
//
// Démarre automatiquement `npm run dev` avant les tests si pas déjà lancé.
// MSW (msw/node) peut être intégré dans les tests E2E pour mocker le back Supabase.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Démarre le dev server avant les tests (skip si déjà lancé sur le port).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
