-- Fix match candidate RPC regression from location discovery migration:
-- 1) profile_for_viewer must not NULL show_online_status (NOT NULL on profiles composite).
-- 2) SETOF profiles RPCs must expand profile_for_viewer rows with .*.

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
  v_viewer public.profiles%ROWTYPE;
  v_miles double precision;
  v_mode text;
BEGIN
  result := p;
  result.distance_bucket_label := NULL;

  result.is_online := public.profile_presence_is_online(
    p.id, p.is_online, p.show_online_status, p_viewer_id
  );
  result.last_seen_at := public.profile_presence_last_seen(
    p.id, p.last_seen_at, p.show_online_status, p_viewer_id
  );

  IF p.id IS DISTINCT FROM p_viewer_id THEN
    -- Mask preference for other viewers without violating NOT NULL on profiles rows.
    result.show_online_status := true;
    result.latitude := NULL;
    result.longitude := NULL;
    result.discovery_explicitly_disabled_at := NULL;
    result.location_prompt_completed_at := NULL;
    result.location_prompt_dismissed_at := NULL;
    result.use_location_for_matching := NULL;

    IF p_viewer_id IS NOT NULL
      AND public.users_are_blocked(p_viewer_id, p.id)
    THEN
      result.city := NULL;
      result.state := NULL;
      result.distance_bucket_label := NULL;
      RETURN result;
    END IF;

    v_mode := COALESCE(p.location_display_mode, 'city_state');

    IF v_mode = 'hidden' THEN
      result.city := NULL;
      result.state := NULL;
      result.distance_bucket_label := NULL;
      RETURN result;
    END IF;

    IF v_mode = 'distance_only'
      OR (NOT COALESCE(p.show_city_state, true) AND COALESCE(p.show_approximate_distance, false))
    THEN
      result.city := NULL;
      result.state := NULL;

      IF COALESCE(p.show_approximate_distance, false) AND p_viewer_id IS NOT NULL THEN
        SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
        IF FOUND
          AND public.profile_has_saved_location(v_viewer)
          AND public.profile_has_saved_location(p)
          AND v_viewer.latitude IS NOT NULL
          AND v_viewer.longitude IS NOT NULL
          AND p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
        THEN
          v_miles := public.haversine_miles(
            v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude
          );
          result.distance_bucket_label := public.distance_bucket_label(v_miles);
        END IF;
      END IF;

      RETURN result;
    END IF;

    IF NOT COALESCE(p.show_city_state, true) THEN
      result.city := NULL;
      result.state := NULL;
    END IF;

    IF COALESCE(p.show_approximate_distance, false) AND p_viewer_id IS NOT NULL THEN
      SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
      IF FOUND
        AND public.profile_has_saved_location(v_viewer)
        AND public.profile_has_saved_location(p)
        AND v_viewer.latitude IS NOT NULL
        AND v_viewer.longitude IS NOT NULL
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
      THEN
        v_miles := public.haversine_miles(
          v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude
        );
        result.distance_bucket_label := public.distance_bucket_label(v_miles);
      END IF;
    END IF;
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_profiles(search_query text, result_limit int DEFAULT 30)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (public.profile_for_viewer(p)).*
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
  SELECT (public.profile_for_viewer(p, v_viewer.id)).*
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
      WHEN COALESCE(v_viewer.use_location_for_matching, true)
        AND COALESCE(p.use_location_for_matching, true)
        AND v_viewer.latitude IS NOT NULL
        AND v_viewer.longitude IS NOT NULL
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
      THEN public.haversine_miles(
        v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude
      )
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN public.profile_has_saved_location(v_viewer)
        AND public.profile_has_saved_location(p)
        AND v_viewer.city IS NOT NULL
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

REVOKE ALL ON FUNCTION public.get_match_candidates(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_candidates(INT) TO authenticated;
