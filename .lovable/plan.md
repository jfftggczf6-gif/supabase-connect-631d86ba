

## Plan : Passer la limite de contexte des agents reconstruct et inputs à 260 000 caractères

### Problème

Les agents `reconstruct-from-traces` et `generate-inputs` tronquent le contenu documentaire à 80 000 et 100 000 caractères respectivement, alors que le dossier GOTCHE-SARL contient 257 000 caractères (incluant les états financiers 2024). Les données 2024 sont donc perdues par troncation.

### Solution

Augmenter la limite `maxChars` dans les deux edge functions pour accepter la totalité du contenu documentaire.

### Changements

**Fichier 1 : `supabase/functions/reconstruct-from-traces/index.ts`**
- Ligne 109 : changer `getDocumentContentForAgent(ent, "reconstruct", 80_000)` → `getDocumentContentForAgent(ent, "reconstruct", 260_000)`

**Fichier 2 : `supabase/functions/generate-inputs/index.ts`**  
- Ligne 326 : changer `getDocumentContentForAgent(ent, "inputs", 100_000)` → `getDocumentContentForAgent(ent, "inputs", 260_000)`

### Note technique

Claude Sonnet supporte 200k tokens (~800k caractères). 260k caractères représentent environ 65k tokens, ce qui laisse largement de la place pour le system prompt, le output schema et la réponse. Pas de risque de dépassement de contexte.

| Fichier | Modification |
|---|---|
| `reconstruct-from-traces/index.ts` | `maxChars` 80k → 260k |
| `generate-inputs/index.ts` | `maxChars` 100k → 260k |

