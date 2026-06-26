-- Challenge management: rules, cover image, creator update/delete policies

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS rules TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

CREATE POLICY "Update own challenges" ON public.challenges
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Delete own challenges" ON public.challenges
  FOR DELETE
  USING (created_by = auth.uid());
