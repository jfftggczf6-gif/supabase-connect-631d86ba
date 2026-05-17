// tests/e2e/public-candidature-form.spec.ts
// E2E : formulaire public BA accessible sans auth via /candidature/{slug}.
// On mock get-programme-form via page.route() pour rester indépendant du back.
// Vérifie : titre + description + 11 champs custom + bouton Soumettre rendus.

import { test, expect } from '@playwright/test';
import { baProgramme } from '../fixtures/ba-data';

const SUPABASE_BASE = 'https://flgxbwmxwdfzeuufcxti.supabase.co';

test.describe('Formulaire public candidature BA', () => {
  test.beforeEach(async ({ page }) => {
    // Mock l'EF get-programme-form pour qu'elle retourne notre programme fixture.
    // Évite la dépendance au vrai back staging pendant le test.
    await page.route(`${SUPABASE_BASE}/functions/v1/get-programme-form`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          programme: {
            name: baProgramme.name,
            description: baProgramme.description,
            organization: 'Cissé Advisory',
            logo_url: null,
            country_filter: [],
            sector_filter: [],
            end_date: baProgramme.end_date,
            form_fields: baProgramme.form_fields,
            nb_places: null,
            candidatures_count: 0,
          },
        }),
      });
    });
  });

  test('affiche le titre, description et les 11 champs personnalisés', async ({ page }) => {
    await page.goto(`/candidature/${baProgramme.form_slug}`);

    // 1. Titre du programme
    await expect(
      page.getByRole('heading', { name: /Appel à candidatures BA/i }),
    ).toBeVisible();

    // 2. Description
    await expect(
      page.getByText(/PME africaine en croissance/i),
    ).toBeVisible();

    // 3. Les 11 champs custom du DEFAULT_FORM_FIELDS sont rendus.
    // On vérifie les labels uniques pour ne pas confondre avec les 5 champs
    // standard de PublicCandidatureForm (Nom de l'entreprise, contact, etc.).
    const customLabels = [
      'Raison sociale',
      "Pays d'opération",
      "Secteur d'activité",
      "Description de l'activité",
      'Année de création',
      "Chiffre d'affaires 2025 (USD)",
      'Ticket recherché (M USD)',
      'Référent / Contact',
      'Email de contact',
      'Documents (pitch deck, liasse, business plan)',
    ];
    for (const label of customLabels) {
      await expect(page.getByText(label).first()).toBeVisible();
    }

    // 4. Bouton "Soumettre ma candidature" présent
    await expect(
      page.getByRole('button', { name: /Soumettre ma candidature/i }),
    ).toBeVisible();
  });

  test('affiche "clôturées" quand le programme est fermé', async ({ page }) => {
    // Override le mock pour cette test seul
    await page.unroute(`${SUPABASE_BASE}/functions/v1/get-programme-form`);
    await page.route(`${SUPABASE_BASE}/functions/v1/get-programme-form`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          closed: true,
          name: baProgramme.name,
          organization: 'Cissé Advisory',
          reason: 'Candidatures en pause',
        }),
      });
    });

    await page.goto(`/candidature/${baProgramme.form_slug}`);

    await expect(page.getByText(/Candidatures en pause|clôturées/i)).toBeVisible();
  });
});
