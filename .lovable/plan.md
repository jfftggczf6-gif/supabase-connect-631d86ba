

# Indicateur visuel de régénération sur les icônes livrables

## Problème
Pendant la régénération, les icônes de modules en bas du dashboard ne montrent aucun feedback visuel. L'utilisateur ne sait pas quel module est en train d'être généré.

## Solution
Ajouter un indicateur visuel sur chaque icône du bottom bar pendant la régénération :
- **En cours** : animation de pulsation + spinner overlay sur l'icône du module actuellement généré
- **Terminé** : checkmark vert (déjà existant) qui apparaît dès que le step est complété
- **En attente** : opacité réduite avec un petit indicateur "en file"

## Modifications

### 1. `src/components/dashboard/EntrepreneurDashboard.tsx`

**Ajouter un mapping pipeline step → module code** pour savoir quel module correspond à l'étape en cours du pipeline. Utiliser `generationProgress.name` pour déterminer le module actif.

**Modifier la section BOTTOM MODULE BAR** (lignes 1309-1348) :
- Si `generating` est actif, comparer le step en cours avec le module pour afficher :
  - Un **spinner animé** (Loader2) superposé à l'icône du module en cours de génération
  - Une **animation pulse** sur le cercle d'icône
  - Les modules déjà passés dans le pipeline affichent le checkmark vert
  - Les modules pas encore traités restent en opacité réduite avec un petit dot gris "en attente"

**Mapping step → module** (basé sur `PIPELINE` dans `dashboard-config.ts`) :
```
BMC → bmc, SIC → sic, Inputs → (pas affiché), Framework → framework,
Plan OVO / Sync Plan OVO / Excel OVO → plan_ovo, Business Plan → business_plan,
ODD → odd, Diagnostic → diagnostic
```

### 2. Aucune nouvelle dépendance requise
Tout est fait avec les composants existants (Loader2, CheckCircle2) et des classes Tailwind (animate-pulse, animate-spin).

## Résultat
Pendant la régénération, l'utilisateur voit en temps réel quel module est en train d'être généré, lesquels sont terminés, et lesquels sont en attente — directement sur la barre d'icônes en bas.

