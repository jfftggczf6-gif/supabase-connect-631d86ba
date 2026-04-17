# Handoff

## State
- Branch `phase-1-multitenancy`: 14 commits. ALL Phase 1 implemented + completeness fixes. 16 SQL migrations + 4 Edge Functions + full frontend. Tested locally via Docker Supabase. Build passes. NOT pushed to prod.
- Branch `feature/ux-refactor`: 18 UX commits. NOT merged.
- Branch `main`: 41 financial fixes. Deployed to prod.
- Docker + Supabase local running (port 54321/54322). Edge Functions served via `npx supabase functions serve`.
- `.env.local` points to local Supabase. Delete it before pushing to prod.
- Test user created locally: admin@esono.app / EsonoAdmin2026! (super_admin + owner of ESONO Legacy org).
- 3 test orgs in local DB: ESONO Legacy, enabel, marcel. 1 accepted invitation (philippeyace@hotmail.fr → marcel owner).

## Next
1. **Continue testing locally** — verify full workflow with Playwright or manually
2. **Push to prod**: delete .env.local, `npx supabase db push`, deploy 4 new Edge Functions, push frontend
3. **Merge feature/ux-refactor** into main (18 UX commits)
4. **Merge phase-1-multitenancy** into main (14 multi-tenant commits)
5. **Phase 2**: Branding (logo/colors per org, branded exports, brand kit form)

## Context
- Supabase local container: `supabase_db_vfmzgsiwynsawwemsawj`
- Playwright MCP browser dies between sessions. Workaround: install playwright as dev dep + run node scripts directly, or restart Claude Code entirely.
- `send-email` EF needs RESEND_API_KEY secret (not available locally — emails don't send in local dev)
- `is_coach_of_enterprise()` has fallback to old `enterprises.coach_id` for UI compat
- organization_invitations role check now includes 'owner' (was missing, fixed)
- verifyAndGetContext now returns organization_id explicitly + passes to ai_cost_log/activity_log inserts
- Register page hides role toggle + country for invitation flow, button says "Créer mon compte"
- Login page supports ?redirect= param for invitation flow
- DashboardLayout has "Membres" link in org dropdown for owner/admin/manager
- Tables not in local migrations: programmes, candidatures, ai_cost_log, funding_programs — scripts handle with IF EXISTS
