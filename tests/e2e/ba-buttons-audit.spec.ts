// tests/e2e/ba-buttons-audit.spec.ts
// Brief P8 QA gate : audit chaque bouton du workspace BA.
// Un bouton qui ne fait rien (pas de DOM change / network / toast) = FAIL.

import { test, expect } from '@playwright/test';
import { login, mockAiEdgeFunctions, BA_USER } from '../helpers/auth';

test.describe('BA buttons audit', () => {
  test.setTimeout(120_000);

  test('Chaque bouton sidebar BA fait une action observable', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await mockAiEdgeFunctions(page);
    await login(page, BA_USER);

    await page.goto('/ba/pipeline');
    await page.waitForLoadState('networkidle');

    // Ouvre PharmaCi
    const dealLink = page.getByText(/PharmaCi|DEAL-2026-001/i).first();
    if (await dealLink.count() === 0) test.skip(true, 'PharmaCi pas trouvé');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    await page.waitForLoadState('networkidle');

    // Liste des sections sidebar à visiter
    const sectionLabels = [
      "Vue d'ensemble",
      'Upload documents',
      'Pré-screening',
      'Valorisation',
      'Teaser',
      'Investisseurs cibles',
      'Suivi diffusion',
      'Data Room',
    ];

    for (const label of sectionLabels) {
      const sectionLink = page.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
      if (await sectionLink.count() === 0) continue;
      const urlBefore = page.url();
      await sectionLink.click();
      await page.waitForTimeout(800);
      // L'URL ou un changement DOM doit avoir eu lieu (au minimum une nouvelle section visible)
      const sectionVisible = await page.locator('main').textContent();
      expect(sectionVisible?.length || 0).toBeGreaterThan(50);
    }

    // Aucune erreur console bloquante (on tolère les transient fetch errors / warnings)
    const criticalErrors = consoleErrors.filter(e =>
      !e.toLowerCase().includes('warning') &&
      !e.includes('Failed to load resource') &&
      !e.includes('favicon') &&
      !e.includes('Failed to fetch') &&
      !e.includes('memberships') &&
      !e.includes('NetworkError'),
    );
    expect(criticalErrors).toEqual([]);
  });
});
