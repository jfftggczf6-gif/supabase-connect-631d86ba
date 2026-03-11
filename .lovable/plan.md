

# Corrections : Inputs viewer, Rapport Coach timeout, Génération en arrière-plan

## 3 corrections à appliquer

### 1. Ajouter le `case 'inputs'` dans DeliverableViewer

**Fichier** : `src/components/dashboard/DeliverableViewer.tsx`

Le switch (ligne 18-26) ne gère pas `'inputs'`. Le composant `InputsViewer` existe déjà dans ce même fichier mais n'est jamais appelé. Ajouter :
```
case 'inputs': return <InputsViewer data={data} />;
```

### 2. Optimiser generate-coach-report pour éviter le timeout

**Fichier** : `supabase/functions/generate-coach-report/index.ts`

- Réduire `max_tokens` de 16384 → 8192
- Réduire les limites de `summarize()` : 4000→2000, 5000→2500, 3000→1500
- Ajouter `signal: AbortSignal.timeout(55000)` sur le fetch Anthropic pour retourner une erreur propre au lieu d'un crash silencieux

### 3. Génération en arrière-plan (ne se coupe plus au changement d'onglet)

**Problème** : La génération est un `for` loop séquentiel avec `await fetch()` côté client. Quand l'utilisateur change d'onglet/écran, le navigateur peut suspendre les requêtes fetch en cours.

**Solution** : Utiliser la Edge Function `generate-deliverables` (qui existe déjà côté serveur et exécute le pipeline complet) au lieu de boucler côté client. Le frontend lance UN seul appel, puis poll la DB pour voir les livrables apparaître.

**Changements dans `EntrepreneurDashboard.tsx`** :
- `handleGenerate()` : remplacer la boucle `for` par un seul appel à `generate-deliverables` avec `enterprise_id` et `force`
- Ajouter un polling `setInterval` (toutes les 5s) qui appelle `fetchData()` pour rafraîchir les livrables au fur et à mesure
- Le polling s'arrête quand la réponse de `generate-deliverables` arrive (ou timeout 10min)
- L'utilisateur peut naviguer librement pendant ce temps

**Changements dans `CoachDashboard.tsx`** :
- `handleGenerateCoach()` et `handleGenerateMirror()` : même refactoring — un seul appel serveur + polling DB
- Après la réponse, mettre à jour `generated_by` / `visibility` en batch

### Fichiers impactés

| Fichier | Action |
|---|---|
| `src/components/dashboard/DeliverableViewer.tsx` | Ajouter case `'inputs'` |
| `supabase/functions/generate-coach-report/index.ts` | Réduire tokens/contexte, ajouter timeout |
| `src/components/dashboard/EntrepreneurDashboard.tsx` | Déléguer au serveur + polling |
| `src/components/dashboard/CoachDashboard.tsx` | Idem pour coach |

