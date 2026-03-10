

# Audit Financier Complet — Erreurs et Incohérences Détectées

## Problèmes Identifiés

### 1. CRITIQUE — `generate-inputs` produit un "Framework d'Analyse" au lieu de simples Inputs

Le `userPrompt` de `generate-inputs/index.ts` (ligne 32) dit : *"Réalise le FRAMEWORK D'ANALYSE FINANCIÈRE PME complet"* et demande des projections 5 ans, scénarios, plan d'action, etc. C'est exactement le même livrable que `generate-framework`. Le module Inputs devrait uniquement extraire les données financières historiques (compte de résultat + bilan) depuis les documents uploadés — pas générer des projections.

**Conséquence** : Le `normalizeInputs()` (ligne 111-130) ne garde que `compte_resultat` et jette tout le reste. L'IA gaspille des tokens et le `compte_resultat` est souvent hallucié car le prompt ne force pas assez l'extraction documentaire.

**Fix** : Réécrire le prompt de `generate-inputs` pour qu'il se concentre exclusivement sur l'extraction des données historiques (compte de résultat, bilan, effectifs) depuis les documents uploadés, sans projections ni scénarios.

---

### 2. CRITIQUE — Double `getFiscalParams()` avec des valeurs différentes

Il existe **3 versions** de `getFiscalParams` :
- `_shared/helpers.ts` lignes 361-381 : `FISCAL_PARAMS` (ex: Bénin cotisations = 22.4%, IS = 30)
- `generate-plan-ovo/index.ts` lignes 6-43 : version locale (ex: Bénin cotisations = 24.5%, IS = 30)
- `generate-ovo-plan/index.ts` : version copiée de plan-ovo

Les taux de cotisations sociales ne concordent pas entre les fichiers (Bénin: 22.4% vs 24.5%, Togo: 21% vs 23.5%, Sénégal: 22% vs 24%). Le `generate-framework` utilise la version `helpers.ts`, tandis que `generate-plan-ovo` utilise sa propre version.

**Fix** : Supprimer les versions locales dans `generate-plan-ovo` et `generate-ovo-plan`. Utiliser uniquement `getFiscalParams` depuis `helpers.ts` et harmoniser les taux.

---

### 3. HAUTE — `enforceFrameworkConstraints` : le CAGR Revenue est sur 5 ans mais les données couvrent 6 années de projection

Le CAGR est calculé comme `(year6 / current_year)^(1/5)` (ligne 534). Or de `current_year` à `year6`, il y a **6 ans** de différence (current → year2 → year3 → year4 → year5 → year6), pas 5. Le diviseur devrait être 6.

Pareil pour CAGR EBITDA (ligne 541).

**Fix** : Changer l'exposant de `1/5` à `1/6` dans les deux formules CAGR, ou utiliser `(year5 / current_year)^(1/5)` si on veut mesurer sur 5 ans.

---

### 4. HAUTE — `normalizeInputs` perd le bilan et les effectifs

`normalizeInputs()` (lignes 111-130) ne normalise que `compte_resultat` et `score`. Les données `bilan`, `effectifs`, `kpis`, `projection_5ans`, `scenarios`, etc. sont copiées telles quelles sans normalisation. Pire, le bilan n'est même pas mentionné dans le normalizer, donc si l'IA utilise une clé variante (ex: `balance_sheet`), il est perdu.

**Fix** : Ajouter la normalisation du bilan et des effectifs dans `normalizeInputs`.

---

### 5. HAUTE — `syncBusinessPlanWithPlanOvo` ne synchronise que 3 ans (year2-year4) sur les 5 projetés

Le Business Plan (lignes 670-688 de normalizers.ts) ne mappe que annee1→year2, annee2→year3, annee3→year4. Les années 4 et 5 du Plan OVO (year5, year6) sont ignorées. C'est un choix de design (le template BP OVO n'a que 3 ans), mais cela crée une incohérence si quelqu'un compare le BP avec le Plan OVO.

**Impact** : Moyen — c'est une limitation du template BP OVO, pas un bug.

---

### 6. HAUTE — `enforceFrameworkConstraints` : le Newton-Raphson TRI peut diverger

Le calcul du TRI (lignes 515-527) n'a pas de borne. Si `irr` devient très négatif ou très grand, la boucle peut produire NaN. Le retry (ligne 579-593) a une garde `irrRetry < -0.99` mais pas de borne supérieure.

**Fix** : Ajouter une borne `if (irrRetry > 10) break;` et un fallback `if (isNaN(irrRetry)) irrRetry = 0;`.

---

### 7. MOYENNE — `toNumber` dans `enforceFrameworkConstraints` appelé avec `undefined` comme fallback

Ligne 466 : `toNumber(ligne[AN_KEYS[i]], undefined as any)` — si la valeur est absente, `toNumber` retourne `undefined` casté en `any`, pas un nombre. Ensuite le test `val !== undefined && !isNaN(val)` fonctionne mais c'est du code fragile.

**Fix** : Utiliser un sentinel comme `NaN` : `toNumber(ligne[AN_KEYS[i]], NaN)` et tester `!isNaN(val)`.

---

### 8. MOYENNE — `generate-diagnostic` duplique les paramètres fiscaux au lieu d'utiliser `helpers.ts`

Le diagnostic (lignes 242-261) hardcode les paramètres fiscaux pays par pays avec des valeurs différentes de `helpers.ts` (ex: CIV SMIG = 75000 dans diagnostic vs 60000 dans helpers, Sénégal cotisations = 20% dans diagnostic vs 22% dans helpers).

**Fix** : Utiliser `getFiscalParams()` depuis helpers.ts.

---

### 9. MOYENNE — Framework `projection_5ans.lignes` : mapping Marge Brute % confusion

`findLigne('marge brute', 'gross')` dans `enforceFrameworkConstraints` (ligne 457) peut matcher à la fois "Marge Brute" (montant) et "Marge Brute (%)" (pourcentage). Si le % est trouvé en premier, les valeurs seront des pourcentages écrasant des montants.

**Fix** : Exclure les lignes contenant `%` ou `(%)` dans le pattern de `mbLine`.

---

## Plan de Corrections

| Priorité | Fichier | Correction |
|---|---|---|
| CRITIQUE | `generate-inputs/index.ts` | Réécrire le prompt pour extraire uniquement les données historiques |
| CRITIQUE | `generate-plan-ovo/index.ts` + `generate-ovo-plan/index.ts` | Supprimer `getFiscalParams` local, importer depuis `helpers.ts`. Harmoniser les taux dans `helpers.ts` |
| HAUTE | `normalizers.ts` enforceFrameworkConstraints | CAGR : changer exposant 1/5 → 1/6 (ou utiliser year5) |
| HAUTE | `normalizers.ts` enforceFrameworkConstraints | TRI Newton-Raphson : bornes sup + fallback NaN |
| HAUTE | `normalizers.ts` enforceFrameworkConstraints | `findLigne` marge brute : exclure les lignes `%` |
| HAUTE | `normalizers.ts` normalizeInputs | Ajouter normalisation bilan + effectifs |
| MOYENNE | `generate-diagnostic/index.ts` | Utiliser `getFiscalParams` de helpers.ts au lieu de hardcode |
| MOYENNE | `normalizers.ts` enforceFrameworkConstraints | `toNumber` sentinel → NaN au lieu de undefined |

