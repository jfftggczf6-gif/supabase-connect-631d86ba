-- RLS SELECT policies for super_admin
CREATE POLICY "Super admin can select all enterprises"
ON public.enterprises FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can select all deliverables"
ON public.deliverables FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can select all enterprise_modules"
ON public.enterprise_modules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can select all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can select all user_roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can select all score_history"
ON public.score_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can select all coach_uploads"
ON public.coach_uploads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS UPDATE policies for super_admin
CREATE POLICY "Super admin can update enterprises"
ON public.enterprises FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can update user_roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- RLS DELETE policies for super_admin
CREATE POLICY "Super admin can delete enterprises"
ON public.enterprises FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete deliverables"
ON public.deliverables FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete user_roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));