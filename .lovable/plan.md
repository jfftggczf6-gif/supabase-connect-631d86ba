

# Corriger l'état vide de la Vue Entrepreneur en mode Coach

## Probleme
Quand le coach ouvre la "Vue entrepreneur" et que l'entreprise n'est pas trouvee (probleme RLS, latence reseau, etc.), l'ecran "Creer votre entreprise" s'affiche — ce qui n'a aucun sens pour un coach.

## Changement

**Fichier : `src/components/dashboard/EntrepreneurDashboard.tsx`**

Dans le bloc `if (!enterprise)` (ligne 868), ajouter une condition `coachMode` :
- Si `coachMode === true` : afficher un message d'erreur ("Entreprise introuvable") avec un bouton "Retour" qui appelle `onBack`
- Si `coachMode === false` : garder le formulaire "Creer votre entreprise" actuel (comportement entrepreneur inchange)

