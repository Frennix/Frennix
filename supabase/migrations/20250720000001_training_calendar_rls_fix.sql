-- Fix infinite recursion between training_calendar_items and training_session_participants RLS.

CREATE OR REPLACE FUNCTION public.is_training_calendar_participant(
  p_calendar_item_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.training_session_participants p
    WHERE p.calendar_item_id = p_calendar_item_id
      AND p.user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_training_calendar_participant(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users read own and participating calendar items"
  ON public.training_calendar_items;

CREATE POLICY "Users read own and participating calendar items"
  ON public.training_calendar_items FOR SELECT
  USING (
    user_id = auth.uid()
    OR privacy = 'public'
    OR public.is_training_calendar_participant(id, auth.uid())
  );

DROP POLICY IF EXISTS "Participants read session participants"
  ON public.training_session_participants;

CREATE POLICY "Participants read session participants"
  ON public.training_session_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_calendar_items i
      WHERE i.id = calendar_item_id AND i.user_id = auth.uid()
    )
    OR public.is_training_calendar_participant(calendar_item_id, auth.uid())
  );
