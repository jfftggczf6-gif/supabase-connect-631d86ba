

# Fix pre-screening timeout — paralléliser sans réduire le contexte

## Problème
L'Edge Function fait ~7 requêtes DB séquentielles avant l'appel AI. Chaque requête prend 50-200ms, ce qui cumule 500ms-1.5s de latence inutile avant même de commencer la génération. Combiné avec un appel AI long (30-60s pour 250k chars), on dépasse le timeout de 60s de l'Edge Function.

## Solution
Paralléliser toutes les requêtes DB indépendantes avec `Promise.all`. Le contexte documentaire de 250 000 caractères reste intact.

## Changements — `supabase/functions/generate-pre-screening/index.ts`

### 1. Paralléliser le premier bloc de fetches (lignes 269-284)
Regrouper `inputsDeliv`, `ragContext`, et `programmeCriteria` (si ID fourni) dans un seul `Promise.all` :

```typescript
const [inputsRes, ragContext, pcRecord] = await Promise.all([
  ctx.supabase.from("deliverables").select("data, score")
    .eq("enterprise_id", ctx.enterprise_id).eq("type", "inputs_data").maybeSingle(),
  buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "pre_screening"),
  programmeCriteriaId && !programmeCriteria
    ? ctx.supabase.from("programme_criteria").select("*").eq("id", programmeCriteriaId).maybeSingle()
    : Promise.resolve({ data: null }),
]);
```

### 2. Paralléliser le second bloc (lignes 370-388)
Regrouper `kbContext`, `riskFactors`, et `coachingContext` :

```typescript
const [kbContext, riskRes, coachingContext] = await Promise.all([
  getKnowledgeForAgent(ctx.supabase, ent.country || "", ent.sector || "", "pre_screening"),
  ctx.supabase.from('knowledge_risk_factors').select('*').eq('is_active', true),
  getCoachingContext(ctx.supabase, ctx.enterprise_id),
]);
```

### 3. Aucun changement sur le contexte documentaire
La ligne `getDocumentContentForAgent(ent, "pre_screening", 250_000)` reste intacte.

## Gain estimé
~500ms-1s économisés sur les requêtes DB, ce qui laisse plus de marge pour l'appel AI dans la fenêtre de timeout.

