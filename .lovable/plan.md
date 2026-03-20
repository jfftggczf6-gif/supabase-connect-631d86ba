

## Plan : Augmenter le timeout du Pre-screening

### Constat

- `ReconstructionUploader.tsx` : déjà à **180s** ✅
- `pipeline-runner.ts` : **120s** (timeout par défaut) — trop court avec 260k caractères de contexte

### Changement

**Fichier : `src/lib/pipeline-runner.ts`**

Ajouter `generate-pre-screening` dans le set `longSteps` (180s) à la ligne ~155, aux côtés de `generate-business-plan` et `generate-pitch-deck`.

```typescript
// Avant
const longSteps = new Set(['generate-business-plan', 'generate-pitch-deck']);

// Après
const longSteps = new Set(['generate-business-plan', 'generate-pitch-deck', 'generate-pre-screening']);
```

Cela passe le timeout de 120s → **180s** dans le pipeline "Générer tout", aligné avec le timeout déjà utilisé dans le `ReconstructionUploader`.

| Fichier | Modification |
|---|---|
| `pipeline-runner.ts` | Ajouter `generate-pre-screening` au set `longSteps` (180s) |

