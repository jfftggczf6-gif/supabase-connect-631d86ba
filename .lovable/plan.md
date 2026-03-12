

## Plan : Aligner l'Excel OVO avec le Framework et le Plan OVO JSON

### Diagnostic des écarts restants

Après analyse approfondie du flux de données, 3 sources de désalignement persistent :

```text
Framework (source de vérité)
  ↓ enforceFrameworkConstraints
Plan OVO JSON (OPEX ajustés ✓)
  ↓ alignOpexToPlanOvo (CASSÉ ✗)
Excel FinanceData (OPEX décalés)
  → P&L = SUM(Revenue) - SUM(COGS) - SUM(OPEX) → EBITDA ≠ Framework
```

**Problème 1 — Noms de catégories OPEX non alignés** : `alignOpexToPlanOvo` essaie de matcher les catégories plan_ovo (`staff_salaries`, `office_costs`) avec les catégories Excel (`taxes_on_staff`, `office`). Les noms diffèrent → aucun scaling ne s'applique.

**Problème 2 — Staff Excel non contraint** : Les coûts staff dans l'Excel viennent de `headcount × salary` (FinanceData rows 213+), mais ne sont jamais ajustés pour correspondre au plan_ovo `staff_salaries`. L'écart staff se propage directement dans l'EBITDA.

**Problème 3 — Pas de garde-fou OPEX total** : Même si les catégories individuelles sont scalées, il n'y a pas de vérification que `Total OPEX Excel = Marge Brute - EBITDA` (imposé par le Framework).

### Corrections — 2 fichiers

**1. `supabase/functions/_shared/ovo-data-expander.ts`**

- **Corriger `alignOpexToPlanOvo`** : Ajouter une table de mapping entre les noms plan_ovo et les noms Excel :
  ```
  office_costs → office
  staff_salaries → ignoré (géré par staff rows)
  ```
  Itérer avec les noms mappés au lieu des noms bruts.

- **Nouvelle fonction `alignTotalOpexToFramework`** : Prend le JSON financier + le Framework, calcule l'OPEX total implicite du Framework (`Marge Brute - EBITDA`), compare avec la somme des OPEX Excel sub-catégories, et applique un ratio de scaling global si l'écart dépasse 5%.

- **Nouvelle fonction `alignStaffToTarget`** : Quand le plan_ovo a `staff_salaries` par année, compare avec le coût staff Excel (headcount × salary × 12 + allowances + cotisations). Si écart > 10%, ajuste les salaires proportionnellement.

**2. `supabase/functions/generate-ovo-plan/index.ts`**

- Appeler `alignTotalOpexToFramework(financialJson, data.framework_data)` après `alignOpexToPlanOvo` (ligne ~260).
- Appeler `alignStaffToTarget(financialJson, data.plan_ovo_data)` après `expandCondensedData` (ligne ~250).
- Ajouter un log de vérification post-build : comparer OPEX total Excel vs Framework-implied pour chaque année de projection.

### Résultat attendu

Pour chaque année de projection (YEAR2-YEAR6), l'Excel produira :
- Revenue = Framework CA ±1% (déjà corrigé)
- COGS = Framework Revenue - Marge Brute ±5% (déjà corrigé)
- OPEX total = Marge Brute - EBITDA ±5% (nouveau)
- EBITDA = Framework EBITDA ±5% (conséquence)

