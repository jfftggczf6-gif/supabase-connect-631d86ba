# Handoff

## State
Phase 2 RAG (Voyage AI, 1024-dim) **branché et opérationnel**. 14/14 KB éligibles ingérées avec embeddings (0 NULL). `helpers_v5.ts::getKnowledgeForAgent` utilise maintenant Voyage + `search_knowledge_chunks` RPC avec fallback legacy. 12 EFs de génération redéployées (pre-screening, BMC, SIC, business plan, valuation, diagnostic, ODD, onepager, memo, screening-report, inputs, framework, plan-financier, plan-ovo). Migration `fix_search_knowledge_chunks_search_path` appliquée (opérateur `<=>` de pgvector).

## Next
1. **Backlog** — Footer "sources consultées" dans les viewers (PreScreening, BMC, SIC, PlanFin, BP, ODD, Memo, OnePager). Reporté.
2. **Backlog** — Uploader les vrais PDFs pour les 23 entrées KB stub (<100 chars), puis re-ingérer.
3. Monitorer les logs `rag-voyage` et `rag-search` dans les prochaines générations pour détecter rate-limits Voyage.

## Context
- User n'utilise **PAS** OpenAI. `VOYAGE_API_KEY` dans Supabase secrets, modèle `voyage-3` (1024 dim).
- Voyage rate-limite les appels parallèles rapprochés → `rag-ingest` fait retry per-item et skip insert si embedding null.
- RPC `search_knowledge_chunks` nécessite `search_path = public, extensions` pour trouver l'opérateur `<=>`.
- User preferences: test avant deploy, push direct sur `main` quand approuvé, qualité > complétude, pas de force-push.
- Lovable auto-deploy depuis `main` → esono.tech.
- Deferred tools (TaskCreate, Supabase MCP, Playwright MCP…) nécessitent `ToolSearch` avant appel.
