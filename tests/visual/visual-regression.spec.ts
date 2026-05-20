// tests/visual/visual-regression.spec.ts
// Brief P8 QA gate : screenshots de référence + diff pixel par pixel (1% max).
// Premier run : crée les snapshots. Suivants : compare.

import { test, expect } from '@playwright/test';
import { login, mockAiEdgeFunctions, BA_USER, PE_USER } from '../helpers/auth';

test.describe('Visual regression — BA', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await mockAiEdgeFunctions(page);
    await login(page, BA_USER);
  });

  test('ba-sidebar-complete', async ({ page }) => {
    await page.goto('/ba/pipeline');
    await page.waitForLoadState('networkidle');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal BA');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const sidebar = page.locator('nav').first();
    await expect(sidebar).toHaveScreenshot('ba-sidebar-complete.png');
  });

  test('ba-vue-360', async ({ page }) => {
    await page.goto('/ba/pipeline');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    const overview = page.getByRole('button', { name: /Vue d'ensemble/i }).first();
    if (await overview.count() > 0) await overview.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('ba-vue-360.png');
  });

  test('ba-upload-documents', async ({ page }) => {
    await page.goto('/ba/pipeline');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    const upload = page.getByRole('button', { name: /Upload document/i }).first();
    if (await upload.count() > 0) await upload.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('ba-upload-documents.png');
  });

  test('ba-prescreening-empty', async ({ page }) => {
    await page.goto('/ba/pipeline');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    const ps = page.getByRole('button', { name: /Pré-screening/i }).first();
    if (await ps.count() > 0) await ps.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('ba-prescreening.png');
  });

  test('ba-valuation', async ({ page }) => {
    await page.goto('/ba/pipeline');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    const val = page.getByRole('button', { name: /Valorisation/i }).first();
    if (await val.count() > 0) await val.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('ba-valuation.png');
  });

  test('ba-teaser', async ({ page }) => {
    await page.goto('/ba/pipeline');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    const tz = page.getByRole('button', { name: /Teaser/i }).first();
    if (await tz.count() > 0) await tz.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('ba-teaser.png');
  });

  test('ba-investisseurs-cibles', async ({ page }) => {
    await page.goto('/ba/pipeline');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    const inv = page.getByRole('button', { name: /Investisseurs cibles/i }).first();
    if (await inv.count() > 0) await inv.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('ba-investisseurs-cibles.png');
  });

  test('ba-suivi-diffusion', async ({ page }) => {
    await page.goto('/ba/pipeline');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    const sd = page.getByRole('button', { name: /Suivi diffusion/i }).first();
    if (await sd.count() > 0) await sd.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('ba-suivi-diffusion.png');
  });
});

test.describe('Visual regression — PE', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await mockAiEdgeFunctions(page);
    await login(page, PE_USER);
  });

  test('pe-sidebar', async ({ page }) => {
    await page.goto('/pe/deals');
    await page.waitForLoadState('networkidle');
    const dealCard = page.locator('a[href*="/pe/deals/"]').first();
    if (await dealCard.count() === 0) test.skip(true, 'Pas de deal PE');
    await dealCard.click();
    await page.waitForURL(/\/pe\/deals\//);
    await page.waitForTimeout(1500);
    const sidebar = page.locator('nav').first();
    await expect(sidebar).toHaveScreenshot('pe-sidebar.png');
  });

  test('pe-deal-overview', async ({ page }) => {
    await page.goto('/pe/deals');
    const dealCard = page.locator('a[href*="/pe/deals/"]').first();
    if (await dealCard.count() === 0) test.skip(true, 'Pas de deal PE');
    await dealCard.click();
    await page.waitForURL(/\/pe\/deals\//);
    await page.waitForTimeout(1500);
    await expect(page.locator('main')).toHaveScreenshot('pe-deal-overview.png');
  });

  test('pe-dd-checklist', async ({ page }) => {
    await page.goto('/pe');
    await page.waitForLoadState('networkidle');
    // Onglet Paramètres → Documents DD
    const paramsTab = page.getByRole('tab', { name: /Paramètres/i }).first();
    if (await paramsTab.count() > 0) {
      await paramsTab.click();
      await page.waitForTimeout(1000);
      const ddTab = page.getByRole('tab', { name: /Documents DD/i }).first();
      if (await ddTab.count() > 0) {
        await ddTab.click();
        await page.waitForTimeout(1500);
        await expect(page.locator('main')).toHaveScreenshot('pe-dd-checklist.png');
        return;
      }
    }
    test.skip(true, 'Tab Documents DD inaccessible');
  });
});
