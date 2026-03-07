

## Fix : Augmenter max_tokens à 24K

### Problème identifié
Le JSON financier généré par Claude pour 4 produits + 2 services fait ~27K+ caractères. Avec `max_tokens: 16384` (≈16K tokens ≈ 50K chars en théorie, mais le JSON dense avec beaucoup de nombres consomme plus de tokens), la réponse est tronquée à la ligne 436. La réparation JSON échoue car la troncature coupe au milieu d'une structure complexe.

### Correction
**Fichier** : `supabase/functions/generate-ovo-plan/index.ts`

1. **Augmenter `max_tokens` de 16384 à 24576** (24K tokens)
   - Suffisant pour 5 produits + 5 services
   - Reste sous le seuil où Claude prendrait trop longtemps

2. **Garder le timeout à 150s** — l'attempt 1 a répondu en ~2min, donc 150s est correct

3. **Garder 2 attempts** — le wall-time permet 2 tentatives

### Changement unique
Ligne 334 : `max_tokens: 16384` → `max_tokens: 24576`

