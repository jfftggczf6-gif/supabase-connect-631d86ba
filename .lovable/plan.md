

## Revenir au comportement original : pas de génération financière sans données réelles

L'idée est simple : sans documents financiers réels, `generate-inputs` revient au squelette vide (score 0), et les modules financiers en aval (Framework, Plan OVO, Excel OVO) sont **sautés** dans le pipeline orchestrateur.

### Modifications

**1. `supabase/functions/generate-inputs/index.ts`**
- Supprimer tout le bloc "estimation sectorielle" (lignes 329-385) — le `if (!financialDetected)` revient à sauvegarder un deliverable vide avec `score: 0`, comme avant.

**2. `supabase/functions/generate-deliverables/index.ts`**
- Après l'exécution de `generate-inputs`, vérifier si le résultat a `score: 0` ou si `inputs_data` est vide/squelette.
- Si oui, **sauter automatiquement** les étapes `generate-framework`, `generate-plan-ovo`, `generate-ovo-plan` (et `reconcile-plan-ovo` si présent) en les marquant `skipped` avec un message clair : "Pas de données financières — module ignoré".
- Les modules non-financiers (BMC, SIC, Business Plan, ODD, Diagnostic) continuent normalement.

**3. `supabase/functions/generate-framework/index.ts` et `generate-plan-ovo/index.ts`**
- Retirer les modifications liées au flag `estimation_sectorielle` (ajout au prompt, propagation du flag).

**4. UI Viewers : `FrameworkViewer.tsx`, `PlanOvoViewer.tsx`, `BusinessPlanPreview.tsx`**
- Retirer le bandeau "⚠️ Projections indicatives" (plus nécessaire puisque les modules financiers ne seront simplement pas générés).

**5. Redéploiement** des edge functions modifiées.

### Résultat
- Sans docs financiers : BMC + SIC + Business Plan + ODD + Diagnostic sont générés normalement. Les modules financiers (Framework, Plan OVO, Excel) restent vides avec un message "Uploadez le template Analyse Financière pour débloquer ce module".
- Avec docs financiers : pipeline complet comme avant.

