

## Plan : Corriger les incohérences Revenue/OPEX et indicateurs financiers

### Diagnostic confirmé

Le code actuel a 3 lacunes principales :

1. **Revenue Framework déconnecté des Inputs réels** : `enforceFrameworkConstraints` écrase le revenue avec les valeurs Framework (ligne 682), mais si le Framework a été généré sans Inputs, ces valeurs sont hallucinées (62M vs 15.5M réel). Aucune vérification de cohérence n'existe.

2. **Garde DSCR/Multiple EBITDA uniquement dans `enforceFrameworkConstraints`** : Si le framework est absent ou incomplet, la fonction retourne à la ligne 593 et les gardes (lignes 858+) ne s'exécutent jamais. `normalizePlanOvo()` (lignes 502-584) ne contient aucune garde pour ces métriques.

3. **Données obsolètes non signalées** : Quand le Framework est régénéré après le Plan OVO, le dashboard affiche des données périmées sans avertissement.

### Modifications prévues

**Fichier 1 : `supabase/functions/_shared/normalizers.ts`**

- **Fix 1 — Revenue rescale (après ligne 619)** : Après l'ancrage current_year depuis Inputs, vérifier si les projections Framework dépassent 3× le CA réel. Si oui, rescaler proportionnellement toutes les séries de projection (revenue, gross_profit, ebitda, net_profit, cogs, cashflow) pour ancrer year2 à +15% du CA réel.

- **Fix 2 — Garde DSCR/Multiple dans `normalizePlanOvo()` (avant ligne 584)** : Ajouter dans la fonction de normalisation (qui s'exécute TOUJOURS, contrairement à `enforceFrameworkConstraints`) une garde : si `ebitda.year2 <= 0`, forcer `investment_metrics.dscr` et `investment_metrics.multiple_ebitda` à `null`.

- Fix OPEX bounds [0.4, 2.5] : déjà implémenté (lignes 734-753). OK.

**Fichier 2 : `src/components/dashboard/PlanOvoViewer.tsx`**

- **Fix 3 — Bandeau staleness** : Le composant reçoit `data` mais pas les timestamps. Modifier la signature pour accepter un prop optionnel `staleness?: { frameworkUpdatedAt?: string; planOvoUpdatedAt?: string }`. Si `frameworkUpdatedAt > planOvoUpdatedAt`, afficher un bandeau jaune d'avertissement invitant à régénérer.

- Fixes frontend (DSCR/multiple guard, ROI seuil, multipleEbitdaStatus) : déjà implémentés dans le message précédent (lignes 190-205). OK.

**Fichier 3 : `src/components/dashboard/DeliverableViewer.tsx`** (ou le parent qui appelle PlanOvoViewer)

- Passer les timestamps `framework_data.updated_at` et `plan_ovo.updated_at` au composant PlanOvoViewer pour activer le bandeau staleness.

### Résumé des changements

| Fichier | Changement | Lignes |
|---------|-----------|--------|
| `normalizers.ts` | Revenue rescale si Framework > 3× Inputs | Après L619 |
| `normalizers.ts` | Garde DSCR/multiple dans `normalizePlanOvo()` | Avant L584 |
| `PlanOvoViewer.tsx` | Bandeau staleness framework > plan_ovo | Nouveau prop + rendu |
| Parent de PlanOvoViewer | Passer timestamps staleness | Appel composant |

