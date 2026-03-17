

## Donner l'accès super_admin à emmanuelyace@gmail.com

### Contexte
Le compte est créé (`user_id: 908888d9-47f1-4d74-982b-b7243525f451`). Il faut :
1. Insérer une entrée dans `user_roles` avec le rôle `super_admin`
2. Créer son profil dans `profiles` (la table est vide — le trigger `handle_new_user` n'est pas attaché)

### Actions

**Migration SQL** :
```sql
-- 1. Ajouter le rôle super_admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('908888d9-47f1-4d74-982b-b7243525f451', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Créer le profil s'il n'existe pas
INSERT INTO public.profiles (user_id, email, full_name)
VALUES ('908888d9-47f1-4d74-982b-b7243525f451', 'emmanuelyace@gmail.com', 'Emmanuel Yace')
ON CONFLICT (user_id) DO NOTHING;
```

**Bonus** : Rattacher le trigger `handle_new_user` à `auth.users` pour que les futurs comptes aient automatiquement leur profil créé (actuellement le trigger n'est pas attaché, ce qui explique la table `profiles` vide).

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Aucune modification de code nécessaire.

