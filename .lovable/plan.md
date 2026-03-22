

# Cacher le bouton replier/déplier des phases — toujours ouvert

## Changement

**Fichier : `src/components/dashboard/DashboardSidebar.tsx`**

Transformer le header de chaque phase (lignes 194-208) : retirer le `onClick` et les icônes chevron pour que les phases restent toujours dépliées sans possibilité de les replier.

- Ligne 194-195 : Remplacer `<button onClick={() => togglePhase(phase.id)}>` par un simple `<div>` non-cliquable
- Ligne 201 : Supprimer le chevron (`ChevronDown` / `ChevronUp`)
- Ligne 210 : Retirer le `{isExpanded &&` conditionnel — les modules s'affichent toujours

