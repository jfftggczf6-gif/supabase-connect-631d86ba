-- Recréer le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Supprimer l'utilisateur non confirmé
DELETE FROM auth.users WHERE email = 'philippeyace@hotmail.fr';