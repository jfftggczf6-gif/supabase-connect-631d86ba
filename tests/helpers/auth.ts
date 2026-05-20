// tests/helpers/auth.ts
// Helpers d'authentification pour les tests Playwright.
// Brief P8 quality gate.

import { Page, expect } from '@playwright/test';

export const BA_USER = { email: 'partner@cisse.local', password: 'Test123!' };
export const PE_USER = { email: 'md@adiwale.local',   password: 'Test123!' };

/** Login via la page /auth puis attend la redirection vers le dashboard. */
export async function login(page: Page, user: { email: string; password: string }, expectedPathPrefix?: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  // Attendre l'affichage du formulaire
  await page.waitForSelector('input#email, input[type="email"]', { timeout: 15_000 });
  // Accepte plusieurs implémentations possibles (champ email/password classique)
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
  const pwInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.fill(user.email);
  await pwInput.fill(user.password);
  // Soumet (bouton de type submit ou Enter)
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count() > 0) {
    await submit.click();
  } else {
    await pwInput.press('Enter');
  }
  // Redirige vers /ba, /pe, ou /dashboard selon l'org type
  await page.waitForURL((url) =>
    !url.pathname.startsWith('/login') && !url.pathname.startsWith('/auth') && url.pathname !== '/',
    { timeout: 25_000 },
  );
  if (expectedPathPrefix) {
    expect(page.url()).toContain(expectedPathPrefix);
  }
}

/** Mock toutes les EF de génération IA (renvoie 200 sans toucher Railway). */
export async function mockAiEdgeFunctions(page: Page) {
  const aiEfs = [
    'generate-pe-pre-screening',
    'generate-ic1-memo',
    'generate-pe-valuation',
    'generate-teaser-ba',
    'match-deal-funds',
    'analyze-pe-deal-note',
    'regenerate-pe-section',
    'send-teaser-to-fund',
    'share-im-after-nda',
    'create-pe-deal-from-ba',
    'share-pe-data-room',
  ];
  await page.route(/\/functions\/v1\/(.+)$/, async (route) => {
    const url = route.request().url();
    const matched = aiEfs.find(fn => url.includes(`/functions/v1/${fn}`));
    if (matched) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mocked: true,
          edge_function: matched,
          job_id: `mock-${matched}-${Date.now()}`,
        }),
      });
    } else {
      await route.continue();
    }
  });
}
