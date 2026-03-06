

## Problèmes identifiés dans `generate-ovo-plan`

### 1. Code mort / unreachable code (CRITIQUE - crash potentiel)
**Lignes 265-266** : après le bloc `try/catch` de parsing JSON, il y a du code mort qui référence une variable `parsed` qui n'existe pas dans ce scope :
```js
console.log(`[Claude] OK — products: ${parsed.products?.length}...`);
return parsed;
```
Ces lignes sont après les `return` des lignes 245 et 261, donc jamais exécutées. Mais si le code était restructuré, ça crasherait. À supprimer.

### 2. Pas d'authentification dans la Edge Function
La fonction ne vérifie pas le JWT/token de l'utilisateur. Le `Authorization` header est envoyé par le client (ligne 298) mais jamais utilisé côté serveur. N'importe qui peut appeler cette fonction avec un payload arbitraire. Contrairement aux autres fonctions qui utilisent `verifyAndGetContext` de helpers.ts, celle-ci parse directement `req.json()` sans vérification.

### 3. Pas de validation du payload
`data.products` et `data.services` sont utilisés directement dans le prompt (lignes 335-338) sans vérifier qu'ils sont des tableaux. Si le BMC n'a pas de produits, `data.products.map(...)` crashera.

### 4. Template Excel potentiellement absent
Si le template `.xlsm` n'existe pas dans le bucket `ovo-templates`, l'erreur est générique. Pas de fallback ni de message clair pour l'utilisateur.

### 5. URL signée expire en 1h (ligne 166)
L'URL de téléchargement est signée pour 1 heure seulement. Si l'utilisateur revient plus tard, le lien sauvegardé dans `deliverables.file_url` sera expiré et le téléchargement échouera silencieusement.

### 6. CORS headers incomplets
La fonction utilise ses propres `corsHeaders()` (ligne 1288) qui n'incluent pas `x-client-info, apikey` — contrairement au standard dans `helpers.ts`. Cela peut causer des erreurs CORS selon le client.

---

## Corrections prévues

**Fichier : `supabase/functions/generate-ovo-plan/index.ts`**

1. **Supprimer les lignes 265-266** (code mort avec `parsed` undefined)
2. **Ajouter validation du payload** : `products = data.products || []`, `services = data.services || []` avec fallback tableaux vides
3. **Aligner les CORS headers** avec le standard de `helpers.ts` (ajouter `authorization, apikey, x-client-info`)
4. **Augmenter la durée de l'URL signée** de 3600s (1h) à 86400s (24h)

**Fichier : `src/components/dashboard/EntrepreneurDashboard.tsx`**
5. **Sécuriser le payload** : s'assurer que `products` et `services` sont toujours des tableaux avant envoi

