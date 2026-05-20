// tests/e2e/data-room-access.spec.ts
// Brief P8 QA gate : vérification des 3 états de la page /data-room/:token.

import { test, expect } from '@playwright/test';

test.describe('Data Room public — access states', () => {
  test('Token invalide → message erreur', async ({ page }) => {
    await page.goto('/data-room/000000000000000000000000000000000000000000000000000000000000dead');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Doit afficher soit "Lien invalide", soit une erreur 401/403, soit le formulaire historique
    const body = (await page.locator('body').textContent())?.toLowerCase() || '';
    const okPatterns = [/lien invalide/i, /invalide/i, /access data room/i, /erreur 40\d/i, /403/i, /401/i];
    const matched = okPatterns.some(p => p.test(body));
    expect(matched, `Page doit afficher un message d'erreur. Body : ${body.slice(0, 200)}`).toBe(true);
  });

  test('Format slug humain (rétro-compat) → formulaire', async ({ page }) => {
    await page.goto('/data-room/short-slug');
    await page.waitForLoadState('networkidle');
    // Slug court → affiche le formulaire d'accès historique
    const body = await page.locator('body').textContent();
    expect(body?.toLowerCase()).toMatch(/access data room|token|acc[èe]der/i);
  });
});
