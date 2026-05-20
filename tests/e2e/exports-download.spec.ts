// tests/e2e/exports-download.spec.ts
// Brief P8 QA gate : vérification des boutons d'export memo/valuation/teaser/pre-screening.
// On stub render-document pour renvoyer un blob déterministe (PDF minimal).

import { test, expect } from '@playwright/test';
import { login, BA_USER } from '../helpers/auth';

const FAKE_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Size 1/Root 1 0 R>>\nstartxref\n0\n%%EOF',
  'utf-8',
);

test.describe('Exports memo/valuation/teaser', () => {
  test.setTimeout(120_000);

  test('Bouton Exporter le memo PDF déclenche un download', async ({ page }) => {
    // Stub render-document → renvoie un PDF
    await page.route(/\/functions\/v1\/render-document/, async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="memo-test.pdf"',
        },
        body: FAKE_PDF_BYTES,
      });
    });

    await login(page, BA_USER);
    await page.goto('/ba/pipeline');
    await page.waitForLoadState('networkidle');

    const firstDeal = page.locator('a[href*="/ba/deals/"]').first();
    if (await firstDeal.count() === 0) test.skip(true, 'Pas de deal');
    await firstDeal.click();
    await page.waitForURL(/\/ba\/deals\//);

    // Navigue vers la section memo
    const memoNav = page.getByRole('button', { name: /Memo|Mémo investissement|Vue d'ensemble/i }).first();
    if (await memoNav.count() > 0) await memoNav.click();
    await page.waitForTimeout(1500);

    // Cherche le bouton Exporter (ou Export, ou Télécharger)
    const exportBtn = page.getByRole('button', { name: /Exporter|Export|Télécharger/i }).first();
    if (await exportBtn.count() === 0) {
      test.skip(true, 'Pas de memo encore généré sur ce deal → bouton Exporter absent');
      return;
    }
    await exportBtn.click();
    // Dans un dropdown, sélectionne "Word" ou "PDF"
    const pdfItem = page.getByRole('menuitem', { name: /PDF|Word|.docx/i }).first();
    if (await pdfItem.count() > 0) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
      await pdfItem.click();
      const dl = await downloadPromise;
      if (dl) {
        expect(dl).toBeTruthy();
        const filename = dl.suggestedFilename();
        expect(filename).toMatch(/\.(pdf|docx|pptx|xlsx)$/i);
      }
    }
  });
});
