// playwright.config.ts
// Tests E2E (flows complets) + Visual + Content — exécute des scénarios
// utilisateur dans Chromium.
// baseURL pointe sur le dev server local (port 8080).

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Brief P8 quality gate : tests E2E + visual + content sous tests/
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'visual/**/*.spec.ts', 'content/**/*.spec.ts'],
  fullyParallel: false, // Séquentiel pour éviter les conflits sur le login
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Force 1 worker (auth partagée + déterminisme)
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,

  // Tolérance visual regression : 1% max (brief)
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
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
