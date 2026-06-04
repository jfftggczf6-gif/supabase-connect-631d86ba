# Tests E2E Playwright

Suit le process **P8 Audit** du Process Product Builder ESONO.

## Pré-requis

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Variables d'environnement :

- `ESONO_BASE_URL` (défaut `https://esono.tech`)
- `COACH_EMAIL`, `COACH_PASS` — credentials d'un coach autorisé sur Savoki
- `SAVOKI_ID` (défaut `f4ee21e9-3b30-41ce-8b10-f5de7fd11841`)

## Lancement

```bash
COACH_EMAIL=... COACH_PASS=... npx playwright test
```

Mode UI interactif :

```bash
COACH_EMAIL=... COACH_PASS=... npx playwright test --ui
```

## Specs

| Spec | Brief(s) couverts | Pré-requis |
|---|---|---|
| `refonte-ssot-savoki.spec.ts` | 0.5 → 0.13 | Front Lovable buildé avec PRs SSOT mergées + Savoki régénéré post-refonte |
