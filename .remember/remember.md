# Handoff

## State
- Branch `main`: Phase 1 multi-tenant + UX refactor merged and pushed to prod. 19 SQL migrations applied, 13 Edge Functions deployed. Supabase types regenerated (`src/integrations/supabase/types.ts`).
- Lovable currently has infrastructure issues (build failures + Supabase auth). Status: https://status.lovable.com/
- Fixed `has_role()` in prod (missing `SET search_path = 'public'`), set `APP_URL=https://esono.tech` secret.
- Backup branch: `main-backup-before-phase1` on GitHub.

## Next
1. **UX Round 2 — 5 changes** (user approved, ready to code):
   - `PlanFinancierViewer.tsx`: move Avis section to end of synthesis
   - `BusinessPlanPreview.tsx`: make TOC interactive/clickable (like investment memo)
   - All viewers (6-7 files): remove individual scores per deliverable, keep only IR score at top
   - `EntrepreneurDashboard.tsx`: add 3 action buttons under tabs (Uploader→upload tab, Diagnostic, Générer tout) + remove green generate button at bottom
   - All viewers: uniform CTA buttons (aligned, violet borders matching sidebar color, like valorisation/one-pager style)
2. **Wait for Lovable to stabilize** then verify invitation flow works end-to-end

## Context
- User domain is `esono.tech` (NOT app.esono.io). APP_URL secret set in prod.
- Supabase types.ts must be regenerated after schema changes or Lovable builds fail silently.
- User is frustrated by debugging loops — go straight to root cause, test thoroughly before pushing.
