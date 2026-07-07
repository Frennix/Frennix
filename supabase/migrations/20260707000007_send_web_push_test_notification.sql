-- Self-service test push for iPhone PWA verification.

CREATE OR REPLACE FUNCTION public.send_web_push_test_notification()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_notification_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_notification_id := public.create_notification(
    p_user_id := v_user_id,
    p_type := 'system_announcement',
    p_actor_id := v_user_id,
    p_entity_type := 'system',
    p_entity_id := v_user_id,
    p_title := 'Frennix push test',
    p_body := 'If you see this on your lock screen, web push is working.',
    p_deep_link := '/notifications',
    p_payload := jsonb_build_object('test_push', true),
    p_dedupe_key := 'web_push_test:' || v_user_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
  );

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_web_push_test_notification() TO authenticated;
