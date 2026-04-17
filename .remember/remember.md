# Handoff

## State
- Branch `phase-1-multitenancy` from main. 4 commits:
  - Phase 1A: 8 SQL migrations (tables, columns, data migration) — tested locally ✅
  - Phase 1B: 6 SQL migrations (security helpers, RLS rewrite) — tested locally ✅
  - Prompt 2: OrganizationContext, useCurrentRole, RequireSuperAdmin, RPCs — build OK ✅
  - Fix: robust migrations for local dev (skip missing tables)
- Supabase local running on Docker (port 54321/54322). 89 policies on 27 tables. All migrations pass via `npx supabase db reset`.
- Branch `feature/ux-refactor` has 18 UX commits NOT merged.
- Branch `main` has 41 financial fixes deployed to prod.
- Nothing pushed to prod yet.

## Next
1. **Prompt 3**: OrganizationSwitcher component in header (10-15 min)
2. **Prompt 4**: CreateOrganizationWizard page + Edge Function create-organization (30 min)
3. **Prompt 5**: Invitation system — send-invitation, accept-invitation, MembersPage, InvitationAcceptPage (40 min)
4. **Prompt 6**: MeteringDashboard for super_admin (25 min)
5. After all prompts: test full flow locally, then push migrations to prod Supabase, then merge into main

## Context
- Docker running. Supabase local container: `supabase_db_vfmzgsiwynsawwemsawj`
- Auth context: useAuth() in src/hooks/useAuth.tsx. Org context: useOrganization() in src/contexts/OrganizationContext.tsx
- `super_admin` is the platform admin role (not "platform_admin")
- `is_coach_of_enterprise()` has fallback to old `enterprises.coach_id` for UI compat
- Tables `programmes`, `candidatures`, `ai_cost_log`, `funding_programs` exist in prod but NOT in local migrations — migration scripts handle this gracefully with IF EXISTS checks
- Dev server on port 8080. Playwright MCP crashes often — use code verification instead.
- `send-email` Edge Function v18 exists in prod — reuse for invitations (Prompt 5)
- Migration fix: `20260317131439` needed `DROP TRIGGER IF EXISTS` added
