-- Fix notification soft-delete: SELECT hides deleted rows (deleted_at IS NULL),
-- but UPDATE must explicitly allow setting deleted_at on owned rows.
-- Also expose SECURITY DEFINER RPCs so clients dismiss via auth.uid() safely.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;

CREATE POLICY "Update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "Update own notifications" ON public.notifications IS
  'Recipient may update own active notifications (read_at, soft-delete deleted_at).';

CREATE OR REPLACE FUNCTION public.dismiss_user_notification(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.notifications
  SET deleted_at = now()
  WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or already dismissed'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_user_notifications(p_notification_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_notification_ids IS NULL OR array_length(p_notification_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.notifications
  SET deleted_at = now()
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
    AND id = ANY (p_notification_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_all_user_notifications()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.notifications
  SET deleted_at = now()
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_user_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_user_notifications(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_all_user_notifications() TO authenticated;
