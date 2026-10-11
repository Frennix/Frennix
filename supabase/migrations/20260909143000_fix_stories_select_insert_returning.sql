-- Hotfix: owner-visible stories SELECT so INSERT ... RETURNING can see the new row.
-- STABLE can_view_story() cannot observe the row being inserted in the same statement.
-- Non-owner visibility stays entirely in can_view_story (privacy unchanged).

DROP POLICY IF EXISTS "Authorized users read visible stories" ON public.stories;

CREATE POLICY "Authorized users read visible stories"
  ON public.stories FOR SELECT
  USING (user_id = auth.uid() OR public.can_view_story(id));
