

# Rendre la section des phases scrollable dans la sidebar

## Problème

La zone des phases/modules dans la sidebar ne scroll pas correctement — les derniers onglets (comme "Décision") sont coupés.

## Changement

**Fichier unique** : `src/components/dashboard/DashboardSidebar.tsx`

Ajouter `min-h-0` au container flex parent (`flex flex-col h-full`) et s'assurer que la div des phases (`flex-1 overflow-y-auto`) peut bien rétrécir et scroller :

- Le wrapper `flex flex-col h-full` → `flex flex-col h-full min-h-0`
- La div des phases `flex-1 overflow-y-auto` → `flex-1 overflow-y-auto min-h-0`

C'est un fix CSS classique : dans un conteneur flex en colonne, les enfants ne rétrécissent pas en dessous de leur taille de contenu sans `min-h-0`.

