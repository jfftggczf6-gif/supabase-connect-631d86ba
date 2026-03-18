

## Diagnostic

D'après les logs réseau, voici ce qui se passe :

1. **Le signup réussit** (status 200) — l'utilisateur est créé dans la base
2. **L'insertion du rôle échoue** (status 401, RLS violation) — car l'email n'est pas encore confirmé, donc il n'y a pas de session authentifiée. Le code essaie d'insérer dans `user_roles` avec la clé `anon`, ce qui est bloqué par les politiques RLS
3. **Le login échoue** (status 400, "Invalid login credentials") — car l'email n'a pas été confirmé

## Cause racine

Le code `Register.tsx` fait un `signUp()` puis tente `supabase.from('user_roles').upsert(...)` côté client. Mais comme la confirmation email est requise, l'utilisateur n'a pas de token JWT authentifié à ce moment-là. L'appel se fait avec le rôle `anon` qui n'a pas le droit d'insérer dans `user_roles`.

## Plan de correction

### 1. Créer un trigger base de données pour l'insertion automatique du rôle

Modifier la fonction `handle_new_user` (ou créer un nouveau trigger) pour qu'elle insère aussi le rôle depuis `raw_user_meta_data->>'role'` lors de la création de l'utilisateur. Comme c'est `SECURITY DEFINER`, ça contourne RLS.

```sql
-- Modifier handle_new_user pour aussi insérer le rôle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'entrepreneur'))
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;
```

Puis s'assurer que le trigger existe sur `auth.users`:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Supprimer l'insertion client-side du rôle dans `useAuth.tsx`

Retirer le `supabase.from('user_roles').upsert(...)` du `signUp`, car le trigger s'en charge désormais. Simplifier le flag `skipRoleFetch`.

### 3. Gérer le message post-inscription

Après inscription, au lieu de rediriger vers `/dashboard`, afficher un message indiquant de vérifier son email. L'utilisateur ne peut pas se connecter tant que l'email n'est pas confirmé.

---

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| Migration SQL | Mettre à jour `handle_new_user` + vérifier trigger |
| `src/hooks/useAuth.tsx` | Retirer l'upsert client-side de `signUp` |
| `src/pages/Register.tsx` | Afficher message de confirmation email au lieu de rediriger vers `/dashboard` |

