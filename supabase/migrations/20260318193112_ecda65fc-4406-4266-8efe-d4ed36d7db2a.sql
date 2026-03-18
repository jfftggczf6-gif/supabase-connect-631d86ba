-- CHECK constraint on data_room_documents.category
ALTER TABLE public.data_room_documents
  ADD CONSTRAINT data_room_documents_category_check
  CHECK (category IN ('legal', 'finance', 'commercial', 'team', 'impact', 'other'));

-- RLS: Coaches can insert programme_criteria
CREATE POLICY "Coaches can insert programme_criteria"
  ON public.programme_criteria FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- RLS: Coaches can update own programme_criteria
CREATE POLICY "Coaches can update own programme_criteria"
  ON public.programme_criteria FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'coach'));

-- RLS: Coaches can delete own programme_criteria
CREATE POLICY "Coaches can delete own programme_criteria"
  ON public.programme_criteria FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'coach'));