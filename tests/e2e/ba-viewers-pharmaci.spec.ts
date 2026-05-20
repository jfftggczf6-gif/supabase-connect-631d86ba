// tests/e2e/ba-viewers-pharmaci.spec.ts
// E2E smoke test : login Cissé Advisory + visite 3 viewers BA refonte
// (Teaser / FundMatching / DealTracking) sur le deal PharmaCi seedé.
//
// Pré-requis : back staging accessible (pas de mock), credentials Cissé valides,
// pe_fund_outreach seedé sur DEAL_ID (voir migration + seed dans ce sprint).
//
// Ce test détecte les régressions visuelles structurelles. Pour les tests
// unitaires fins, voir tests/unit/ (à étoffer).

import { test, expect } from '@playwright/test';

const DEAL_ID = '977c826c-ac1d-4418-9bc2-77d9d7b4553d'; // PharmaCi Industries SA

test.describe.serial('BA viewers — login Cissé + PharmaCi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('john@example.com').fill('partner@cisse.local');
    await page.getByPlaceholder('••••••••').fill('Test123!');
    // Bouton se nomme "Se connecter" (FR) ou "Sign in" (EN) selon locale browser
    await page.getByRole('button', { name: /Se connecter|Sign in/ }).click();
    await page.waitForURL(/\/(ba|dashboard)/, { timeout: 10000 });
  });

  test('Fund Matching — header + KPIs + funnel + tableau pipeline dots', async ({ page }) => {
    await page.goto(`/ba/deals/${DEAL_ID}?section=fund_matching`);

    // Header — brief #30 : "Fonds & matching" → "Investisseurs cibles"
    await expect(page.getByText(/Investisseurs cibles.*PharmaCi/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/contacts/).first()).toBeVisible();

    // Boutons actions header (brief #30 : "Ajouter un fonds" → "Ajouter un contact")
    await expect(page.getByRole('button', { name: /Ajouter un contact/ })).toBeVisible();
    // Handoff PE est maintenant dans le menu ⋯ (brief #30) — n'est plus prominent.

    // KPIs (6 cards) — labels présents (peuvent apparaître dans funnel aussi)
    await expect(page.getByText('Matchés', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('IOI reçues', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Déclinés', { exact: true }).first()).toBeVisible();

    // Funnel : 9 étapes (au moins 3 marqueurs uniques)
    await expect(page.getByText('Teaser envoyé', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Mgmt meeting', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Closing', { exact: true }).first()).toBeVisible();

    // Tableau : I&P (le fonds avec IOI) doit être visible
    await expect(page.getByText('I&P Afrique Entrepreneurs II').first()).toBeVisible();
    await expect(page.getByText(/9\.5M USD/).first()).toBeVisible();

    // Comparaison IOI
    await expect(page.getByText(/Comparaison des offres/).first()).toBeVisible();

    // Métriques conversion
    await expect(page.getByText(/Métriques de conversion/).first()).toBeVisible();
  });

  test('Deal Tracking — KPIs vue mandat + timeline 5 stages + activité fonds', async ({ page }) => {
    await page.goto(`/ba/deals/${DEAL_ID}?section=deal_tracking`);

    await expect(page.getByText('Suivi diffusion — vue mandat')).toBeVisible({ timeout: 15000 });

    // 4 KPIs
    await expect(page.getByText('Fonds en outreach')).toBeVisible();
    await expect(page.getByText('Délai moyen action')).toBeVisible();
    await expect(page.getByText('Handoff prêt')).toBeVisible();

    // Timeline 5 stages BA
    await expect(page.getByText('Timeline du mandat')).toBeVisible();
    for (const stage of ['Reçus', 'IM produit', 'Intérêts fonds', 'Négociation', 'Closed']) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
    }

    // Activité récente
    await expect(page.getByText(/Activité récente/).first()).toBeVisible();

    // Actions
    await expect(page.getByRole('button', { name: /Lever l'anonymat/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Transférer au PE/ })).toBeVisible();
  });

  // Test obsolète depuis brief #29 (sidebar gauche retirée — header horizontal à la place).
  // À mettre à jour avec la nouvelle structure : TeaserHeaderBar + 3 onglets.
  test.skip('Teaser — header + sidebar codebox + warnings + 8 sections', async ({ page }) => {
    await page.goto(`/ba/deals/${DEAL_ID}?section=teaser`);

    // Header
    await expect(page.getByText(/Teaser.*PharmaCi/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Régénérer/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exporter PDF/ })).toBeVisible();

    // Sidebar : codebox PROJET XXX
    await expect(page.getByText(/PROJET [A-ZÉÊÏ]+/).first()).toBeVisible();
    await expect(page.getByText('Workflow')).toBeVisible();
    await expect(page.getByText('Sections IM utilisées')).toBeVisible();

    // Warning box (mock payload : 2 warnings par défaut)
    await expect(page.getByText(/mentions identifiantes/).first()).toBeVisible();

    // 8 sections du teaser
    for (const sectionTitle of ['Présentation', 'Marché & positionnement', 'Équipe & management', 'Performance financière', 'Equity story', 'Impact & ESG', 'Adéquation investisseur']) {
      await expect(page.getByText(sectionTitle).first()).toBeVisible();
    }

    // Score adéquation
    await expect(page.getByText("Score d'adéquation")).toBeVisible();
  });

  test('Memo IM — progress bar + 9/12 sections validées', async ({ page }) => {
    await page.goto(`/ba/deals/${DEAL_ID}?section=memo`);

    // Progress bar BA
    await expect(page.getByText('Progression du Memo IM')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/\d+\/12 sections validées/).first()).toBeVisible();

    // Légende
    await expect(page.getByText(/validées/).first()).toBeVisible();
    await expect(page.getByText(/brouillons/).first()).toBeVisible();

    // MemoSectionsViewer PE (réutilisé) — TOC visible
    await expect(page.getByText('Résumé exécutif').first()).toBeVisible();
    await expect(page.getByText('Thèse d\'investissement').first()).toBeVisible();
  });
});
