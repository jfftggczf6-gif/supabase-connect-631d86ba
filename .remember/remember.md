# Handoff

## State
Long session: RAG Phase 2 (14/14 KB ingérées, Voyage `voyage-3` 1024-dim), landing V2 9 sections + Cal.com CTA, valuation engine fixes, coaching reports refactor (Suivi snapshot + Final via EFs `generate-coaching-followup` & `generate-coach-report`, Word/HTML/Modifier export), invitation race-fix (`window.location.href` reload dans `src/pages/InvitationAcceptPage.tsx`), org cascade delete + country dropdown, rôles centralisés `src/lib/roles.ts` (programme = no analyst, pe = no coach, mixed = all) + RLS profiles co-members, `CreateCohorteDialog.tsx` affiche toutes les entreprises + form inline "+ Nouvelle entreprise". Theme actuellement violet-800 (#5B21B6) partout.

## Next
1. **Bulk shift violet-800 → brighter (vraisemblablement violet-500 #8B5CF6 ou violet-600 #7C3AED — confirmer le shade exact avant exécution)** : `src/index.css` (--primary HSL 263 67% 42% → ~262 83% 58–67%, --ring, --info), `src/pages/Index.tsx` (#5B21B6 → nouveau), `src/components/dashboard/DashboardSidebar.tsx` phaseColorMap, sed `text-violet-800`/`bg-violet-800` dans `src/components/{dashboard,programmes}`.
2. Backlog : footer "sources consultées" dans viewers RAG ; uploader vrais PDFs pour 23 entrées KB stub.

## Context
- Lovable auto-deploy `main` → esono.tech ; build delays peuvent faire croire qu'un changement n'est pas parti.
- Backgrounds = blanc pur (`--background 0 0% 100%`, `--muted 220 15% 96%`) — user a flagué tint lavande.
- Pas d'em-dash dans attributions de citations dans rapports (user-flagged).
- Word export = namespaces Office + MIME `application/msword`, pas de Railway.
- Landing contact : philyace@gmail.com + WhatsApp +33 6 15 51 09 76 ; demo `https://cal.com/phil-yace-d73gey/demo-esono`.
- User n'utilise PAS OpenAI ; `VOYAGE_API_KEY` dans Supabase secrets.
- Deferred tools (TaskCreate, Supabase MCP, Playwright MCP…) nécessitent `ToolSearch` avant appel.
- Transcript pré-compaction : `/Users/yacephilippe-emmanuel/.claude/projects/-Users-yacephilippe-emmanuel/a01b17f4-570d-4552-8a6d-2a6276975a8a.jsonl`.
