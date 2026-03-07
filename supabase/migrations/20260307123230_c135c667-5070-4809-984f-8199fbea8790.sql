-- Allow coaches to update enterprises assigned to them
CREATE POLICY "Coaches can update assigned enterprises"
ON public.enterprises FOR UPDATE
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- Fix coach_uploads policies: drop RESTRICTIVE and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Coaches see own uploads" ON public.coach_uploads;
DROP POLICY IF EXISTS "Coaches insert own uploads" ON public.coach_uploads;
DROP POLICY IF EXISTS "Coaches delete own uploads" ON public.coach_uploads;

CREATE POLICY "Coaches see own uploads"
ON public.coach_uploads FOR SELECT
USING (auth.uid() = coach_id);

CREATE POLICY "Coaches insert own uploads"
ON public.coach_uploads FOR INSERT
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches delete own uploads"
ON public.coach_uploads FOR DELETE
USING (auth.uid() = coach_id);