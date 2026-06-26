-- Comment edit support for owners

CREATE POLICY "Update own comment" ON public.comments
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
