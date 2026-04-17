# Handoff

## State
- Branch `phase-1-multitenancy`: 8 commits, ALL 6 prompts implemented. 16 SQL migrations + React context/hooks/pages + 4 Edge Functions. All tested locally via `npx supabase db reset`. Build passes.
- Branch `feature/ux-refactor`: 18 UX commits, NOT merged.
- Branch `main`: 41 financial fixes, deployed to prod.
- NOTHING pushed to prod yet. All work is local.
- Docker + Supabase local running.

## Next
1. **Push migrations to prod Supabase** via `npx supabase db push` (apply 16 migrations to production)
2. **Deploy Edge Functions** (create-organization, send-invitation, accept-invitation, get-invitation-details)
3. **Test on prod**: create a 2nd org, invite a user, verify isolation
4. **Merge feature/ux-refactor into main** (the UX changes)
5. **Merge phase-1-multitenancy into main**
6. **Deploy frontend** to Lovable/Vercel

## Context
- Supabase local container: `supabase_db_vfmzgsiwynsawwemsawj`, ports 54321/54322
- 16 migrations: 20260417100001 through 20260417100016
- Tables not in local migrations (exist only in prod): programmes, candidatures, ai_cost_log, funding_programs, funding_matches, programme_kpis, programme_kpi_history — migrations handle gracefully with IF EXISTS
- Migration 4 (ALTER TYPE ADD VALUE) cannot run in transaction
- `is_coach_of_enterprise()` has fallback to old `enterprises.coach_id` for UI compat
- `send-email` Edge Function (v18 prod) used by invitation system
- Login: admin@esono.app / EsonoAdmin2026!
