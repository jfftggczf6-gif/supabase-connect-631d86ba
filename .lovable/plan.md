

## Ajouter un onglet "Coaches" au Dashboard Super Admin

### Objectif
Voir l'activité de chaque coach en détail : entreprises suivies, livrables générés, documents uploadés, et timeline des actions.

### Modifications

**Fichier unique : `src/components/dashboard/SuperAdminDashboard.tsx`**

1. **Fetch `coach_uploads`** dans `fetchAll` (RLS super_admin déjà en place)

2. **Nouvel onglet "Coaches"** entre "Utilisateurs" et "Entreprises" dans les Tabs :
   - **Barre de recherche** par nom/email de coach
   - **Tableau principal** avec une ligne par coach :
     - Nom / Email
     - Nb entreprises assignées (compté depuis `enterprises.coach_id`)
     - Nb livrables générés (filtrés `generated_by = 'coach' | 'coach_mirror'`)
     - Nb documents uploadés (depuis `coach_uploads`)
     - Dernière activité (date la plus récente entre livrables et uploads)
   - **Lignes expandables** (Collapsible) : cliquer sur un coach affiche :
     - Liste de ses entreprises (nom, secteur, score IR, phase)
     - Derniers livrables générés (type, entreprise, visibilité shared/private, date)
     - Documents uploadés (filename, catégorie, date)

3. **Données calculées** via `useMemo` :
   - `coachStats` : agrège entreprises, livrables et uploads par `coach_id`
   - `coachDeliverables` : filtre `deliverables` où `generated_by` contient 'coach'
   - `coachUploadsMap` : groupe `coach_uploads` par `coach_id`

### Aucune migration requise
Toutes les tables et politiques RLS sont déjà en place pour `super_admin`.

