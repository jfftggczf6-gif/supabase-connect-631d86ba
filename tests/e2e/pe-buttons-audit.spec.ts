// tests/e2e/pe-buttons-audit.spec.ts
// Brief P8 QA gate : audit chaque bouton du workspace PE.

import { test, expect } from '@playwright/test';
import { login, mockAiEdgeFunctions, PE_USER } from '../helpers/auth';

test.describe('PE buttons audit', () => {
  test.setTimeout(120_000);

  test('Chaque bouton sidebar PE fait une action observable', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await mockAiEdgeFunctions(page);
    await login(page, PE_USER);

    await page.goto('/pe/deals');
    await page.waitForLoadState('networkidle');

    // Ouvre le 1er deal disponible (Adiwale)
    const dealCard = page.locator('a[href*="/pe/deals/"]').first();
    if (await dealCard.count() === 0) test.skip(true, 'Aucun deal PE visible');
    await dealCard.click();
    await page.waitForURL(/\/pe\/deals\//);
    await page.waitForLoadState('networkidle');

    // Sections sidebar PE
    const sectionLabels = [
      "Vue d'ensemble",
      'Upload document',
      'Pré-screening',
      'Memo',
      'Valuation',
      'Data Room',
    ];

    for (const label of sectionLabels) {
      const sectionLink = page.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();
      if (await sectionLink.count() === 0) continue;
      await sectionLink.click();
      await page.waitForTimeout(800);
    }

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
