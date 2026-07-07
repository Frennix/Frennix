-- Phase 1: Migrate all notification triggers to create_notification() engine.
-- Adds type validation, client RPC, trainer RPC updates, extended notification types.

-- ---------------------------------------------------------------------------
-- 1. Type validation (extensible without schema migrations)
-- ---------------------------------------------------------------------------

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

CREATE OR REPLACE FUNCTION public.is_valid_notification_type(p_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_type = ANY (ARRAY[
    'follow', 'message', 'like', 'reaction', 'comment', 'comment_reply', 'mention',
    'match', 'trainer_connection_request', 'trainer_connection_accepted',
    'group_invite', 'challenge_reminder', 'challenge_join', 'challenge_invite',
    'challenge_progress', 'event_join', 'event_invite', 'event_reminder',
    'post_share', 'story_train_invite', 'story_reaction', 'story_reply',
    'story_mention', 'story_challenge_join', 'training_session_invite',
    'training_session_accepted', 'training_session_reminder', 'workout_reminder',
    'system_announcement', 'app_update', 'friend_request',
    'ai_coach', 'nutrition_reminder', 'habit_reminder', 'achievement_badge',
    'daily_streak_reminder', 'weekly_recap', 'monthly_progress_summary'
  ]::text[]);
$$;

-- ---------------------------------------------------------------------------
-- 2. Harden create_notification with type validation
-- ---------------------------------------------------------------------------

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

  IF NOT public.is_valid_notification_type(p_type) THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type;
  END IF;

  IF p_actor_id IS NOT NULL AND p_actor_id = p_user_id THEN
    RETURN NULL;
  END IF;

  IF p_actor_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.blocks b
    WHERE (b.blocker_id = p_user_id AND b.blocked_id = p_actor_id)
       OR (b.blocker_id = p_actor_id AND b.blocked_id = p_user_id)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_recent_total
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.created_at > now() - interval '1 minute';

  IF v_recent_total >= 120 THEN
    RETURN NULL;
  END IF;

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

  IF p_deep_link IS NULL OR left(p_deep_link, 1) != '/' OR position('://' in p_deep_link) > 0 THEN
    p_deep_link := '/notifications';
  END IF;

  v_category := public.notification_category_for_type(p_type);

  INSERT INTO public.notifications (
    user_id, type, payload, actor_id, entity_type, entity_id,
    title, body, deep_link, category, dedupe_key, expires_at, metadata
  ) VALUES (
    p_user_id, p_type, COALESCE(p_payload, '{}'::jsonb), p_actor_id, p_entity_type, p_entity_id,
    COALESCE(left(p_title, 200), ''), COALESCE(left(p_body, 500), ''),
    p_deep_link, v_category, p_dedupe_key, p_expires_at, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Client-safe RPC (story engagement etc.)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_app_notification(
  p_user_id UUID,
  p_type TEXT,
  p_actor_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_deep_link TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Not authorized to create notification';
  END IF;

  IF p_type NOT IN (
    'story_reaction', 'story_reply', 'story_mention', 'story_challenge_join'
  ) THEN
    RAISE EXCEPTION 'Notification type not allowed from client: %', p_type;
  END IF;

  RETURN public.create_notification(
    p_user_id, p_type, p_actor_id, p_entity_type, p_entity_id,
    p_title, p_body, p_deep_link, p_payload, p_dedupe_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_app_notification TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Trigger migrations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
  v_username TEXT;
  v_payload JSONB;
BEGIN
  SELECT display_name, username INTO v_actor_name, v_username
  FROM public.profiles WHERE id = NEW.follower_id;

  v_actor_name := COALESCE(v_actor_name, 'Someone');
  v_payload := jsonb_build_object('follower_id', NEW.follower_id);

  PERFORM public.create_notification(
    p_user_id := NEW.following_id,
    p_type := 'follow',
    p_actor_id := NEW.follower_id,
    p_entity_type := 'profile',
    p_entity_id := NEW.follower_id,
    p_title := 'New follower',
    p_body := v_actor_name || ' started following you',
    p_deep_link := CASE
      WHEN v_username IS NOT NULL THEN '/user/' || v_username
      ELSE '/notifications'
    END,
    p_payload := v_payload,
    p_dedupe_key := 'follow:' || NEW.follower_id::text || ':' || NEW.following_id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author UUID;
  v_actor_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;

  IF post_author IS NULL OR post_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');
  v_payload := jsonb_build_object('post_id', NEW.post_id, 'user_id', NEW.user_id);

  PERFORM public.create_notification(
    p_user_id := post_author,
    p_type := 'like',
    p_actor_id := NEW.user_id,
    p_entity_type := 'post',
    p_entity_id := NEW.post_id,
    p_title := 'New like',
    p_body := v_actor_name || ' liked your post',
    p_deep_link := '/post/' || NEW.post_id::text,
    p_payload := v_payload,
    p_dedupe_key := 'like:' || NEW.post_id::text || ':' || NEW.user_id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_post_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author UUID;
  v_actor_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;

  IF post_author IS NULL OR post_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');
  v_payload := jsonb_build_object('post_id', NEW.post_id, 'user_id', NEW.user_id, 'emoji', NEW.emoji);

  PERFORM public.create_notification(
    p_user_id := post_author,
    p_type := 'reaction',
    p_actor_id := NEW.user_id,
    p_entity_type := 'post',
    p_entity_id := NEW.post_id,
    p_title := 'New reaction',
    p_body := v_actor_name || ' reacted ' || COALESCE(NEW.emoji, '😊') || ' to your post',
    p_deep_link := '/post/' || NEW.post_id::text,
    p_payload := v_payload,
    p_dedupe_key := 'reaction:' || NEW.post_id::text || ':' || NEW.user_id::text || ':' || COALESCE(NEW.emoji, '')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author UUID;
  parent_author UUID;
  v_actor_name TEXT;
  v_payload JSONB;
  v_deep_link TEXT;
BEGIN
  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.author_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');

  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO parent_author FROM public.comments WHERE id = NEW.parent_id;

    IF parent_author IS NOT NULL AND parent_author != NEW.author_id THEN
      v_payload := jsonb_build_object(
        'post_id', NEW.post_id,
        'comment_id', NEW.id,
        'parent_id', NEW.parent_id,
        'author_id', NEW.author_id
      );
      v_deep_link := '/post/' || NEW.post_id::text || '?commentId=' || NEW.id::text;

      PERFORM public.create_notification(
        p_user_id := parent_author,
        p_type := 'comment_reply',
        p_actor_id := NEW.author_id,
        p_entity_type := 'comment',
        p_entity_id := NEW.id,
        p_title := 'New reply',
        p_body := v_actor_name || ' replied to your comment',
        p_deep_link := v_deep_link,
        p_payload := v_payload,
        p_dedupe_key := 'comment_reply:' || NEW.id::text || ':' || parent_author::text
      );
    END IF;
  ELSE
    SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;

    IF post_author IS NOT NULL AND post_author != NEW.author_id THEN
      v_payload := jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'author_id', NEW.author_id);
      v_deep_link := '/post/' || NEW.post_id::text || '?commentId=' || NEW.id::text;

      PERFORM public.create_notification(
        p_user_id := post_author,
        p_type := 'comment',
        p_actor_id := NEW.author_id,
        p_entity_type := 'post',
        p_entity_id := NEW.post_id,
        p_title := 'New comment',
        p_body := v_actor_name || ' commented on your post',
        p_deep_link := v_deep_link,
        p_payload := v_payload,
        p_dedupe_key := 'comment:' || NEW.id::text || ':' || post_author::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_a_name TEXT;
  v_actor_b_name TEXT;
BEGIN
  IF NEW.status = 'matched' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'matched') THEN
    SELECT display_name INTO v_actor_b_name FROM public.profiles WHERE id = NEW.user_b;
    SELECT display_name INTO v_actor_a_name FROM public.profiles WHERE id = NEW.user_a;
    v_actor_b_name := COALESCE(v_actor_b_name, 'Someone');
    v_actor_a_name := COALESCE(v_actor_a_name, 'Someone');

    PERFORM public.create_notification(
      p_user_id := NEW.user_a,
      p_type := 'match',
      p_actor_id := NEW.user_b,
      p_entity_type := 'profile',
      p_entity_id := NEW.user_b,
      p_title := 'New Training Match',
      p_body := 'You and ' || v_actor_b_name || ' are ready to train together.',
      p_deep_link := '/matching/matches',
      p_payload := jsonb_build_object('matched_user_id', NEW.user_b, 'match_id', NEW.id),
      p_dedupe_key := 'match:' || NEW.id::text || ':' || NEW.user_a::text
    );

    PERFORM public.create_notification(
      p_user_id := NEW.user_b,
      p_type := 'match',
      p_actor_id := NEW.user_a,
      p_entity_type := 'profile',
      p_entity_id := NEW.user_a,
      p_title := 'New Training Match',
      p_body := 'You and ' || v_actor_a_name || ' are ready to train together.',
      p_deep_link := '/matching/matches',
      p_payload := jsonb_build_object('matched_user_id', NEW.user_a, 'match_id', NEW.id),
      p_dedupe_key := 'match:' || NEW.id::text || ':' || NEW.user_b::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_event_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_creator UUID;
  event_title TEXT;
  v_actor_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT created_by, title INTO event_creator, event_title
  FROM public.events
  WHERE id = NEW.event_id;

  IF event_creator IS NULL OR event_creator = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');
  v_payload := jsonb_build_object('event_id', NEW.event_id, 'user_id', NEW.user_id, 'event_title', event_title);

  PERFORM public.create_notification(
    p_user_id := event_creator,
    p_type := 'event_join',
    p_actor_id := NEW.user_id,
    p_entity_type := 'event',
    p_entity_id := NEW.event_id,
    p_title := 'Event join',
    p_body := CASE
      WHEN event_title IS NOT NULL THEN v_actor_name || ' joined your event "' || event_title || '"'
      ELSE v_actor_name || ' joined your workout event'
    END,
    p_deep_link := '/event/' || NEW.event_id::text,
    p_payload := v_payload,
    p_dedupe_key := 'event_join:' || NEW.event_id::text || ':' || NEW.user_id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_event_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_title TEXT;
  v_actor_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT title INTO event_title FROM public.events WHERE id = NEW.event_id;
  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.inviter_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');
  v_payload := jsonb_build_object('event_id', NEW.event_id, 'inviter_id', NEW.inviter_id, 'event_title', event_title);

  PERFORM public.create_notification(
    p_user_id := NEW.invitee_id,
    p_type := 'event_invite',
    p_actor_id := NEW.inviter_id,
    p_entity_type := 'event',
    p_entity_id := NEW.event_id,
    p_title := 'Event invitation',
    p_body := CASE
      WHEN event_title IS NOT NULL THEN v_actor_name || ' invited you to "' || event_title || '"'
      ELSE v_actor_name || ' invited you to a workout event'
    END,
    p_deep_link := '/event/' || NEW.event_id::text,
    p_payload := v_payload,
    p_dedupe_key := 'event_invite:' || NEW.event_id::text || ':' || NEW.invitee_id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_challenge_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_creator UUID;
  challenge_title TEXT;
  v_actor_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT created_by, title INTO challenge_creator, challenge_title
  FROM public.challenges
  WHERE id = NEW.challenge_id;

  IF challenge_creator IS NULL OR challenge_creator = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');
  v_payload := jsonb_build_object('challenge_id', NEW.challenge_id, 'user_id', NEW.user_id, 'challenge_title', challenge_title);

  PERFORM public.create_notification(
    p_user_id := challenge_creator,
    p_type := 'challenge_join',
    p_actor_id := NEW.user_id,
    p_entity_type := 'challenge',
    p_entity_id := NEW.challenge_id,
    p_title := 'Challenge join',
    p_body := CASE
      WHEN challenge_title IS NOT NULL THEN v_actor_name || ' joined your challenge "' || challenge_title || '"'
      ELSE v_actor_name || ' joined your challenge'
    END,
    p_deep_link := '/challenge/' || NEW.challenge_id::text,
    p_payload := v_payload,
    p_dedupe_key := 'challenge_join:' || NEW.challenge_id::text || ':' || NEW.user_id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_challenge_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_title TEXT;
  inviter_username TEXT;
  v_actor_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT title INTO challenge_title FROM public.challenges WHERE id = NEW.challenge_id;
  SELECT username, display_name INTO inviter_username, v_actor_name
  FROM public.profiles WHERE id = NEW.inviter_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');
  v_payload := jsonb_build_object(
    'challenge_id', NEW.challenge_id,
    'inviter_id', NEW.inviter_id,
    'inviter_username', inviter_username,
    'challenge_title', challenge_title
  );

  PERFORM public.create_notification(
    p_user_id := NEW.invitee_id,
    p_type := 'challenge_invite',
    p_actor_id := NEW.inviter_id,
    p_entity_type := 'challenge',
    p_entity_id := NEW.challenge_id,
    p_title := 'Challenge invitation',
    p_body := CASE
      WHEN challenge_title IS NOT NULL THEN
        COALESCE('@' || inviter_username, v_actor_name) || ' invited you to join "' || challenge_title || '"'
      ELSE COALESCE('@' || inviter_username, v_actor_name) || ' invited you to join a challenge'
    END,
    p_deep_link := '/challenge/' || NEW.challenge_id::text,
    p_payload := v_payload,
    p_dedupe_key := 'challenge_invite:' || NEW.challenge_id::text || ':' || NEW.invitee_id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_post_share()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_post_id UUID;
  original_author UUID;
  sharer_id UUID;
  dest_type TEXT;
  dest_id UUID;
  dest_name TEXT;
  v_actor_name TEXT;
  v_payload JSONB;
  v_body TEXT;
BEGIN
  IF TG_TABLE_NAME = 'messages' THEN
    IF NEW.post_id IS NULL THEN
      RETURN NEW;
    END IF;
    original_post_id := NEW.post_id;
    sharer_id := NEW.sender_id;
    dest_type := 'message';
    dest_id := NEW.conversation_id;
  ELSE
    IF NEW.shared_post_id IS NULL THEN
      RETURN NEW;
    END IF;
    original_post_id := NEW.shared_post_id;
    sharer_id := NEW.author_id;
    IF NEW.group_id IS NOT NULL THEN
      dest_type := 'group';
      dest_id := NEW.group_id;
      SELECT name INTO dest_name FROM public.groups WHERE id = NEW.group_id;
    ELSIF NEW.challenge_id IS NOT NULL THEN
      dest_type := 'challenge';
      dest_id := NEW.challenge_id;
      SELECT title INTO dest_name FROM public.challenges WHERE id = NEW.challenge_id;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT author_id INTO original_author FROM public.posts WHERE id = original_post_id;
  IF original_author IS NULL OR original_author = sharer_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = sharer_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');

  v_payload := jsonb_build_object(
    'post_id', original_post_id,
    'sharer_id', sharer_id,
    'destination', dest_type,
    'destination_id', dest_id,
    'destination_name', dest_name,
    'conversation_id', CASE WHEN dest_type = 'message' THEN dest_id ELSE NULL END
  );

  v_body := CASE
    WHEN dest_type = 'message' THEN v_actor_name || ' shared your post in a message'
    WHEN dest_name IS NOT NULL THEN v_actor_name || ' shared your post in ' || dest_name
    ELSE v_actor_name || ' shared your post'
  END;

  PERFORM public.create_notification(
    p_user_id := original_author,
    p_type := 'post_share',
    p_actor_id := sharer_id,
    p_entity_type := 'post',
    p_entity_id := original_post_id,
    p_title := 'Post shared',
    p_body := v_body,
    p_deep_link := '/post/' || original_post_id::text,
    p_payload := v_payload,
    p_dedupe_key := 'post_share:' || original_post_id::text || ':' || sharer_id::text || ':' || dest_type || ':' || COALESCE(dest_id::text, '')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_training_session_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_title TEXT;
  inviter_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT title INTO session_title
  FROM public.training_calendar_items
  WHERE id = NEW.calendar_item_id;

  SELECT display_name INTO inviter_name
  FROM public.profiles
  WHERE id = NEW.inviter_id;

  inviter_name := COALESCE(inviter_name, 'Someone');
  session_title := COALESCE(session_title, 'Training session');

  v_payload := jsonb_build_object(
    'calendar_item_id', NEW.calendar_item_id,
    'invite_id', NEW.id,
    'inviter_id', NEW.inviter_id,
    'inviter_name', inviter_name,
    'session_title', session_title,
    'preview', inviter_name || ' invited you to train.'
  );

  PERFORM public.create_notification(
    p_user_id := NEW.invitee_id,
    p_type := 'training_session_invite',
    p_actor_id := NEW.inviter_id,
    p_entity_type := 'event',
    p_entity_id := NEW.calendar_item_id,
    p_title := 'Training invite',
    p_body := inviter_name || ' invited you to "' || session_title || '"',
    p_deep_link := '/(tabs)/events',
    p_payload := v_payload,
    p_dedupe_key := 'training_session_invite:' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_training_session_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_title TEXT;
  invitee_name TEXT;
  v_payload JSONB;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO session_title
  FROM public.training_calendar_items
  WHERE id = NEW.calendar_item_id;

  SELECT display_name INTO invitee_name
  FROM public.profiles
  WHERE id = NEW.invitee_id;

  invitee_name := COALESCE(invitee_name, 'Your partner');
  session_title := COALESCE(session_title, 'Training session');

  v_payload := jsonb_build_object(
    'calendar_item_id', NEW.calendar_item_id,
    'invite_id', NEW.id,
    'invitee_id', NEW.invitee_id,
    'invitee_name', invitee_name,
    'session_title', session_title,
    'preview', invitee_name || ' accepted your training invite.'
  );

  PERFORM public.create_notification(
    p_user_id := NEW.inviter_id,
    p_type := 'training_session_accepted',
    p_actor_id := NEW.invitee_id,
    p_entity_type := 'event',
    p_entity_id := NEW.calendar_item_id,
    p_title := 'Invite accepted',
    p_body := invitee_name || ' accepted "' || session_title || '"',
    p_deep_link := '/(tabs)/events',
    p_payload := v_payload,
    p_dedupe_key := 'training_session_accepted:' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Trainer connection RPCs → engine
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_trainer_connection(
  p_trainer_id UUID,
  p_intro_message TEXT DEFAULT NULL
)
RETURNS public.trainer_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID := auth.uid();
  v_trainer public.trainer_profiles%ROWTYPE;
  v_row public.trainer_connections%ROWTYPE;
  v_actor_name TEXT;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_client_id = p_trainer_id THEN
    RAISE EXCEPTION 'You cannot connect with yourself';
  END IF;

  IF public.users_are_blocked(v_client_id, p_trainer_id) THEN
    RAISE EXCEPTION 'You cannot connect with this trainer';
  END IF;

  SELECT * INTO v_trainer FROM public.trainer_profiles WHERE user_id = p_trainer_id;
  IF NOT FOUND OR v_trainer.discovery_enabled = false THEN
    RAISE EXCEPTION 'Trainer is not available';
  END IF;

  IF v_trainer.availability_status = 'not_accepting' THEN
    RAISE EXCEPTION 'This trainer is not accepting new clients';
  END IF;

  INSERT INTO public.trainer_connections (trainer_id, client_id, status, initiated_by, intro_message)
  VALUES (p_trainer_id, v_client_id, 'pending', v_client_id, p_intro_message)
  ON CONFLICT (trainer_id, client_id) DO UPDATE SET
    status = CASE
      WHEN trainer_connections.status IN ('declined', 'removed') THEN 'pending'
      ELSE trainer_connections.status
    END,
    intro_message = EXCLUDED.intro_message,
    initiated_by = EXCLUDED.initiated_by,
    updated_at = now()
  WHERE trainer_connections.status IN ('declined', 'removed')
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.trainer_connections
    WHERE trainer_id = p_trainer_id AND client_id = v_client_id;
  END IF;

  IF v_row.status = 'pending' AND v_row.initiated_by = v_client_id THEN
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_client_id;
    v_actor_name := COALESCE(v_actor_name, 'Someone');

    PERFORM public.create_notification(
      p_user_id := p_trainer_id,
      p_type := 'trainer_connection_request',
      p_actor_id := v_client_id,
      p_entity_type := 'profile',
      p_entity_id := v_client_id,
      p_title := 'New coaching request',
      p_body := v_actor_name || ' requested to connect for coaching.',
      p_deep_link := '/trainers/connections',
      p_payload := jsonb_build_object(
        'connection_id', v_row.id,
        'client_id', v_client_id,
        'intro_message', p_intro_message
      ),
      p_dedupe_key := 'trainer_connection_request:' || v_row.id::text
    );
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_trainer_connection(
  p_connection_id UUID,
  p_accept BOOLEAN
)
RETURNS public.trainer_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_id UUID := auth.uid();
  v_row public.trainer_connections%ROWTYPE;
  v_new_status public.trainer_connection_status;
  v_actor_name TEXT;
BEGIN
  IF v_trainer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.trainer_connections WHERE id = p_connection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  IF v_row.trainer_id <> v_trainer_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  v_new_status := CASE WHEN p_accept THEN 'connected'::public.trainer_connection_status
                       ELSE 'declined'::public.trainer_connection_status END;

  UPDATE public.trainer_connections
  SET status = v_new_status, updated_at = now()
  WHERE id = p_connection_id
  RETURNING * INTO v_row;

  IF p_accept THEN
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_row.trainer_id;
    v_actor_name := COALESCE(v_actor_name, 'Someone');

    PERFORM public.create_notification(
      p_user_id := v_row.client_id,
      p_type := 'trainer_connection_accepted',
      p_actor_id := v_row.trainer_id,
      p_entity_type := 'profile',
      p_entity_id := v_row.trainer_id,
      p_title := 'Coaching request accepted',
      p_body := v_actor_name || ' accepted your coaching request.',
      p_deep_link := '/trainers/connections',
      p_payload := jsonb_build_object(
        'connection_id', v_row.id,
        'trainer_id', v_row.trainer_id
      ),
      p_dedupe_key := 'trainer_connection_accepted:' || v_row.id::text
    );
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Preference table policies (insert for own row on signup already handled)
-- ---------------------------------------------------------------------------

CREATE POLICY "Users insert own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Sync legacy JSONB when dedicated preferences update (dual-write bridge)
CREATE OR REPLACE FUNCTION public.sync_legacy_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET notification_preferences = jsonb_build_object(
    'message', NEW.messages,
    'like', NEW.likes,
    'comment', NEW.comments,
    'comment_reply', NEW.replies,
    'follow', NEW.followers,
    'match', NEW.matches,
    'event_join', NEW.events,
    'event_invite', NEW.events,
    'challenge_join', NEW.challenges,
    'challenge_invite', NEW.challenges,
    'post_share', true,
    'trainer_connection_request', NEW.matches,
    'trainer_connection_accepted', NEW.matches,
    'story_reaction', NEW.stories,
    'story_reply', NEW.stories
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_preferences_legacy_sync ON public.notification_preferences;
CREATE TRIGGER on_notification_preferences_legacy_sync
  AFTER INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_legacy_notification_preferences();
