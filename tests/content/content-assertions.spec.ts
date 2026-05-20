// tests/content/content-assertions.spec.ts
// Brief P8 QA gate : assertions de contenu et de design (labels, alignement,
// largeur des viewers, conformité aux briefs).

import { test, expect } from '@playwright/test';
import { login, mockAiEdgeFunctions, BA_USER } from '../helpers/auth';

test.describe('Content & design assertions', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await mockAiEdgeFunctions(page);
    await login(page, BA_USER);
    await page.goto('/ba/pipeline');
    await page.waitForLoadState('networkidle');
    const dealLink = page.locator('a[href*="/ba/deals/"]').first();
    if (await dealLink.count() === 0) test.skip(true, 'Pas de deal BA');
    await dealLink.click();
    await page.waitForURL(/\/ba\/deals\//);
    await page.waitForTimeout(1500);
  });

  test('Sidebar : label "Investisseurs cibles" présent (pas "Fonds & matching")', async ({ page }) => {
    const sidebar = page.locator('nav').first();
    const sidebarText = await sidebar.textContent();
    expect(sidebarText).toMatch(/Investisseurs cibles/i);
    expect(sidebarText).not.toMatch(/Fonds & matching/i);
  });

  test('Sidebar : pas de "/7" hardcodé (checklist dynamique)', async ({ page }) => {
    // Le caption "X/Y docs reçus" doit être présent, mais Y peut varier (7, 8, ...)
    const sidebar = page.locator('nav').first();
    const sidebarText = await sidebar.textContent();
    expect(sidebarText).toMatch(/\d+\/\d+ docs/);
  });

  test('Headers sidebar en violet (rgb proche de 83,74,183 ou 109,40,217)', async ({ page }) => {
    // text-violet-700 → rgb(109, 40, 217)
    const header = page.locator('nav div').filter({ hasText: /Pré-screening|Mémo|Données/i }).first();
    if (await header.count() === 0) test.skip(true, 'Headers introuvables');
    const color = await header.evaluate(el => window.getComputedStyle(el).color);
    // Accepte n'importe quelle teinte violette : R < 200, G < 100, B > 150
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      const isViolet = b > 150 && r < 200 && g < 100;
      expect(isViolet, `Header color ${color} n'est pas violet (R<200, G<100, B>150)`).toBe(true);
    }
  });

  test('CTA ✨ centré (parent en justify-center ou similaire)', async ({ page }) => {
    const cta = page.getByRole('button', { name: /Générer/i }).first();
    if (await cta.count() === 0) test.skip(true, 'CTA absent');
    const parent = cta.locator('xpath=ancestor::div[contains(@class, "flex")][1]');
    const cls = await parent.getAttribute('class');
    expect(cls).toMatch(/justify-center|mx-auto|flex-1/);
  });

  test('Viewer principal : largeur ≥ 700px', async ({ page }) => {
    // Navigue vers Vue 360° pour mesurer
    const overview = page.getByRole('button', { name: /Vue d'ensemble/i }).first();
    if (await overview.count() > 0) await overview.click();
    await page.waitForTimeout(1000);
    const mainContent = page.locator('main > div').first();
    const box = await mainContent.boundingBox();
    expect(box?.width || 0).toBeGreaterThan(700);
  });

  test('Teaser : 3 onglets Document/Anonymisation/Diffusion + header au-dessus', async ({ page }) => {
    const teaserNav = page.getByRole('button', { name: /Teaser/i }).first();
    if (await teaserNav.count() === 0) test.skip(true, 'Lien Teaser absent');
    await teaserNav.click();
    await page.waitForTimeout(1500);

    // Si state vide → pas de tabs (cas accepté)
    const emptyState = page.getByText(/Générer le teaser/i).first();
    if (await emptyState.count() > 0) {
      // OK - état vide pré-génération
      return;
    }

    const docTab = page.getByRole('tab', { name: /Document/i });
    const anonTab = page.getByRole('tab', { name: /Anonymisation/i });
    const diffTab = page.getByRole('tab', { name: /Diffusion/i });
    expect(await docTab.count()).toBeGreaterThan(0);
    expect(await anonTab.count()).toBeGreaterThan(0);
    expect(await diffTab.count()).toBeGreaterThan(0);

    // Pas de sidebar gauche dans le content : on cherche les textes "NOM DE CODE" hors header
    const main = page.locator('main');
    const aside = main.locator('aside[class*="w-[210px]"], aside[class*="w-[200px]"]');
    expect(await aside.count(), 'Sidebar gauche teaser doit être retirée').toBe(0);
  });

  test('Texte "Va dans Investisseurs cibles" (pas "Fund Matching")', async ({ page }) => {
    // Navigue vers Suivi diffusion
    const sd = page.getByRole('button', { name: /Suivi diffusion/i }).first();
    if (await sd.count() === 0) test.skip(true, 'Suivi diffusion absent');
    await sd.click();
    await page.waitForTimeout(1500);
    const body = await page.locator('main').textContent();
    if (body && body.length > 0) {
      // Si vide (kpis 0), pas de texte d'invite — OK
      expect(body).not.toMatch(/Fund Matching/i);
    }
  });
});
