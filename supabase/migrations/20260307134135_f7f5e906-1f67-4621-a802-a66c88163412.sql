CREATE POLICY "Users can update their own role"
ON public.user_roles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);