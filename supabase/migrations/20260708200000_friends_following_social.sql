-- Friends & Following: social graph, favorites, enhanced discover search, notifications.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Profile extensions
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS friend_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (friend_mode IN ('open', 'request_required'));

COMMENT ON COLUMN public.profiles.friend_mode IS
  'open: anyone can add as friend directly when accepted; request_required: must send friend request.';

-- ---------------------------------------------------------------------------
-- Social graph tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pair_idx
  ON public.friend_requests (requester_id, recipient_id);

CREATE INDEX IF NOT EXISTS friend_requests_recipient_pending_idx
  ON public.friend_requests (recipient_id, created_at DESC)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.friendships (
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS friendships_user_b_idx ON public.friendships (user_b);

CREATE TABLE IF NOT EXISTS public.profile_favorites (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  pinned_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, favorite_user_id),
  CHECK (user_id <> favorite_user_id)
);

CREATE INDEX IF NOT EXISTS profile_favorites_pinned_idx
  ON public.profile_favorites (user_id, is_pinned DESC, pinned_at DESC NULLS LAST, sort_order);

-- Search indexes
CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_city_trgm_idx
  ON public.profiles USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_state_trgm_idx
  ON public.profiles USING gin (state gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.friend_pair(a UUID, b UUID)
RETURNS TABLE(user_a UUID, user_b UUID)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(a, b), GREATEST(a, b);
$$;

CREATE OR REPLACE FUNCTION public.users_are_friends(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.user_a = LEAST(a, b) AND f.user_b = GREATEST(a, b)
  );
$$;

CREATE OR REPLACE FUNCTION public.count_user_friends(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM public.friendships f
  WHERE f.user_a = p_user_id OR f.user_b = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.count_mutual_friends(p_viewer_id UUID, p_target_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer_friends AS (
    SELECT CASE WHEN f.user_a = p_viewer_id THEN f.user_b ELSE f.user_a END AS friend_id
    FROM public.friendships f
    WHERE f.user_a = p_viewer_id OR f.user_b = p_viewer_id
  ),
  target_friends AS (
    SELECT CASE WHEN f.user_a = p_target_id THEN f.user_b ELSE f.user_a END AS friend_id
    FROM public.friendships f
    WHERE f.user_a = p_target_id OR f.user_b = p_target_id
  )
  SELECT COUNT(*)::INT
  FROM viewer_friends vf
  JOIN target_friends tf ON vf.friend_id = tf.friend_id;
$$;

CREATE OR REPLACE FUNCTION public.friend_id_for(p_user_id UUID, p_row public.friendships)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_row.user_a = p_user_id THEN p_row.user_b ELSE p_row.user_a END;
$$;

CREATE OR REPLACE FUNCTION public.expand_discover_search_keywords(p_query TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm TEXT := lower(btrim(COALESCE(p_query, '')));
  v_tokens TEXT[] := ARRAY[]::TEXT[];
  v_token TEXT;
BEGIN
  IF length(v_norm) < 2 THEN
    RETURN ARRAY[v_norm];
  END IF;

  v_tokens := v_tokens || v_norm;

  FOR v_token IN SELECT unnest(regexp_split_to_array(v_norm, '\s+'))
  LOOP
    IF length(v_token) >= 2 THEN
      v_tokens := v_tokens || v_token;
    END IF;
  END LOOP;

  -- Keyword aliases for lifestyle, sports, and profile roles.
  IF v_norm ~ '(trainer|coach|certified)' THEN
    v_tokens := v_tokens || ARRAY['trainer', 'coach', 'is_trainer'];
  END IF;
  IF v_norm ~ '(parent|mom|dad|mother|father)' THEN
    v_tokens := v_tokens || ARRAY['parent', 'mom', 'dad', 'parent_status'];
  END IF;
  IF v_norm ~ 'running|runner|run\b' THEN v_tokens := v_tokens || ARRAY['running', 'run']; END IF;
  IF v_norm ~ 'hiking|hiker|hike\b' THEN v_tokens := v_tokens || ARRAY['hiking', 'hike']; END IF;
  IF v_norm ~ 'powerlifting|powerlift|power lifter' THEN v_tokens := v_tokens || ARRAY['powerlifting']; END IF;
  IF v_norm ~ 'bodybuilding|bodybuilder|body build' THEN v_tokens := v_tokens || ARRAY['bodybuilding']; END IF;
  IF v_norm ~ 'yoga' THEN v_tokens := v_tokens || ARRAY['yoga']; END IF;
  IF v_norm ~ 'crossfit|cross fit' THEN v_tokens := v_tokens || ARRAY['crossfit']; END IF;
  IF v_norm ~ 'cycling|cyclist|bike|biking' THEN v_tokens := v_tokens || ARRAY['cycling', 'bike']; END IF;
  IF v_norm ~ 'basketball|hoops' THEN v_tokens := v_tokens || ARRAY['basketball']; END IF;
  IF v_norm ~ 'tennis' THEN v_tokens := v_tokens || ARRAY['tennis']; END IF;
  IF v_norm ~ 'pickleball|pickle ball' THEN v_tokens := v_tokens || ARRAY['pickleball']; END IF;
  IF v_norm ~ 'swimming|swimmer|swim\b' THEN v_tokens := v_tokens || ARRAY['swimming', 'swim']; END IF;

  RETURN ARRAY(SELECT DISTINCT unnest(v_tokens));
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_matches_discover_query(p public.profiles, p_query TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query TEXT := btrim(COALESCE(p_query, ''));
  v_tokens TEXT[];
  v_token TEXT;
  v_sim REAL;
BEGIN
  IF length(v_query) < 2 THEN
    RETURN true;
  END IF;

  v_tokens := public.expand_discover_search_keywords(v_query);

  FOREACH v_token IN ARRAY v_tokens
  LOOP
    IF length(v_token) < 2 THEN CONTINUE; END IF;

    IF p.display_name ILIKE '%' || v_token || '%'
      OR p.username ILIKE '%' || v_token || '%'
      OR COALESCE(p.bio, '') ILIKE '%' || v_token || '%'
      OR COALESCE(p.city, '') ILIKE '%' || v_token || '%'
      OR COALESCE(p.state, '') ILIKE '%' || v_token || '%'
      OR COALESCE(p.home_gym, '') ILIKE '%' || v_token || '%'
      OR COALESCE(p.match_preference::text, '') ILIKE '%' || v_token || '%'
      OR COALESCE(p.training_environment::text, '') ILIKE '%' || v_token || '%'
      OR COALESCE(p.parent_status::text, '') ILIKE '%' || v_token || '%'
      OR COALESCE(p.parent_type::text, '') ILIKE '%' || v_token || '%'
      OR (v_token IN ('trainer', 'coach', 'is_trainer') AND COALESCE(p.is_trainer, false))
      OR (v_token IN ('parent', 'mom', 'dad') AND p.parent_status IS NOT NULL)
      OR (v_token = 'mom' AND p.parent_type = 'mom')
      OR (v_token = 'dad' AND p.parent_type = 'dad')
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.activities, '{}')) AS activity
        WHERE activity ILIKE '%' || v_token || '%'
          OR replace(activity, '_', ' ') ILIKE '%' || v_token || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.fitness_goals, '{}')) AS goal
        WHERE goal ILIKE '%' || v_token || '%'
          OR replace(goal, '_', ' ') ILIKE '%' || v_token || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.lifestyle_tags, '{}')) AS tag
        WHERE tag ILIKE '%' || v_token || '%'
      )
    THEN
      RETURN true;
    END IF;
  END LOOP;

  -- Typo tolerance via trigram similarity on name/username.
  v_sim := GREATEST(
    similarity(COALESCE(p.display_name, ''), v_query),
    similarity(COALESCE(p.username, ''), v_query)
  );
  RETURN v_sim >= 0.28;
END;
$$;

-- ---------------------------------------------------------------------------
-- Notification types
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
    'system_announcement', 'app_update', 'friend_request', 'friend_accepted',
    'profile_favorited', 'mutual_friend_joined', 'referral_reward',
    'marketing',
    'ai_coach', 'nutrition_reminder', 'habit_reminder', 'achievement_badge',
    'daily_streak_reminder', 'weekly_recap', 'monthly_progress_summary'
  ]::text[]);
$$;

-- ---------------------------------------------------------------------------
-- Friend request RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_requester_id UUID,
  p_recipient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
BEGIN
  IF p_requester_id IS NULL OR p_recipient_id IS NULL THEN
    RAISE EXCEPTION 'Invalid user ids';
  END IF;
  IF p_requester_id = p_recipient_id THEN
    RAISE EXCEPTION 'Cannot friend yourself';
  END IF;
  IF public.users_are_blocked(p_requester_id, p_recipient_id) THEN
    RAISE EXCEPTION 'User unavailable';
  END IF;
  IF public.users_are_friends(p_requester_id, p_recipient_id) THEN
    RETURN jsonb_build_object('status', 'friends');
  END IF;

  SELECT friend_mode INTO v_mode FROM public.profiles WHERE id = p_recipient_id;

  INSERT INTO public.friend_requests (requester_id, recipient_id, status)
  VALUES (p_requester_id, p_recipient_id, 'pending')
  ON CONFLICT (requester_id, recipient_id) DO UPDATE
  SET status = 'pending', updated_at = now()
  WHERE public.friend_requests.status IN ('declined', 'cancelled');

  RETURN jsonb_build_object('status', 'pending', 'friend_mode', COALESCE(v_mode, 'open'));
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(
  p_recipient_id UUID,
  p_requester_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair RECORD;
BEGIN
  UPDATE public.friend_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      updated_at = now()
  WHERE requester_id = p_requester_id
    AND recipient_id = p_recipient_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF p_accept THEN
    SELECT * INTO v_pair FROM public.friend_pair(p_requester_id, p_recipient_id);
    INSERT INTO public.friendships (user_a, user_b)
    VALUES (v_pair.user_a, v_pair.user_b)
    ON CONFLICT DO NOTHING;

    -- Auto-follow both directions for tighter social graph.
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (p_requester_id, p_recipient_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (p_recipient_id, p_requester_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_friend_request(
  p_requester_id UUID,
  p_recipient_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.friend_requests
  SET status = 'cancelled', updated_at = now()
  WHERE requester_id = p_requester_id
    AND recipient_id = p_recipient_id
    AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_user_id UUID, p_friend_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair RECORD;
BEGIN
  SELECT * INTO v_pair FROM public.friend_pair(p_user_id, p_friend_id);
  DELETE FROM public.friendships
  WHERE user_a = v_pair.user_a AND user_b = v_pair.user_b;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_friend_direct(
  p_user_id UUID,
  p_friend_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair RECORD;
  v_mode TEXT;
BEGIN
  IF p_user_id = p_friend_id THEN RAISE EXCEPTION 'Cannot friend yourself'; END IF;
  IF public.users_are_blocked(p_user_id, p_friend_id) THEN RAISE EXCEPTION 'User unavailable'; END IF;

  SELECT friend_mode INTO v_mode FROM public.profiles WHERE id = p_friend_id;
  IF COALESCE(v_mode, 'open') = 'request_required' THEN
    RETURN public.send_friend_request(p_user_id, p_friend_id);
  END IF;

  SELECT * INTO v_pair FROM public.friend_pair(p_user_id, p_friend_id);
  INSERT INTO public.friendships (user_a, user_b)
  VALUES (v_pair.user_a, v_pair.user_b)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (p_user_id, p_friend_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('status', 'friends');
END;
$$;

-- ---------------------------------------------------------------------------
-- Paginated social lists
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_friends_page(
  p_user_id UUID,
  p_viewer_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 30,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 60);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_total INT;
  v_items JSONB;
BEGIN
  WITH friend_ids AS (
    SELECT CASE WHEN f.user_a = p_user_id THEN f.user_b ELSE f.user_a END AS friend_id, f.created_at
    FROM public.friendships f
    WHERE f.user_a = p_user_id OR f.user_b = p_user_id
  ),
  filtered AS (
    SELECT fi.friend_id, fi.created_at
    FROM friend_ids fi
    JOIN public.profiles p ON p.id = fi.friend_id
    WHERE NOT COALESCE(p.is_banned, false)
      AND (p_viewer_id IS NULL OR NOT public.users_are_blocked(p_viewer_id, fi.friend_id))
  ),
  counted AS (SELECT COUNT(*)::INT AS total FROM filtered),
  page AS (
    SELECT friend_id FROM filtered ORDER BY created_at DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(public.profile_for_viewer(p, p_viewer_id) ORDER BY p.display_name)
       FROM page pg JOIN public.profiles p ON p.id = pg.friend_id),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', COALESCE(v_total, 0),
    'has_more', (v_offset + v_limit) < COALESCE(v_total, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_requests_page(
  p_user_id UUID,
  p_direction TEXT DEFAULT 'incoming',
  p_limit INT DEFAULT 30,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 60);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_total INT;
  v_items JSONB;
BEGIN
  WITH base AS (
    SELECT fr.*,
      CASE WHEN p_direction = 'incoming' THEN fr.requester_id ELSE fr.recipient_id END AS other_id
    FROM public.friend_requests fr
    WHERE fr.status = 'pending'
      AND (
        (p_direction = 'incoming' AND fr.recipient_id = p_user_id)
        OR (p_direction = 'outgoing' AND fr.requester_id = p_user_id)
      )
  ),
  counted AS (SELECT COUNT(*)::INT AS total FROM base),
  page AS (
    SELECT * FROM base ORDER BY created_at DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', pg.id,
          'status', pg.status,
          'created_at', pg.created_at,
          'profile', public.profile_for_viewer(p, p_user_id)
        ) ORDER BY pg.created_at DESC
      )
      FROM page pg JOIN public.profiles p ON p.id = pg.other_id),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', COALESCE(v_total, 0),
    'has_more', (v_offset + v_limit) < COALESCE(v_total, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mutual_friends_page(
  p_viewer_id UUID,
  p_target_id UUID,
  p_limit INT DEFAULT 30,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 60);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_total INT;
  v_items JSONB;
BEGIN
  WITH viewer_friends AS (
    SELECT CASE WHEN f.user_a = p_viewer_id THEN f.user_b ELSE f.user_a END AS friend_id
    FROM public.friendships f
    WHERE f.user_a = p_viewer_id OR f.user_b = p_viewer_id
  ),
  target_friends AS (
    SELECT CASE WHEN f.user_a = p_target_id THEN f.user_b ELSE f.user_a END AS friend_id
    FROM public.friendships f
    WHERE f.user_a = p_target_id OR f.user_b = p_target_id
  ),
  mutual AS (
    SELECT vf.friend_id FROM viewer_friends vf
    JOIN target_friends tf ON vf.friend_id = tf.friend_id
  ),
  counted AS (SELECT COUNT(*)::INT AS total FROM mutual),
  page AS (SELECT friend_id FROM mutual LIMIT v_limit OFFSET v_offset)
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(public.profile_for_viewer(p, p_viewer_id) ORDER BY p.display_name)
       FROM page pg JOIN public.profiles p ON p.id = pg.friend_id),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', COALESCE(v_total, 0),
    'has_more', (v_offset + v_limit) < COALESCE(v_total, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Profile favorites
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_profile_favorite(
  p_user_id UUID,
  p_favorite_user_id UUID,
  p_favorite BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id = p_favorite_user_id THEN RAISE EXCEPTION 'Cannot favorite yourself'; END IF;
  IF public.users_are_blocked(p_user_id, p_favorite_user_id) THEN RAISE EXCEPTION 'User unavailable'; END IF;

  IF p_favorite THEN
    INSERT INTO public.profile_favorites (user_id, favorite_user_id)
    VALUES (p_user_id, p_favorite_user_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.profile_favorites
    WHERE user_id = p_user_id AND favorite_user_id = p_favorite_user_id;
  END IF;

  RETURN jsonb_build_object('favorited', p_favorite);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_favorite_pinned(
  p_user_id UUID,
  p_favorite_user_id UUID,
  p_pinned BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profile_favorites
  SET is_pinned = p_pinned,
      pinned_at = CASE WHEN p_pinned THEN now() ELSE NULL END
  WHERE user_id = p_user_id AND favorite_user_id = p_favorite_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Favorite not found';
  END IF;

  RETURN jsonb_build_object('pinned', p_pinned);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_favorite_profiles_page(
  p_user_id UUID,
  p_limit INT DEFAULT 30,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 60);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_total INT;
  v_items JSONB;
BEGIN
  WITH base AS (
    SELECT pf.* FROM public.profile_favorites pf
    WHERE pf.user_id = p_user_id
  ),
  counted AS (SELECT COUNT(*)::INT AS total FROM base),
  page AS (
    SELECT favorite_user_id, is_pinned, pinned_at, created_at
    FROM base
    ORDER BY is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'profile', public.profile_for_viewer(p, p_user_id),
          'is_pinned', pg.is_pinned,
          'pinned_at', pg.pinned_at,
          'created_at', pg.created_at
        )
      )
      FROM page pg JOIN public.profiles p ON p.id = pg.favorite_user_id),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', COALESCE(v_total, 0),
    'has_more', (v_offset + v_limit) < COALESCE(v_total, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Profile social context (stats + relationship state)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_profile_social_context(
  p_viewer_id UUID,
  p_target_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_viewer public.profiles%ROWTYPE;
  v_friends_count INT := 0;
  v_mutual_friends INT := 0;
  v_mutual_partners INT := 0;
  v_shared_interests TEXT[] := '{}';
  v_shared_goals TEXT[] := '{}';
  v_friend_status TEXT := 'none';
  v_is_following BOOLEAN := false;
  v_is_favorited BOOLEAN := false;
  v_is_pinned BOOLEAN := false;
  v_is_muted BOOLEAN := false;
  v_last_active TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  v_friends_count := public.count_user_friends(p_target_id);

  IF p_viewer_id IS NOT NULL AND p_viewer_id <> p_target_id THEN
    SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
    v_mutual_friends := public.count_mutual_friends(p_viewer_id, p_target_id);

    SELECT COUNT(DISTINCT shared.partner_id)::INT INTO v_mutual_partners
    FROM (
      SELECT CASE WHEN m.user_a = p_viewer_id THEN m.user_b ELSE m.user_a END AS partner_id
      FROM public.matches m WHERE m.status = 'matched'
        AND (m.user_a = p_viewer_id OR m.user_b = p_viewer_id)
      INTERSECT
      SELECT CASE WHEN m.user_a = p_target_id THEN m.user_b ELSE m.user_a END
      FROM public.matches m WHERE m.status = 'matched'
        AND (m.user_a = p_target_id OR m.user_b = p_target_id)
    ) shared;

    SELECT ARRAY(
      SELECT unnest(COALESCE(v_viewer.activities, '{}'))
      INTERSECT
      SELECT unnest(COALESCE(v_target.activities, '{}'))
    ) INTO v_shared_interests;

    SELECT ARRAY(
      SELECT unnest(COALESCE(v_viewer.fitness_goals, '{}'))
      INTERSECT
      SELECT unnest(COALESCE(v_target.fitness_goals, '{}'))
    ) INTO v_shared_goals;

    IF public.users_are_friends(p_viewer_id, p_target_id) THEN
      v_friend_status := 'friends';
    ELSIF EXISTS (
      SELECT 1 FROM public.friend_requests
      WHERE requester_id = p_viewer_id AND recipient_id = p_target_id AND status = 'pending'
    ) THEN
      v_friend_status := 'pending_outgoing';
    ELSIF EXISTS (
      SELECT 1 FROM public.friend_requests
      WHERE requester_id = p_target_id AND recipient_id = p_viewer_id AND status = 'pending'
    ) THEN
      v_friend_status := 'pending_incoming';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = p_viewer_id AND following_id = p_target_id
    ) INTO v_is_following;

    SELECT COALESCE(pf.is_pinned, false), true
    INTO v_is_pinned, v_is_favorited
    FROM public.profile_favorites pf
    WHERE pf.user_id = p_viewer_id AND pf.favorite_user_id = p_target_id;

    SELECT EXISTS (
      SELECT 1 FROM public.user_mutes
      WHERE user_id = p_viewer_id AND muted_user_id = p_target_id
    ) INTO v_is_muted;
  END IF;

  v_last_active := public.profile_presence_last_seen(
    v_target.id, v_target.last_seen_at, v_target.show_online_status, p_viewer_id
  );

  RETURN jsonb_build_object(
    'friends_count', v_friends_count,
    'mutual_friends_count', v_mutual_friends,
    'mutual_training_partners', v_mutual_partners,
    'shared_interests', to_jsonb(v_shared_interests),
    'shared_goals', to_jsonb(v_shared_goals),
    'friend_status', v_friend_status,
    'is_following', v_is_following,
    'is_favorited', COALESCE(v_is_favorited, false),
    'is_pinned', COALESCE(v_is_pinned, false),
    'is_muted', v_is_muted,
    'joined_at', v_target.created_at,
    'last_active', v_last_active,
    'friend_mode', COALESCE(v_target.friend_mode, 'open')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- People you may know
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_people_you_may_know(
  p_viewer_id UUID,
  p_limit INT DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 30);
  v_viewer public.profiles%ROWTYPE;
  v_items JSONB;
BEGIN
  SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  WITH excluded AS (
    SELECT p_viewer_id AS id
    UNION SELECT following_id FROM public.follows WHERE follower_id = p_viewer_id
    UNION SELECT CASE WHEN user_a = p_viewer_id THEN user_b ELSE user_a END
      FROM public.friendships WHERE user_a = p_viewer_id OR user_b = p_viewer_id
    UNION SELECT blocked_id FROM public.blocks WHERE blocker_id = p_viewer_id
    UNION SELECT blocker_id FROM public.blocks WHERE blocked_id = p_viewer_id
  ),
  candidates AS (
    SELECT p.*,
      public.count_mutual_friends(p_viewer_id, p.id) AS mutual_friends,
      (
        SELECT COUNT(DISTINCT shared.partner_id)::INT
        FROM (
          SELECT CASE WHEN m.user_a = p_viewer_id THEN m.user_b ELSE m.user_a END AS partner_id
          FROM public.matches m WHERE m.status = 'matched'
            AND (m.user_a = p_viewer_id OR m.user_b = p_viewer_id)
          INTERSECT
          SELECT CASE WHEN m.user_a = p.id THEN m.user_b ELSE m.user_a END
          FROM public.matches m WHERE m.status = 'matched'
            AND (m.user_a = p.id OR m.user_b = p.id)
        ) shared
      ) AS mutual_partners,
      cardinality(
        ARRAY(
          SELECT unnest(COALESCE(v_viewer.activities, '{}'))
          INTERSECT SELECT unnest(COALESCE(p.activities, '{}'))
        )
      ) AS shared_interest_count,
      cardinality(
        ARRAY(
          SELECT unnest(COALESCE(v_viewer.fitness_goals, '{}'))
          INTERSECT SELECT unnest(COALESCE(p.fitness_goals, '{}'))
        )
      ) AS shared_goal_count,
      (
        SELECT COUNT(*)::INT FROM public.group_members gm1
        JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = p_viewer_id AND gm2.user_id = p.id
      ) AS shared_groups,
      (
        SELECT COUNT(*)::INT FROM public.challenge_participants cp1
        JOIN public.challenge_participants cp2 ON cp1.challenge_id = cp2.challenge_id
        WHERE cp1.user_id = p_viewer_id AND cp2.user_id = p.id
      ) AS shared_challenges,
      CASE
        WHEN v_viewer.city IS NOT NULL AND p.city IS NOT NULL
          AND lower(p.city) = lower(v_viewer.city) THEN 1
        WHEN v_viewer.latitude IS NOT NULL AND v_viewer.longitude IS NOT NULL
          AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
          AND public.haversine_miles(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
            <= COALESCE(v_viewer.discovery_radius_miles, 25) THEN 1
        ELSE 0
      END AS is_nearby
    FROM public.profiles p
    WHERE p.onboarding_complete = true
      AND p.visibility = 'public'
      AND NOT COALESCE(p.is_banned, false)
      AND p.id NOT IN (SELECT id FROM excluded)
  ),
  scored AS (
    SELECT *,
      (mutual_friends * 8 + mutual_partners * 6 + shared_interest_count * 4
        + shared_goal_count * 4 + shared_groups * 3 + shared_challenges * 3 + is_nearby * 5) AS score
    FROM candidates
    WHERE (mutual_friends + mutual_partners + shared_interest_count + shared_goal_count
      + shared_groups + shared_challenges + is_nearby) > 0
  ),
  top AS (SELECT * FROM scored ORDER BY score DESC, display_name LIMIT v_limit)
  SELECT COALESCE(
    jsonb_agg(public.discover_profile_item(t, p_viewer_id) ORDER BY t.score DESC),
    '[]'::jsonb
  ) INTO v_items
  FROM top t;

  RETURN v_items;
END;
$$;

-- ---------------------------------------------------------------------------
-- Enhanced discover_profile_item (mutual friends)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.discover_profile_item(
  p public.profiles,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutual_followers INT := 0;
  v_mutual_friends INT := 0;
  v_mutual_partners INT := 0;
  v_mutual_groups INT := 0;
  v_mutual_challenges INT := 0;
  v_badges JSONB := '[]'::jsonb;
  v_trainer_level TEXT;
  v_referral_count INT := 0;
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    SELECT COUNT(*)::INT INTO v_mutual_followers
    FROM public.follows f1
    JOIN public.follows f2
      ON f2.follower_id = f1.following_id AND f2.following_id = p.id
    WHERE f1.follower_id = p_viewer_id;

    v_mutual_friends := public.count_mutual_friends(p_viewer_id, p.id);

    SELECT COUNT(DISTINCT shared.partner_id)::INT INTO v_mutual_partners
    FROM (
      SELECT CASE WHEN m.user_a = p_viewer_id THEN m.user_b ELSE m.user_a END AS partner_id
      FROM public.matches m WHERE m.status = 'matched'
        AND (m.user_a = p_viewer_id OR m.user_b = p_viewer_id)
      INTERSECT
      SELECT CASE WHEN m.user_a = p.id THEN m.user_b ELSE m.user_a END
      FROM public.matches m WHERE m.status = 'matched'
        AND (m.user_a = p.id OR m.user_b = p.id)
    ) shared;

    SELECT COUNT(*)::INT INTO v_mutual_groups
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = p_viewer_id AND gm2.user_id = p.id;

    SELECT COUNT(*)::INT INTO v_mutual_challenges
    FROM public.challenge_participants cp1
    JOIN public.challenge_participants cp2 ON cp1.challenge_id = cp2.challenge_id
    WHERE cp1.user_id = p_viewer_id AND cp2.user_id = p.id
      AND COALESCE(cp1.status, 'active') = 'active'
      AND COALESCE(cp2.status, 'active') = 'active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.user_id = p.id AND sm.role = 'founder'::public.staff_role AND sm.revoked_at IS NULL
  ) OR COALESCE(p.is_admin, false) THEN
    v_badges := v_badges || jsonb_build_array('founder');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.user_id = p.id AND sm.role = 'ambassador_manager'::public.staff_role AND sm.revoked_at IS NULL
  ) THEN
    v_badges := v_badges || jsonb_build_array('ambassador');
  ELSE
    SELECT COUNT(*)::INT INTO v_referral_count FROM public.referrals r WHERE r.referrer_id = p.id;
    IF v_referral_count >= 5 THEN v_badges := v_badges || jsonb_build_array('ambassador'); END IF;
  END IF;

  SELECT tp.verification_level::TEXT INTO v_trainer_level FROM public.trainer_profiles tp WHERE tp.user_id = p.id;
  IF v_trainer_level IN ('verified', 'featured') THEN
    v_badges := v_badges || jsonb_build_array('verified_trainer');
  END IF;
  IF COALESCE(p.is_premium, false) THEN v_badges := v_badges || jsonb_build_array('verified'); END IF;

  RETURN jsonb_build_object(
    'profile', public.profile_for_viewer(p, p_viewer_id),
    'mutual_followers', v_mutual_followers,
    'mutual_friends', v_mutual_friends,
    'mutual_training_partners', v_mutual_partners,
    'mutual_groups', v_mutual_groups,
    'mutual_challenges', v_mutual_challenges,
    'badges', v_badges
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Enhanced search_discover_profiles
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_discover_profiles(
  p_query TEXT DEFAULT '',
  p_viewer_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := btrim(COALESCE(p_query, ''));
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_viewer public.profiles%ROWTYPE;
  v_has_query BOOLEAN := length(v_query) >= 2;
  v_nearby BOOLEAN := COALESCE((p_filters->>'nearby')::boolean, false);
  v_same_goals BOOLEAN := COALESCE((p_filters->>'sameGoals')::boolean, false);
  v_same_interests BOOLEAN := COALESCE((p_filters->>'sameInterests')::boolean, false);
  v_training_partners BOOLEAN := COALESCE((p_filters->>'trainingPartners')::boolean, false);
  v_trainers BOOLEAN := COALESCE((p_filters->>'trainers')::boolean, false);
  v_new_members BOOLEAN := COALESCE((p_filters->>'newMembers')::boolean, false);
  v_popular BOOLEAN := COALESCE((p_filters->>'popular')::boolean, false);
  v_trending BOOLEAN := COALESCE((p_filters->>'trending')::boolean, false);
  v_active_week BOOLEAN := COALESCE((p_filters->>'activeThisWeek')::boolean, false);
  v_has_filters BOOLEAN;
  v_total INT;
  v_items JSONB;
  v_started_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
  END IF;

  v_has_filters := v_nearby OR v_same_goals OR v_same_interests OR v_training_partners
    OR v_trainers OR v_new_members OR v_popular OR v_trending OR v_active_week;

  IF NOT v_has_query AND NOT v_has_filters THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'has_more', false, 'duration_ms', 0);
  END IF;

  IF v_has_query THEN PERFORM public.record_discover_search_terms(v_query); END IF;

  WITH base AS (
    SELECT p.*,
      COALESCE(fc.follower_count, 0) AS follower_count,
      COALESCE(recent_posts.post_count, 0) AS recent_post_count
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS follower_count FROM public.follows f WHERE f.following_id = p.id
    ) fc ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS post_count FROM public.posts po
      WHERE po.author_id = p.id AND po.created_at >= now() - interval '7 days'
    ) recent_posts ON true
    WHERE p.onboarding_complete = true
      AND p.visibility = 'public'
      AND NOT COALESCE(p.is_banned, false)
      AND (p_viewer_id IS NULL OR p.id != p_viewer_id)
      AND (p_viewer_id IS NULL OR NOT public.users_are_blocked(p_viewer_id, p.id))
      AND (NOT v_has_query OR public.profile_matches_discover_query(p, v_query))
      AND (NOT v_nearby OR (
        v_viewer.id IS NOT NULL AND (
          (v_viewer.city IS NOT NULL AND p.city IS NOT NULL AND lower(p.city) = lower(v_viewer.city))
          OR (v_viewer.latitude IS NOT NULL AND v_viewer.longitude IS NOT NULL
            AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            AND public.haversine_miles(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
              <= COALESCE(v_viewer.discovery_radius_miles, 25))
        )
      ))
      AND (NOT v_same_goals OR (
        v_viewer.id IS NOT NULL AND p.fitness_goals && v_viewer.fitness_goals
      ))
      AND (NOT v_same_interests OR (
        v_viewer.id IS NOT NULL AND p.activities && v_viewer.activities
      ))
      AND (NOT v_training_partners OR COALESCE(p.matching_enabled, false))
      AND (NOT v_trainers OR COALESCE(p.is_trainer, false))
      AND (NOT v_new_members OR p.created_at >= now() - interval '30 days')
      AND (NOT v_popular OR fc.follower_count >= 10)
      AND (NOT v_trending OR (fc.follower_count >= 5 AND recent_posts.post_count >= 1))
      AND (NOT v_active_week OR (
        COALESCE(p.last_seen_at, p.updated_at) >= now() - interval '7 days'
        OR recent_posts.post_count >= 1
      ))
  ),
  counted AS (SELECT COUNT(*)::INT AS total FROM base),
  page AS (
    SELECT b.* FROM base b
    ORDER BY
      CASE WHEN v_popular OR v_trending THEN -b.follower_count ELSE 0 END,
      CASE WHEN v_active_week THEN -b.recent_post_count ELSE 0 END,
      CASE WHEN v_has_query AND b.username ILIKE v_query || '%' THEN 0
           WHEN v_has_query AND b.display_name ILIKE v_query || '%' THEN 1
           ELSE 2 END,
      b.display_name
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(public.discover_profile_item(p, p_viewer_id) ORDER BY p.display_name) FROM page p),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', COALESCE(v_total, 0),
    'has_more', (v_offset + v_limit) < COALESCE(v_total, 0),
    'duration_ms', GREATEST(0, (EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000)::INT)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Discover suggested sections (expanded)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_discover_suggested_sections(p_viewer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_people_you_may_know JSONB;
  v_training JSONB;
  v_trending JSONB;
  v_new_members JSONB;
  v_active_week JSONB;
  v_trainers_nearby JSONB;
  v_nearby JSONB;
  v_popular JSONB;
  v_recommended JSONB;
  v_similar_goals JSONB;
BEGIN
  SELECT public.get_people_you_may_know(p_viewer_id, 6) INTO v_people_you_may_know;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_training
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"trainingPartners": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_trending
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"trending": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_new_members
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"newMembers": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_active_week
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"activeThisWeek": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_trainers_nearby
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"trainers": true, "nearby": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_nearby
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"nearby": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_popular
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"popular": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_recommended
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"sameInterests": true, "sameGoals": true}'::jsonb) AS payload) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_similar_goals
  FROM (SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"sameGoals": true}'::jsonb) AS payload) q;

  RETURN jsonb_build_object(
    'people_you_may_know', v_people_you_may_know,
    'training_partners', v_training,
    'trending_athletes', v_trending,
    'new_members', v_new_members,
    'active_this_week', v_active_week,
    'trainers_near_you', v_trainers_nearby,
    'nearby', v_nearby,
    'popular', v_popular,
    'recommended_for_you', v_recommended,
    'similar_goals', v_similar_goals
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_on_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
  v_username TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;

  SELECT display_name, username INTO v_actor_name, v_username
  FROM public.profiles WHERE id = NEW.requester_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');

  PERFORM public.create_notification(
    p_user_id := NEW.recipient_id,
    p_type := 'friend_request',
    p_actor_id := NEW.requester_id,
    p_entity_type := 'profile',
    p_entity_id := NEW.requester_id,
    p_title := 'Friend request',
    p_body := v_actor_name || ' sent you a friend request',
    p_deep_link := CASE WHEN v_username IS NOT NULL THEN '/friend-requests' ELSE '/notifications' END,
    p_payload := jsonb_build_object('requester_id', NEW.requester_id),
    p_dedupe_key := 'friend_request:' || NEW.requester_id::text || ':' || NEW.recipient_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request ON public.friend_requests;
CREATE TRIGGER trg_notify_friend_request
  AFTER INSERT ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_friend_request();

CREATE OR REPLACE FUNCTION public.notify_on_friend_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
  v_username TEXT;
  v_recipient UUID;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN RETURN NEW; END IF;

  v_recipient := NEW.recipient_id;
  SELECT display_name, username INTO v_actor_name, v_username
  FROM public.profiles WHERE id = v_recipient;
  v_actor_name := COALESCE(v_actor_name, 'Someone');

  PERFORM public.create_notification(
    p_user_id := NEW.requester_id,
    p_type := 'friend_accepted',
    p_actor_id := v_recipient,
    p_entity_type := 'profile',
    p_entity_id := v_recipient,
    p_title := 'Friend request accepted',
    p_body := v_actor_name || ' accepted your friend request',
    p_deep_link := CASE WHEN v_username IS NOT NULL THEN '/user/' || v_username ELSE '/notifications' END,
    p_payload := jsonb_build_object('friend_id', v_recipient),
    p_dedupe_key := 'friend_accepted:' || NEW.requester_id::text || ':' || v_recipient::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON public.friend_requests;
CREATE TRIGGER trg_notify_friend_accepted
  AFTER UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_friend_accepted();

CREATE OR REPLACE FUNCTION public.notify_on_profile_favorited()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
  v_username TEXT;
BEGIN
  SELECT display_name, username INTO v_actor_name, v_username
  FROM public.profiles WHERE id = NEW.user_id;
  v_actor_name := COALESCE(v_actor_name, 'Someone');

  PERFORM public.create_notification(
    p_user_id := NEW.favorite_user_id,
    p_type := 'profile_favorited',
    p_actor_id := NEW.user_id,
    p_entity_type := 'profile',
    p_entity_id := NEW.user_id,
    p_title := 'Profile favorited',
    p_body := v_actor_name || ' favorited your profile',
    p_deep_link := CASE WHEN v_username IS NOT NULL THEN '/user/' || v_username ELSE '/notifications' END,
    p_payload := jsonb_build_object('favorited_by', NEW.user_id),
    p_dedupe_key := 'profile_favorited:' || NEW.user_id::text || ':' || NEW.favorite_user_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_profile_favorited ON public.profile_favorites;
CREATE TRIGGER trg_notify_profile_favorited
  AFTER INSERT ON public.profile_favorites
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_profile_favorited();

CREATE OR REPLACE FUNCTION public.notify_mutual_friend_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notify RECORD;
  v_new_name TEXT;
  v_new_username TEXT;
  v_new_user_id UUID;
BEGIN
  v_new_user_id := NEW.user_b;
  SELECT display_name, username INTO v_new_name, v_new_username
  FROM public.profiles WHERE id = v_new_user_id;
  v_new_name := COALESCE(v_new_name, 'Someone');

  -- Notify friends of user_a that user_b is now connected through mutual network.
  FOR v_notify IN
    SELECT DISTINCT CASE WHEN f.user_a = NEW.user_a THEN f.user_b ELSE f.user_a END AS notify_user_id
    FROM public.friendships f
    WHERE (f.user_a = NEW.user_a OR f.user_b = NEW.user_a)
      AND CASE WHEN f.user_a = NEW.user_a THEN f.user_b ELSE f.user_a END NOT IN (NEW.user_a, NEW.user_b)
      AND NOT public.users_are_friends(
        CASE WHEN f.user_a = NEW.user_a THEN f.user_b ELSE f.user_a END,
        v_new_user_id
      )
      AND public.count_mutual_friends(
        CASE WHEN f.user_a = NEW.user_a THEN f.user_b ELSE f.user_a END,
        v_new_user_id
      ) >= 1
  LOOP
    PERFORM public.create_notification(
      p_user_id := v_notify.notify_user_id,
      p_type := 'mutual_friend_joined',
      p_actor_id := v_new_user_id,
      p_entity_type := 'profile',
      p_entity_id := v_new_user_id,
      p_title := 'Mutual friend joined',
      p_body := v_new_name || ' joined your network — you have mutual friends',
      p_deep_link := CASE WHEN v_new_username IS NOT NULL THEN '/user/' || v_new_username ELSE '/notifications' END,
      p_payload := jsonb_build_object('new_user_id', v_new_user_id),
      p_dedupe_key := 'mutual_friend_joined:' || v_new_user_id::text || ':' || v_notify.notify_user_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mutual_friend_joined ON public.friendships;
CREATE TRIGGER trg_notify_mutual_friend_joined
  AFTER INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_mutual_friend_joined();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friend_requests_select ON public.friend_requests;
CREATE POLICY friend_requests_select ON public.friend_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS friend_requests_insert ON public.friend_requests;
CREATE POLICY friend_requests_insert ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS friend_requests_update ON public.friend_requests;
CREATE POLICY friend_requests_update ON public.friend_requests FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS friendships_select ON public.friendships;
CREATE POLICY friendships_select ON public.friendships FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS profile_favorites_all ON public.profile_favorites;
CREATE POLICY profile_favorites_all ON public.profile_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.friend_requests TO authenticated;
GRANT SELECT ON public.friendships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_favorites TO authenticated;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_friend_direct(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends_page(UUID, UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_requests_page(UUID, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutual_friends_page(UUID, UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_social_context(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_favorite(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_favorite_pinned(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_favorite_profiles_page(UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_matches_discover_query(public.profiles, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expand_discover_search_keywords(TEXT) TO authenticated;

COMMENT ON TABLE public.friendships IS 'Canonical undirected friend edges (user_a < user_b).';
COMMENT ON TABLE public.profile_favorites IS 'Pinned/favorited athlete profiles for quick access.';
