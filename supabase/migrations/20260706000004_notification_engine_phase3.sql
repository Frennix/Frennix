-- Phase 3: Unified notification dispatch platform
-- Web Push + multi-channel delivery for ALL notification types.
-- Open/click tracking, retry queue, subscription RPCs, extended type catalog.

-- ---------------------------------------------------------------------------
-- 1. Extended notification type catalog (engine-ready future types)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_valid_notification_type(p_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_type = ANY (ARRAY[
    'follow', 'message', 'group_message', 'like', 'reaction', 'comment', 'comment_reply', 'mention',
    'match', 'trainer_connection_request', 'trainer_connection_accepted', 'coach_notification',
    'group_invite', 'challenge_reminder', 'challenge_join', 'challenge_invite', 'challenge_progress',
    'event_join', 'event_invite', 'event_reminder', 'run_club_announcement',
    'post_share', 'story_train_invite', 'story_reaction', 'story_reply',
    'story_mention', 'story_challenge_join', 'training_session_invite',
    'training_session_accepted', 'training_session_reminder', 'workout_reminder',
    'system_announcement', 'app_update', 'friend_request', 'referral_reward',
    'ai_coach', 'nutrition_reminder', 'habit_reminder', 'achievement_badge',
    'daily_streak_reminder', 'weekly_recap', 'monthly_progress_summary'
  ]::text[]);
$$;

CREATE OR REPLACE FUNCTION public.notification_category_for_type(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type IN ('message', 'group_message') THEN 'messages'
    WHEN p_type IN (
      'event_join', 'event_invite', 'event_reminder', 'run_club_announcement',
      'training_session_invite', 'training_session_accepted',
      'training_session_reminder', 'workout_reminder'
    ) THEN 'events'
    WHEN p_type IN (
      'challenge_join', 'challenge_invite', 'challenge_reminder', 'challenge_progress'
    ) THEN 'challenges'
    WHEN p_type IN (
      'system_announcement', 'app_update', 'ai_coach', 'nutrition_reminder',
      'habit_reminder', 'achievement_badge', 'daily_streak_reminder',
      'weekly_recap', 'monthly_progress_summary', 'referral_reward'
    ) THEN 'system'
    ELSE 'social'
  END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Web Push subscription RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_web_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_device_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_endpoint IS NULL OR length(trim(p_endpoint)) = 0 THEN
    RAISE EXCEPTION 'endpoint required';
  END IF;

  INSERT INTO public.notification_subscriptions (
    user_id,
    channel,
    endpoint,
    p256dh,
    auth,
    user_agent,
    device_label,
    platform,
    app_scope,
    enabled,
    last_seen_at
  ) VALUES (
    v_user_id,
    'web_push',
    trim(p_endpoint),
    p_p256dh,
    p_auth,
    left(p_user_agent, 500),
    left(p_device_label, 120),
    'web',
    'pwa',
    true,
    now()
  )
  ON CONFLICT (channel, endpoint) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    device_label = EXCLUDED.device_label,
    enabled = true,
    last_seen_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_web_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_web_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.notification_subscriptions
  WHERE channel = 'web_push'
    AND endpoint = trim(p_endpoint)
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_web_push_subscription(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Delivery engagement tracking (open / click / dismiss)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_notification_engagement(
  p_notification_id UUID,
  p_event TEXT,
  p_delivery_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_delivery_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_event NOT IN ('opened', 'clicked', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid engagement event: %', p_event;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.id = p_notification_id AND n.user_id = v_user_id
  ) THEN
    RETURN;
  END IF;

  IF p_delivery_id IS NOT NULL THEN
    v_delivery_id := p_delivery_id;
  ELSE
    SELECT d.id INTO v_delivery_id
    FROM public.notification_deliveries d
    WHERE d.notification_id = p_notification_id
      AND d.status IN ('sent', 'delivered')
    ORDER BY d.created_at DESC
    LIMIT 1;
  END IF;

  IF v_delivery_id IS NOT NULL THEN
    UPDATE public.notification_deliveries
    SET
      opened_at = CASE WHEN p_event = 'opened' THEN COALESCE(opened_at, now()) ELSE opened_at END,
      clicked_at = CASE WHEN p_event = 'clicked' THEN COALESCE(clicked_at, now()) ELSE clicked_at END,
      dismissed_at = CASE WHEN p_event = 'dismissed' THEN COALESCE(dismissed_at, now()) ELSE dismissed_at END,
      delivered_at = COALESCE(delivered_at, now())
    WHERE id = v_delivery_id;
  END IF;

  IF p_event IN ('opened', 'clicked') THEN
    UPDATE public.notifications
    SET read_at = COALESCE(read_at, now())
    WHERE id = p_notification_id AND user_id = v_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_notification_engagement(UUID, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Feature flag — web push rollout
-- ---------------------------------------------------------------------------

INSERT INTO public.feature_flags (key, name, description, milestone_code, enabled_globally)
VALUES (
  'web_push_notifications',
  'Web Push Notifications',
  'PWA Web Push delivery for all notification types',
  'M2',
  false
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Retry helper — mark failed deliveries for retry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.schedule_notification_delivery_retry(
  p_delivery_id UUID,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retry_count INT;
  v_delay INTERVAL;
BEGIN
  SELECT retry_count INTO v_retry_count
  FROM public.notification_deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND OR v_retry_count >= 5 THEN
    RETURN;
  END IF;

  v_delay := CASE v_retry_count
    WHEN 0 THEN interval '1 minute'
    WHEN 1 THEN interval '5 minutes'
    WHEN 2 THEN interval '15 minutes'
    WHEN 3 THEN interval '1 hour'
    ELSE interval '6 hours'
  END;

  UPDATE public.notification_deliveries
  SET
    status = 'failed',
    error_message = left(COALESCE(p_error_message, error_message), 500),
    retry_count = retry_count + 1,
    next_retry_at = now() + v_delay
  WHERE id = p_delivery_id;
END;
$$;

COMMENT ON FUNCTION public.schedule_notification_delivery_retry IS
  'Increments retry_count and schedules next_retry_at for failed push deliveries.';
