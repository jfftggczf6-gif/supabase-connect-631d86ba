
Diagnostic rapide (cause probable confirmée)
- Ton compte `emmanuelyace@gmail.com` a bien le rôle `super_admin`, mais il a aussi `coach` et `entrepreneur` (3 lignes dans `user_roles`).
- Dans `useAuth`, le code lit le rôle avec `maybeSingle()` :
  - `supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()`
  - Avec plusieurs rôles, cette lecture ne renvoie pas un rôle unique exploitable.
- Résultat: `role` reste `null`, et `Dashboard.tsx` te renvoie vers `/select-role` au lieu d’afficher le Super Admin.

Plan d’implémentation
1) Corriger la lecture des rôles (frontend)
- Remplacer la lecture “un seul rôle” par une lecture “liste des rôles”.
- Calculer un rôle effectif avec priorité:
  - `super_admin` > `coach` > `entrepreneur`
- Mettre ce rôle effectif dans `role` pour la navigation dashboard.

2) Corriger l’écriture des rôles utilisateur (frontend)
- Dans `setRole` (sélection Coach/Entrepreneur), éviter d’empiler les rôles métier.
- Conserver éventuellement `super_admin`, mais remplacer proprement entre `coach` et `entrepreneur` pour éviter les doublons/logique ambiguë.

3) Débloquer immédiatement ton compte (données)
- Faire une opération de données pour ce compte:
  - soit garder uniquement `super_admin`,
  - soit garder les 3 rôles mais laisser la nouvelle logique de priorité gérer correctement.
- Recommandation: garder `super_admin` + éventuellement 1 rôle métier max.

4) Corriger l’avertissement React Router
- Dans `SelectRole.tsx`, déplacer le `navigate('/dashboard')` hors du render (useEffect ou `<Navigate/>`) pour supprimer le warning actuel.

Détails techniques (concis)
- Fichier principal: `src/hooks/useAuth.tsx`
  - `fetchUserData`: `select('role')` (array), puis:
    - si contient `super_admin` => `setRoleState('super_admin')`
    - sinon `coach`
    - sinon `entrepreneur`
    - sinon `null`
- `src/pages/SelectRole.tsx`
  - Remplacer navigation directe dans le rendu par un flux conforme React Router.
- Données backend (opération data, pas migration structure):
  - ajuster les lignes `user_roles` pour `emmanuelyace@gmail.com` selon la stratégie retenue.

Validation après correction
- Connexion avec `emmanuelyace@gmail.com`.
- Vérifier redirection vers `/dashboard`.
- Vérifier affichage `SuperAdminDashboard`.
- Vérifier qu’aucun retour vers `/select-role` ne se produit.
- Vérifier disparition du warning “You should call navigate() in a React.useEffect()”.
