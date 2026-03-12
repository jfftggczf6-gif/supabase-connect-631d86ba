

## Plan : Résoudre les 3 problèmes identifiés dans l'audit

### Fix 1 — OPEX année courante : distribuer `current_year` sur H1/H2

**Fichier** : `supabase/functions/_shared/ovo-data-expander.ts`

Dans `alignOpexToPlanOvo` (lignes 346-371), quand `yearKey === "current_year"` (index 4), au lieu de lire l'index 4 (toujours 0), sommer les index 2 (H1) + 3 (H2) comme `currentTotal`, puis distribuer le target sur H1 (45%) et H2 (55%).

Même correction dans `alignTotalOpexToFramework` (lignes 479-537) : ajouter le cas "CURRENT YEAR" avec `idx_h1=2, idx_h2=3` en plus des YEAR2-YEAR6. Utiliser les données `inputs_data` ou `plan_ovo` pour le target CY du Framework (le Framework ne couvre que an1-an5).

### Fix 2 — Supprimer `enforceFrameworkConstraints` de generate-ovo-plan

**Fichier** : `supabase/functions/generate-ovo-plan/index.ts`

Supprimer le bloc lignes 268-325 (du `if (data.framework_data && financialJson.revenue)` jusqu'au `catch`). Les alignements sont déjà gérés par :
- `scaleToFrameworkTargets` → revenus
- `scaleCOGSToFramework` → COGS  
- `alignStaffToTarget` → staff
- `alignOpexToPlanOvo` → OPEX catégories
- `alignTotalOpexToFramework` → OPEX total

Ce bloc ne fait que modifier des agrégats (`financialJson.revenue`, `.cogs`) qui ne sont jamais utilisés par `buildCellWrites`, et sa "drift detection" peut déclencher un second scaling qui casse les volumes déjà alignés.

### Fix 3 — Écrire les labels CAPEX dans l'Excel

**Fichier** : `supabase/functions/generate-ovo-plan/index.ts`

Ligne 1442, ajouter le type `label: string` au forEach et ajouter une ligne :
```
w("FinanceData", row, "J", c.label || "", "string");
```
juste avant la ligne `w("FinanceData", row, "K", c.acquisition_year, "number");` (ligne 1450).

### Résumé des modifications

| Fichier | Modification |
|---|---|
| `ovo-data-expander.ts` | `alignOpexToPlanOvo` : cas spécial CY → H1+H2 |
| `ovo-data-expander.ts` | `alignTotalOpexToFramework` : ajouter CY via H1+H2 |
| `generate-ovo-plan/index.ts` | Supprimer lignes 268-325 (enforceFrameworkConstraints) |
| `generate-ovo-plan/index.ts` | Ajouter `w("FinanceData", row, "J", c.label)` pour CAPEX |

