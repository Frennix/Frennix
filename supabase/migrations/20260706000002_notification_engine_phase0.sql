-- Phase 0: Notification Engine foundation
-- Permanent schema for in-app notifications + delivery analytics + preferences.
-- Does not change dispatch trigger URL yet (send-push continues until Phase 3).

-- ---------------------------------------------------------------------------
-- 1. Extend notifications (engine v2 columns)
-- ---------------------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deep_link TEXT NOT NULL DEFAULT '/notifications',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'social',
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_feed
  ON public.notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_category
  ON public.notifications (user_id, category, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.notifications.delivered_at IS
  'First successful push delivery timestamp. In-app history remains regardless of push dismiss.';
COMMENT ON COLUMN public.notifications.dedupe_key IS
  'Idempotency key — prevents duplicate notification rows and loops.';

-- ---------------------------------------------------------------------------
-- 2. User notification preferences (dedicated table)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  messages BOOLEAN NOT NULL DEFAULT true,
  likes BOOLEAN NOT NULL DEFAULT true,
  comments BOOLEAN NOT NULL DEFAULT true,
  replies BOOLEAN NOT NULL DEFAULT true,
  mentions BOOLEAN NOT NULL DEFAULT true,
  followers BOOLEAN NOT NULL DEFAULT true,
  matches BOOLEAN NOT NULL DEFAULT true,
  events BOOLEAN NOT NULL DEFAULT true,
  challenges BOOLEAN NOT NULL DEFAULT true,
  stories BOOLEAN NOT NULL DEFAULT true,
  system_announcements BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backfill from profiles.notification_preferences JSONB where possible
INSERT INTO public.notification_preferences (user_id)
SELECT p.id
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.notification_preferences np
SET
  messages = COALESCE((p.notification_preferences->>'message')::boolean, np.messages),
  likes = COALESCE((p.notification_preferences->>'like')::boolean, np.likes),
  comments = COALESCE((p.notification_preferences->>'comment')::boolean, np.comments),
  replies = COALESCE((p.notification_preferences->>'comment_reply')::boolean, np.replies),
  followers = COALESCE((p.notification_preferences->>'follow')::boolean, np.followers),
  matches = COALESCE((p.notification_preferences->>'match')::boolean, np.matches),
  events = COALESCE(
    COALESCE((p.notification_preferences->>'event_join')::boolean, true)
      AND COALESCE((p.notification_preferences->>'event_invite')::boolean, true),
    np.events
  ),
  challenges = COALESCE(
    COALESCE((p.notification_preferences->>'challenge_join')::boolean, true)
      AND COALESCE((p.notification_preferences->>'challenge_invite')::boolean, true),
    np.challenges
  )
FROM public.profiles p
WHERE p.id = np.user_id;

-- ---------------------------------------------------------------------------
-- 3. Multi-channel device subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web_push', 'expo', 'apns', 'fcm', 'email')),
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  device_label TEXT,
  user_agent TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web', 'desktop')),
  app_scope TEXT NOT NULL DEFAULT 'pwa' CHECK (app_scope IN ('pwa', 'expo', 'native')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user
  ON public.notification_subscriptions (user_id)
  WHERE enabled = true;

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification subscriptions"
  ON public.notification_subscriptions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

INSERT INTO public.notification_subscriptions (
  user_id,
  channel,
  endpoint,
  platform,
  app_scope,
  enabled,
  last_seen_at
)
SELECT
  pt.user_id,
  'expo',
  pt.expo_token,
  pt.platform,
  'expo',
  true,
  pt.updated_at
FROM public.push_tokens pt
ON CONFLICT (channel, endpoint) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Delivery log + analytics
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.notification_subscriptions(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'sent', 'delivered', 'failed', 'skipped', 'grouped')
  ),
  skip_reason TEXT,
  grouped_into UUID REFERENCES public.notification_deliveries(id) ON DELETE SET NULL,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_idempotency
  ON public.notification_deliveries (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON public.notification_deliveries (notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_retry
  ON public.notification_deliveries (next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_analytics
  ON public.notification_deliveries (created_at DESC, status);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification deliveries"
  ON public.notification_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.id = notification_id
        AND n.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.notification_deliveries IS
  'Delivery analytics: sent, delivered, opened, dismissed, failed, retry queue.';

-- ---------------------------------------------------------------------------
-- 5. Smart push grouping (messages)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_push_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID,
  notification_ids UUID[] NOT NULL DEFAULT '{}',
  message_count INT NOT NULL DEFAULT 1,
  window_expires_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_groups_active
  ON public.notification_push_groups (user_id, actor_id, conversation_id)
  WHERE delivered_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. create_notification() — single engine entry point
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notification_category_for_type(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type = 'message' THEN 'messages'
    WHEN p_type IN (
      'event_join', 'event_invite', 'event_reminder',
      'training_session_invite', 'training_session_accepted',
      'training_session_reminder', 'workout_reminder'
    ) THEN 'events'
    WHEN p_type IN (
      'challenge_join', 'challenge_invite', 'challenge_reminder', 'challenge_progress'
    ) THEN 'challenges'
    WHEN p_type IN (
      'system_announcement', 'app_update', 'ai_coach', 'nutrition_reminder',
      'habit_reminder', 'achievement_badge', 'daily_streak_reminder',
      'weekly_recap', 'monthly_progress_summary'
    ) THEN 'system'
    ELSE 'social'
  END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_actor_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_deep_link TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_category TEXT;
  v_recent_same INT;
  v_recent_total INT;
BEGIN
  IF p_user_id IS NULL OR p_type IS NULL OR length(trim(p_type)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Never notify yourself
  IF p_actor_id IS NOT NULL AND p_actor_id = p_user_id THEN
    RETURN NULL;
  END IF;

  -- Block relationships
  IF p_actor_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.blocks b
    WHERE (b.blocker_id = p_user_id AND b.blocked_id = p_actor_id)
       OR (b.blocker_id = p_actor_id AND b.blocked_id = p_user_id)
  ) THEN
    RETURN NULL;
  END IF;

  -- Rate limit: abuse protection (max 120 notifications / recipient / minute)
  SELECT COUNT(*) INTO v_recent_total
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.created_at > now() - interval '1 minute';

  IF v_recent_total >= 120 THEN
    RETURN NULL;
  END IF;

  -- Loop prevention: same actor + type burst cap
  IF p_actor_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_recent_same
    FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.type = p_type
      AND n.actor_id = p_actor_id
      AND n.created_at > now() - interval '5 minutes';

    IF v_recent_same >= 30 THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Validate deep link shape
  IF p_deep_link IS NULL OR left(p_deep_link, 1) != '/' OR position('://' in p_deep_link) > 0 THEN
    p_deep_link := '/notifications';
  END IF;

  v_category := public.notification_category_for_type(p_type);

  INSERT INTO public.notifications (
    user_id,
    type,
    payload,
    actor_id,
    entity_type,
    entity_id,
    title,
    body,
    deep_link,
    category,
    dedupe_key,
    expires_at,
    metadata
  ) VALUES (
    p_user_id,
    p_type,
    COALESCE(p_payload, '{}'::jsonb),
    p_actor_id,
    p_entity_type,
    p_entity_id,
    COALESCE(left(p_title, 200), ''),
    COALESCE(left(p_body, 500), ''),
    p_deep_link,
    v_category,
    p_dedupe_key,
    p_expires_at,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.create_notification IS
  'Single notification engine entry point. Creates in-app row; dispatch trigger handles push separately.';

-- ---------------------------------------------------------------------------
-- 7. Migrate message trigger to engine
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member RECORD;
  v_from_training_match boolean;
  v_from_trainer_connection boolean;
  preview_text TEXT;
  v_payload JSONB;
  v_actor_name TEXT;
  v_title TEXT;
  v_body TEXT;
  v_deep_link TEXT;
  v_dedupe TEXT;
BEGIN
  preview_text := CASE
    WHEN NEW.post_id IS NOT NULL THEN 'Shared a post'
    ELSE left(COALESCE(NEW.content, ''), 100)
  END;

  SELECT display_name INTO v_actor_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  v_actor_name := COALESCE(v_actor_name, 'Someone');

  FOR member IN
    SELECT user_id
    FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
      AND user_id != NEW.sender_id
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.status = 'matched'
        AND m.user_a = LEAST(member.user_id, NEW.sender_id)
        AND m.user_b = GREATEST(member.user_id, NEW.sender_id)
    ) INTO v_from_training_match;

    SELECT EXISTS (
      SELECT 1
      FROM public.trainer_connections tc
      WHERE tc.status = 'connected'
        AND (
          (tc.trainer_id = member.user_id AND tc.client_id = NEW.sender_id)
          OR (tc.trainer_id = NEW.sender_id AND tc.client_id = member.user_id)
        )
    ) INTO v_from_trainer_connection;

    v_payload := jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'message_id', NEW.id,
      'preview', preview_text,
      'post_id', NEW.post_id,
      'from_training_match', v_from_training_match,
      'from_trainer_connection', v_from_trainer_connection
    );

    IF v_from_training_match THEN
      v_title := 'Training partner message';
    ELSIF v_from_trainer_connection THEN
      v_title := 'Coach message';
    ELSE
      v_title := 'New message';
    END IF;

    IF preview_text IS NOT NULL AND preview_text != '' THEN
      v_body := v_actor_name || ': ' || preview_text;
    ELSE
      v_body := v_actor_name || ' sent you a message';
    END IF;

    v_deep_link := '/chat/' || NEW.conversation_id::text;
    v_dedupe := 'message:' || NEW.id::text || ':' || member.user_id::text;

    PERFORM public.create_notification(
      p_user_id := member.user_id,
      p_type := 'message',
      p_actor_id := NEW.sender_id,
      p_entity_type := 'conversation',
      p_entity_id := NEW.conversation_id,
      p_title := v_title,
      p_body := v_body,
      p_deep_link := v_deep_link,
      p_payload := v_payload,
      p_dedupe_key := v_dedupe
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Auto-create preferences for new users
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_notification_preferences ON public.profiles;
CREATE TRIGGER on_profile_notification_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_notification_preferences();
