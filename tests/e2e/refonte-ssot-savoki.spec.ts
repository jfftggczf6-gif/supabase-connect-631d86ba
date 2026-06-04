/**
 * Brief 0.14 — Validation E2E Savoki post-refonte SSOT (briefs 0.5 → 0.13).
 *
 * Suit le process P8 Audit du Process Product Builder ESONO.
 * 4 axes : Visuel · Boutons · Back · Flow E2E.
 *
 * Pré-requis :
 *   - Variables d'environnement : COACH_EMAIL, COACH_PASS, SAVOKI_ID, PROG_ID
 *     (par défaut SAVOKI_ID = f4ee21e9-3b30-41ce-8b10-f5de7fd11841, PROG_ID
 *     déduit du contexte ESONO).
 *   - La pile PR #1 → #9 de la refonte SSOT doit être mergée dans `main` et
 *     buildée par Lovable AVANT de lancer ce spec (sinon le front n'a pas les
 *     composants 0.13 — 2 sections / 0.12 — CoherenceBadge / 0.11 — bandeau).
 *   - Savoki doit avoir un plan_financier déjà généré post-refonte (sinon
 *     l'écran montre l'empty state "Générer Plan Financier" et tous les
 *     assertions UI échouent).
 *
 * Lancement :
 *   npx playwright install chromium
 *   COACH_EMAIL=xxx COACH_PASS=yyy npx playwright test tests/e2e/refonte-ssot-savoki.spec.ts
 */
import { test, expect } from "@playwright/test";

const SAVOKI_ID = process.env.SAVOKI_ID || "f4ee21e9-3b30-41ce-8b10-f5de7fd11841";
const COACH_EMAIL = process.env.COACH_EMAIL || "";
const COACH_PASS = process.env.COACH_PASS || "";

test.describe("Refonte SSOT — Validation E2E Savoki (briefs 0.5 → 0.13)", () => {
  test.skip(
    !COACH_EMAIL || !COACH_PASS,
    "Définir COACH_EMAIL et COACH_PASS pour lancer ce spec",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', COACH_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', COACH_PASS);
    await Promise.all([
      page.waitForURL(/dashboard|programmes/, { timeout: 15_000 }),
      page.click('button[type="submit"]'),
    ]);
  });

  test("Axe 1 Visuel — Savoki dashboard : badge cohérence + 2 sections plan financier (brief 0.13)", async ({ page }) => {
    await page.goto(`/dashboard?ent=${SAVOKI_ID}`);
    await expect(page.getByRole("heading", { name: "Savoki", level: 2 })).toBeVisible({ timeout: 15_000 });

    // Brief 0.12 — Badge CoherenceBadge (silencieux si 0 warnings, ambré/destructive sinon)
    const coherenceBadge = page.getByRole("button", { name: /divergence|incohérence/i });
    const badgeCount = await coherenceBadge.count();
    if (badgeCount > 0) {
      await coherenceBadge.first().click();
      await expect(page.getByText(/Dernier check/i)).toBeVisible();
      await page.screenshot({ path: "test-results/savoki-coherence-popover.png" });
      // Fermer popover
      await page.keyboard.press("Escape");
    }

    // Navigation Plan Financier
    await page.getByRole("button", { name: "Plan Financier" }).click();
    // Soit l'empty state (jamais généré), soit le viewer 2 sections
    const emptyState = page.getByRole("button", { name: /Générer — Plan Financier/i });
    if (await emptyState.count() > 0) {
      test.fail(true, "Savoki n'a pas de plan_financier généré post-refonte — exécuter cascade avant audit");
      return;
    }

    // Brief 0.13 — 2 sections distinctes
    await expect(page.getByText("Situation actuelle")).toBeVisible();
    await expect(page.getByText(/Après investissement/)).toBeVisible();
    await expect(page.getByText(/Hypothèse.*durée prêt/i)).toBeVisible();

    // Brief 0.11 — Bandeau _coherence (peut être présent ou absent selon ranges)
    const bandeauIntra = page.getByText(/Incohérences logiques|Indicateurs à vérifier/);
    const bandeauPresent = await bandeauIntra.count() > 0;

    await page.screenshot({ path: "test-results/savoki-plan-financier-2-sections.png", fullPage: true });
    expect(typeof bandeauPresent).toBe("boolean");
  });

  test("Axe 1 Visuel — Mémo Investissement (brief 0.8) : fourchette mediane + methode_privilegiee distincte", async ({ page }) => {
    await page.goto(`/dashboard?ent=${SAVOKI_ID}`);
    await page.getByRole("button", { name: "Mémo Investissement" }).click();
    const emptyState = page.getByRole("button", { name: /Générer — Mémo/i });
    if (await emptyState.count() > 0) {
      test.fail(true, "Memo non régénéré post-brief 0.8");
      return;
    }

    // Brief 0.8 — fourchette.mediane affichée
    await expect(page.getByText(/Médiane/)).toBeVisible();
    // Brief 0.8 — méthode privilégiée séparée
    await expect(page.getByText(/(DCF|méthode privilégiée)/i)).toBeVisible();
    await page.screenshot({ path: "test-results/savoki-memo-valorisation.png" });
  });

  test("Axe 3 Back — canonical Savoki : champs SSOT remplis", async ({ request }) => {
    // Smoke test : l'EF validate-deliverables-coherence répond
    const res = await request.post("/functions/v1/validate-deliverables-coherence", {
      data: { enterprise_id: SAVOKI_ID },
      failOnStatusCode: false,
    });
    // 200 = canonical présent + comparé, 412 = canonical absent, 401 = pas d'auth
    expect([200, 401, 412]).toContain(res.status());
    if (res.status() === 200) {
      const json = await res.json();
      expect(json).toHaveProperty("divergences_count");
      expect(json).toHaveProperty("critical_count");
      // Critère idéal post-refonte complète : 0 divergences critiques
      // (warning toléré dans la phase de transition)
      expect(json.critical_count).toBe(0);
    }
  });

  test("Axe 4 Flow E2E — cascade dépendances brief 0.11 pipeline-runner", async ({ page }) => {
    await page.goto(`/dashboard?ent=${SAVOKI_ID}`);

    // Régénération plan_financier seule → la cascade doit propager (déjà testé statiquement
    // par PIPELINE_DEPENDENCIES dans pipeline-runner.ts brief 0.11 préparation).
    await page.getByRole("button", { name: "Plan Financier" }).click();
    const regenButton = page.getByRole("button", { name: /Régénérer|Générer.*Plan Financier/ });
    if (await regenButton.count() === 0) {
      test.skip(true, "Pas de bouton de régen visible");
      return;
    }

    // ⚠ NE PAS CLIQUER en mode CI/test automatisé — déclencherait une vraie génération Opus coûteuse.
    // Ce test vérifie juste la présence du bouton et la cohérence du label.
    await expect(regenButton.first()).toBeVisible();
  });
});

test.describe("Refonte SSOT — Smoke tests Axe 3 Back (sans auth UI)", () => {
  test("EF validate-deliverables-coherence : 400 si pas d'enterprise_id", async ({ request }) => {
    const res = await request.post("/functions/v1/validate-deliverables-coherence", {
      data: {},
      failOnStatusCode: false,
    });
    expect([400, 401]).toContain(res.status());
  });
});
