// Brief 0.14 — Config Playwright pour validation E2E post-refonte SSOT.
// Tests basés sur le P8 Audit du Process Product Builder ESONO.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // séquentiel pour éviter conflits de session prod
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.ESONO_BASE_URL || "https://esono.tech",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Brussels",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  timeout: 60_000,
  expect: { timeout: 10_000 },
});
