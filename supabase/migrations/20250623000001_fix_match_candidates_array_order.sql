-- Fix get_match_candidates: text[] has no & intersection operator in PostgreSQL.

CREATE OR REPLACE FUNCTION public.text_array_intersection_count(a text[], b text[])
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM unnest(COALESCE(a, '{}')) AS x(val)
  INNER JOIN unnest(COALESCE(b, '{}')) AS y(val) USING (val);
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
  SELECT p.*
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
    p.last_seen_at DESC NULLS LAST,
    p.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.text_array_intersection_count(text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_match_candidates(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_candidates(INT) TO authenticated;
