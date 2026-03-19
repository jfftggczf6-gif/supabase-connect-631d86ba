

## Problème identifié

Le mémo d'investissement utilise **Claude Opus** en 2 passes, ce qui prend **200+ secondes** au total (Pass 1 ~160s + Pass 2 ~40s). Or, le timeout côté client dans `pipeline-runner.ts` est de **180 secondes** pour les "longSteps".

Chronologie des logs :
- Pass 1/2 démarre à 13:36:34
- Pass 2/2 démarre à 13:39:14 (160s plus tard)
- Shutdown forcé à 13:39:52

Le client `AbortController` tue la connexion HTTP à 180s. Quand la connexion se ferme, le runtime Deno arrête le handler **avant** que `saveDeliverable()` ne soit appelé. Résultat : **aucun `investment_memo` en base** → le viewer affiche "Prêt à être généré" au lieu du contenu.

## Plan

### Étape 1 — Augmenter le timeout client pour le mémo

**Fichier** : `src/lib/pipeline-runner.ts`

Créer un 3e niveau de timeout pour les étapes très longues (Opus) :

```typescript
const veryLongSteps = new Set(['generate-investment-memo']);
const longSteps = new Set(['generate-business-plan', 'generate-pitch-deck']);
const timeoutMs = veryLongSteps.has(step.fn) ? 360000 : longSteps.has(step.fn) ? 180000 : 120000;
```

360 secondes (6 min) couvre largement les 2 passes Opus.

### Étape 2 — Augmenter aussi le timeout dans le pipeline serveur

**Fichier** : `supabase/functions/generate-deliverables/index.ts`

Pas de timeout côté serveur sur les fetch internes, mais vérifier que le runtime Deno ne tue pas la fonction. L'edge function a un wall clock de ~400s, ce qui devrait suffire. Aucune modif nécessaire ici.

### Étape 3 — Ajouter le mémo d'investissement dans le pipeline serveur

Le `generate-deliverables` serveur n'inclut PAS le memo, la valuation ni le onepager dans `PIPELINE_STEPS`. Ces étapes ne sont exécutées que via le pipeline client. C'est cohérent mais on pourrait les ajouter pour la robustesse. **Pas bloquant pour ce bug.**

### Résumé

| Fichier | Modification |
|---------|-------------|
| `src/lib/pipeline-runner.ts` | Timeout 360s pour `generate-investment-memo` |

Correction simple d'une ligne qui résout le problème de timeout causant la perte du mémo.

