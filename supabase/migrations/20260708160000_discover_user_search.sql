-- Discover user search — privacy-aware, filterable, paginated.

-- Haversine distance helper (miles) for nearby filter.
CREATE OR REPLACE FUNCTION public.haversine_miles(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 3958.8 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

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
  v_has_filters BOOLEAN;
  v_total INT;
  v_items JSONB;
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
  END IF;

  v_has_filters := v_nearby OR v_same_goals OR v_same_interests OR v_training_partners
    OR v_trainers OR v_new_members;

  IF NOT v_has_query AND NOT v_has_filters THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  WITH base AS (
    SELECT p.*
    FROM public.profiles p
    WHERE p.onboarding_complete = true
      AND p.visibility = 'public'
      AND NOT COALESCE(p.is_banned, false)
      AND (p_viewer_id IS NULL OR p.id != p_viewer_id)
      AND (p_viewer_id IS NULL OR NOT public.users_are_blocked(p_viewer_id, p.id))
      AND (
        NOT v_has_query
        OR p.display_name ILIKE '%' || v_query || '%'
        OR p.username ILIKE '%' || v_query || '%'
        OR COALESCE(p.bio, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.city, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.home_gym, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.match_preference::text, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.training_environment::text, '') ILIKE '%' || v_query || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.activities, '{}')) AS activity
          WHERE activity ILIKE '%' || v_query || '%'
            OR replace(activity, '_', ' ') ILIKE '%' || v_query || '%'
        )
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.fitness_goals, '{}')) AS goal
          WHERE goal ILIKE '%' || v_query || '%'
            OR replace(goal, '_', ' ') ILIKE '%' || v_query || '%'
        )
      )
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
        v_viewer.id IS NOT NULL
        AND COALESCE(p.fitness_goals, '{}') && COALESCE(v_viewer.fitness_goals, '{}')
      ))
      AND (NOT v_same_interests OR (
        v_viewer.id IS NOT NULL
        AND COALESCE(p.activities, '{}') && COALESCE(v_viewer.activities, '{}')
      ))
      AND (NOT v_training_partners OR COALESCE(p.matching_enabled, false) = true)
      AND (NOT v_trainers OR COALESCE(p.is_trainer, false) = true)
      AND (NOT v_new_members OR p.created_at >= now() - interval '14 days')
  ),
  counted AS (
    SELECT COUNT(*)::INT AS total FROM base
  ),
  page AS (
    SELECT b.*
    FROM base b
    ORDER BY
      CASE WHEN v_has_query AND b.username ILIKE v_query || '%' THEN 0
           WHEN v_has_query AND b.display_name ILIKE v_query || '%' THEN 1
           ELSE 2 END,
      b.display_name
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(public.profile_for_viewer(p, p_viewer_id) ORDER BY p.display_name)
       FROM page p),
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

GRANT EXECUTE ON FUNCTION public.haversine_miles(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_discover_profiles(TEXT, UUID, INT, INT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.search_discover_profiles IS
  'Privacy-aware discover search: public profiles only, excludes blocked users, supports filters and pagination.';
