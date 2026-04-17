# Handoff

## State
- Branch `phase-1-multitenancy` created from main. 1 commit: 8 SQL migrations (Phase 1A fondations multi-tenant) written but NOT applied yet.
- Branch `feature/ux-refactor` has 18 commits (UX changes) NOT merged into main.
- Branch `main` has 41 financial fixes deployed to prod.
- Waiting for Docker Desktop install to test migrations locally before applying to prod.

## Next
1. User installs Docker Desktop → run `npx supabase start` → apply 8 migrations locally → test → then push to prod
2. After 1A validated: write and apply Prompt 1B (RLS + security fixes — the critical one)
3. Then Prompts 2-6 (React context, org switcher, wizard, invitations, metering)

## Context
- 8 migration files in supabase/migrations/20260417100001-08_*.sql
- PHASE_1A_CHECKLIST.md has validation queries and rollback procedures
- `update_updated_at_column()` function exists in prod (verified)
- No Docker installed yet — user is installing Docker Desktop
- Supabase project: gszwotgppuinpfnyrjnu. 26 enterprises, 50 profiles, 208 deliverables, 45 existing migrations.
- The enum ALTER TYPE ADD VALUE (migration 4) cannot run inside a transaction
- enterprises.coach_id kept for UI compat — enterprise_coaches table is the new N-to-N
- knowledge_* tables stay global (no organization_id)
