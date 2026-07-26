-- Location & Discovery privacy — approximate matching, display controls, safe existing-user backfill.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS use_location_for_matching boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_city_state boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_approximate_distance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_display_mode text NOT NULL DEFAULT 'city_state',
  ADD COLUMN IF NOT EXISTS discovery_explicitly_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_prompt_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_prompt_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS distance_bucket_label text;

COMMENT ON COLUMN public.profiles.use_location_for_matching IS
  'When true and coordinates exist, use approximate location for nearby ranking.';
COMMENT ON COLUMN public.profiles.show_city_state IS
  'When true and display mode allows, show city/state on public profile.';
COMMENT ON COLUMN public.profiles.show_approximate_distance IS
  'When true and display mode allows, show approximate distance bucket to viewers with location.';
COMMENT ON COLUMN public.profiles.location_display_mode IS
  'Public location display: city_state | distance_only | hidden';
COMMENT ON COLUMN public.profiles.discovery_explicitly_disabled_at IS
  'Set when user explicitly turns off Appear in Frennix Match — preserved across migrations.';
COMMENT ON COLUMN public.profiles.location_prompt_completed_at IS
  'One-time existing-user location onboarding completed or dismissed permanently.';
COMMENT ON COLUMN public.profiles.location_prompt_dismissed_at IS
  'Maybe Later on one-time location prompt — shows non-intrusive banner instead.';
COMMENT ON COLUMN public.profiles.distance_bucket_label IS
  'Computed by profile_for_viewer for viewers — never written by clients.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_location_display_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_location_display_mode_check
  CHECK (location_display_mode IN ('city_state', 'distance_only', 'hidden'));

ALTER TABLE public.profiles
  ALTER COLUMN matching_enabled SET DEFAULT true;

-- ---------------------------------------------------------------------------
-- Safe, idempotent existing-user backfill
-- ---------------------------------------------------------------------------

-- All completed onboarding users are discoverable — no existing users have disabled discovery.
UPDATE public.profiles
SET matching_enabled = true
WHERE onboarding_complete = true
  AND COALESCE(matching_enabled, false) = false;

-- Location matching only when approximate coordinates exist (city-only is not ranked as nearby).
UPDATE public.profiles
SET use_location_for_matching = false
WHERE latitude IS NULL OR longitude IS NULL;

UPDATE public.profiles
SET use_location_for_matching = true
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Do not invent cities or coordinates — existing city/state values are preserved as-is.

-- ---------------------------------------------------------------------------
-- Distance helpers (approximate buckets only — never expose raw miles publicly)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.haversine_miles(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT (
    3958.8 * 2 * atan2(
      sqrt(
        sin(radians(lat2 - lat1) / 2) ^ 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
      ),
      sqrt(
        1 - (
          sin(radians(lat2 - lat1) / 2) ^ 2
          + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
        )
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.distance_bucket_label(p_miles double precision)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_miles IS NULL OR p_miles < 0 THEN NULL
    WHEN p_miles < 5 THEN 'Less than 5 miles away'
    WHEN p_miles <= 10 THEN '5–10 miles away'
    WHEN p_miles <= 25 THEN '10–25 miles away'
    ELSE 'More than 25 miles away'
  END;
$$;

REVOKE ALL ON FUNCTION public.haversine_miles(double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.haversine_miles(double precision, double precision, double precision, double precision) TO authenticated;

REVOKE ALL ON FUNCTION public.distance_bucket_label(double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distance_bucket_label(double precision) TO authenticated;

-- True when profile has coordinates or a non-empty city (used for nearby ranking/labels).
CREATE OR REPLACE FUNCTION public.profile_has_saved_location(p public.profiles)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (p.latitude IS NOT NULL AND p.longitude IS NOT NULL)
    OR (p.city IS NOT NULL AND btrim(p.city) <> '');
$$;

REVOKE ALL ON FUNCTION public.profile_has_saved_location(public.profiles) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_has_saved_location(public.profiles) TO authenticated;

-- ---------------------------------------------------------------------------
-- profile_for_viewer — mask coordinates, apply location display rules
-- ---------------------------------------------------------------------------

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
    result.show_online_status := NULL;
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

    -- city_state mode (default)
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

REVOKE ALL ON FUNCTION public.profile_for_viewer(public.profiles, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_for_viewer(public.profiles, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- profiles_reader — mask sensitive fields for non-self reads
-- ---------------------------------------------------------------------------

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
  CASE
    WHEN p.id = auth.uid() THEN p.city
    WHEN COALESCE(p.location_display_mode, 'city_state') = 'hidden' THEN NULL
    WHEN p.location_display_mode = 'distance_only' THEN NULL
    WHEN NOT COALESCE(p.show_city_state, true) THEN NULL
    ELSE p.city
  END AS city,
  CASE
    WHEN p.id = auth.uid() THEN p.state
    WHEN COALESCE(p.location_display_mode, 'city_state') = 'hidden' THEN NULL
    WHEN p.location_display_mode = 'distance_only' THEN NULL
    WHEN NOT COALESCE(p.show_city_state, true) THEN NULL
    ELSE p.state
  END AS state,
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
  p.parent_status,
  p.parent_type,
  p.children_age_groups,
  p.preferred_workout_times,
  p.kid_friendly_workouts,
  p.looking_for_parent_partner,
  p.lifestyle_tags,
  p.skill_level,
  p.training_schedules,
  p.home_gym,
  p.training_environment,
  CASE WHEN p.id = auth.uid() THEN p.discovery_radius_miles ELSE NULL END AS discovery_radius_miles,
  CASE WHEN p.id = auth.uid() THEN p.latitude ELSE NULL END AS latitude,
  CASE WHEN p.id = auth.uid() THEN p.longitude ELSE NULL END AS longitude,
  CASE WHEN p.id = auth.uid() THEN p.use_location_for_matching ELSE NULL END AS use_location_for_matching,
  CASE WHEN p.id = auth.uid() THEN p.show_city_state ELSE NULL END AS show_city_state,
  CASE WHEN p.id = auth.uid() THEN p.show_approximate_distance ELSE NULL END AS show_approximate_distance,
  CASE WHEN p.id = auth.uid() THEN p.location_display_mode ELSE NULL END AS location_display_mode,
  CASE WHEN p.id = auth.uid() THEN p.discovery_explicitly_disabled_at ELSE NULL END AS discovery_explicitly_disabled_at,
  CASE WHEN p.id = auth.uid() THEN p.location_prompt_completed_at ELSE NULL END AS location_prompt_completed_at,
  CASE WHEN p.id = auth.uid() THEN p.location_prompt_dismissed_at ELSE NULL END AS location_prompt_dismissed_at,
  NULL::text AS distance_bucket_label,
  p.created_at,
  p.updated_at,
  public.profile_presence_is_online(p.id, p.is_online, p.show_online_status, auth.uid()) AS is_online,
  public.profile_presence_last_seen(p.id, p.last_seen_at, p.show_online_status, auth.uid()) AS last_seen_at,
  CASE WHEN p.id = auth.uid() THEN p.show_online_status ELSE NULL END AS show_online_status
FROM public.profiles p;

GRANT SELECT ON public.profiles_reader TO authenticated;
GRANT SELECT ON public.profiles_reader TO anon;

-- ---------------------------------------------------------------------------
-- search_profiles — apply profile_for_viewer location masking (name search unchanged)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- get_match_candidates — respect use_location_for_matching in ordering
-- ---------------------------------------------------------------------------

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

REVOKE ALL ON FUNCTION public.get_match_candidates(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_candidates(INT) TO authenticated;
