-- Privacy: optional hiding of online presence from other users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.show_online_status IS
  'When false, user appears offline to others (is_online=false, last_seen_at hidden).';

CREATE OR REPLACE FUNCTION public.profile_presence_is_online(
  p_profile_id uuid,
  p_is_online boolean,
  p_show_online_status boolean,
  p_viewer_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_profile_id = p_viewer_id THEN COALESCE(p_is_online, false)
    WHEN COALESCE(p_show_online_status, true) THEN COALESCE(p_is_online, false)
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.profile_presence_last_seen(
  p_profile_id uuid,
  p_last_seen_at timestamptz,
  p_show_online_status boolean,
  p_viewer_id uuid DEFAULT auth.uid()
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_profile_id = p_viewer_id THEN p_last_seen_at
    WHEN COALESCE(p_show_online_status, true) THEN p_last_seen_at
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.profile_for_viewer(
  p public.profiles,
  p_viewer_id uuid DEFAULT auth.uid()
)
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result public.profiles;
BEGIN
  result := p;
  result.is_online := public.profile_presence_is_online(
    p.id, p.is_online, p.show_online_status, p_viewer_id
  );
  result.last_seen_at := public.profile_presence_last_seen(
    p.id, p.last_seen_at, p.show_online_status, p_viewer_id
  );
  IF p.id IS DISTINCT FROM p_viewer_id THEN
    result.show_online_status := NULL;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_online_status_privacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(NEW.show_online_status, true) THEN
    NEW.is_online := false;
    NEW.last_seen_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_online_status_privacy ON public.profiles;
CREATE TRIGGER profiles_online_status_privacy
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_online_status_privacy();

DROP VIEW IF EXISTS public.profiles_reader;
CREATE VIEW public.profiles_reader
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.cover_image_url,
  p.bio,
  p.fitness_goals,
  p.activities,
  p.city,
  p.visibility,
  p.matching_enabled,
  p.gender,
  p.match_preference,
  p.is_premium,
  p.onboarding_complete,
  p.referral_code,
  p.notification_preferences,
  p.is_admin,
  p.is_trainer,
  p.is_banned,
  p.push_token,
  p.created_at,
  p.updated_at,
  public.profile_presence_is_online(p.id, p.is_online, p.show_online_status, auth.uid()) AS is_online,
  public.profile_presence_last_seen(p.id, p.last_seen_at, p.show_online_status, auth.uid()) AS last_seen_at,
  CASE WHEN p.id = auth.uid() THEN p.show_online_status ELSE NULL END AS show_online_status
FROM public.profiles p;

GRANT SELECT ON public.profiles_reader TO authenticated;
GRANT SELECT ON public.profiles_reader TO anon;

CREATE OR REPLACE FUNCTION public.set_presence(p_is_online boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows integer := 0;
  v_created boolean := false;
  v_show_online boolean := true;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(p.show_online_status, true)
  INTO v_show_online
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT FOUND THEN
    v_show_online := true;
  END IF;

  IF NOT v_show_online THEN
    UPDATE public.profiles
    SET
      is_online = false,
      updated_at = now()
    WHERE id = v_uid;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    RETURN jsonb_build_object(
      'ok', true,
      'user_id', v_uid,
      'is_online', false,
      'created_profile', false,
      'rows_affected', v_rows,
      'presence_hidden', true
    );
  END IF;

  UPDATE public.profiles
  SET
    is_online = p_is_online,
    last_seen_at = now(),
    updated_at = now()
  WHERE id = v_uid;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    INSERT INTO public.profiles (id, username, display_name, is_online, last_seen_at, updated_at)
    SELECT
      u.id,
      'user_' || substr(replace(u.id::text, '-', ''), 1, 8),
      COALESCE(u.raw_user_meta_data->>'display_name', 'Frennix User'),
      p_is_online,
      now(),
      now()
    FROM auth.users u
    WHERE u.id = v_uid
    ON CONFLICT (id) DO UPDATE SET
      is_online = EXCLUDED.is_online,
      last_seen_at = EXCLUDED.last_seen_at,
      updated_at = EXCLUDED.updated_at;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION
        'set_presence: no profiles row for auth.uid() % and no auth.users row to create one',
        v_uid;
    END IF;

    v_created := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'is_online', p_is_online,
    'created_profile', v_created,
    'rows_affected', v_rows,
    'presence_hidden', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_presence(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_presence(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_profiles(search_query text, result_limit int DEFAULT 30)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.profile_for_viewer(p)
  FROM public.profiles p
  WHERE p.onboarding_complete = true
    AND btrim(search_query) <> ''
    AND (
      p.display_name ILIKE '%' || search_query || '%'
      OR p.username ILIKE '%' || search_query || '%'
      OR COALESCE(p.bio, '') ILIKE '%' || search_query || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(p.activities) AS activity
        WHERE activity ILIKE '%' || search_query || '%'
          OR replace(activity, '_', ' ') ILIKE '%' || search_query || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(p.fitness_goals) AS goal
        WHERE goal ILIKE '%' || search_query || '%'
          OR replace(goal, '_', ' ') ILIKE '%' || search_query || '%'
      )
      OR EXISTS (
        SELECT 1 FROM public.posts post
        WHERE post.author_id = p.id
          AND COALESCE(post.workout_type, '') ILIKE '%' || search_query || '%'
      )
    )
  ORDER BY p.display_name
  LIMIT GREATEST(result_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.get_match_candidates(p_limit INT DEFAULT 20)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer public.profiles%ROWTYPE;
  v_limit INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_viewer FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF NOT COALESCE(v_viewer.matching_enabled, false) THEN
    RETURN;
  END IF;

  IF COALESCE(v_viewer.is_banned, false) THEN
    RETURN;
  END IF;

  v_limit := GREATEST(LEAST(COALESCE(p_limit, 20), 50), 1);

  RETURN QUERY
  SELECT public.profile_for_viewer(p, v_viewer.id)
  FROM public.profiles p
  WHERE p.id != v_viewer.id
    AND COALESCE(p.matching_enabled, false) = true
    AND COALESCE(p.onboarding_complete, false) = true
    AND NOT COALESCE(p.is_banned, false)
    AND NOT public.users_are_blocked(v_viewer.id, p.id)
    AND public.profiles_match_preferences(
      v_viewer.gender,
      v_viewer.match_preference,
      p.gender,
      p.match_preference
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.match_swipes ms
      WHERE ms.swiper_id = v_viewer.id
        AND ms.swipee_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.user_a = LEAST(v_viewer.id, p.id)
        AND m.user_b = GREATEST(v_viewer.id, p.id)
    )
  ORDER BY
    public.text_array_intersection_count(p.activities, v_viewer.activities) DESC,
    public.text_array_intersection_count(p.fitness_goals, v_viewer.fitness_goals) DESC,
    CASE
      WHEN v_viewer.city IS NOT NULL
        AND p.city IS NOT NULL
        AND lower(trim(v_viewer.city)) = lower(trim(p.city))
      THEN 1
      ELSE 0
    END DESC,
    CASE WHEN COALESCE(p.show_online_status, true) THEN p.last_seen_at ELSE NULL END DESC NULLS LAST,
    p.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_for_viewer(public.profiles, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_for_viewer(public.profiles, uuid) TO authenticated;
