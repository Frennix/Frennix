-- Fix suggestion_dismissals access: grants + unified RLS (upsert/update safe).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestion_dismissals TO authenticated;

DROP POLICY IF EXISTS "View own suggestion dismissals" ON public.suggestion_dismissals;
DROP POLICY IF EXISTS "Dismiss suggestions for self" ON public.suggestion_dismissals;
DROP POLICY IF EXISTS "Undo suggestion dismissals for self" ON public.suggestion_dismissals;

CREATE POLICY "Manage own suggestion dismissals"
  ON public.suggestion_dismissals
  FOR ALL
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid() AND dismissed_id <> auth.uid());
