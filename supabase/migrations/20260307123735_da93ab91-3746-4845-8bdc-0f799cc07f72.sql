-- Coaches can delete enterprises they are assigned to
CREATE POLICY "Coaches can delete assigned enterprises"
ON public.enterprises FOR DELETE
USING (auth.uid() = coach_id);

-- Allow cascade delete of modules
CREATE POLICY "Users can delete modules of own enterprises"
ON public.enterprise_modules FOR DELETE
USING (EXISTS (
  SELECT 1 FROM enterprises e
  WHERE e.id = enterprise_modules.enterprise_id
  AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())
));

-- Allow cascade delete of deliverables
CREATE POLICY "Users can delete deliverables of own enterprises"
ON public.deliverables FOR DELETE
USING (EXISTS (
  SELECT 1 FROM enterprises e
  WHERE e.id = deliverables.enterprise_id
  AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())
));