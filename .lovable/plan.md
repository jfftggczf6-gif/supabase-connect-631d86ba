

## Fix : Augmenter le timeout Claude à 150s

### Problème
Le `AbortSignal.timeout(90000)` (90s) est trop court pour Claude avec ce volume de données (4 produits, 2 services, inputs, framework, SIC, diagnostic, prev_plan). L'attempt 1 a timeout, l'attempt 2 va probablement aussi timeout, et l'attempt 3 aussi → la génération échoue systématiquement.

### Correction

**Fichier** : `supabase/functions/generate-ovo-plan/index.ts`

Augmenter le timeout de 90s à **150s** (2min30). Les Edge Functions Deno ont un wall-time max de ~400s, donc 150s × 3 attempts = 450s dépasse, mais en pratique l'attempt 2 ou 3 devrait passer.

Aussi réduire le nombre de retries de 3 à 2 pour rester dans le wall-time :
- Attempt 1 : 150s max
- Attempt 2 : 150s max
- Total max : ~5min, dans la limite

### Changement unique
- `AbortSignal.timeout(90000)` → `AbortSignal.timeout(150000)`
- Retry loop : `maxAttempts = 3` → `maxAttempts = 2`

