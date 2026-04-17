-- Fix S3 : permettre aux users de supprimer leurs propres rôles
-- Nécessaire pour setRole() qui fait DELETE + INSERT
DROP POLICY IF EXISTS "Users can delete their own roles" ON public.user_roles;
CREATE POLICY "Users can delete their own roles"
  ON public.user_roles FOR DELETE
  USING (auth.uid() = user_id);
