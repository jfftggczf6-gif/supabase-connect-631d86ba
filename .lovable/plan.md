

## Changement simple

**Fichier** : `supabase/functions/generate-ovo-plan/index.ts`, lignes 372-373

Remplacer le cap produits de 8 à 5 :
- Ligne 372 : `Math.min(data.products.length, 8)` → `Math.min(data.products.length, 5)`
- Ligne 373 : reste à `Math.min(data.services.length, 5)` (déjà à 5, pas de changement)

Puis redéployer la Edge Function.

