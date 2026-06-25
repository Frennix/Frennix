-- Matchmaking Phase 1: canonical match pairs, swipe RPC, candidate deck RPC.

-- Normalize any existing rows to canonical UUID order (user_a < user_b).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LEAST(user_a, user_b), GREATEST(user_a, user_b)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.matches
)
DELETE FROM public.matches m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

UPDATE public.matches
SET
  user_a = LEAST(user_a, user_b),
  user_b = GREATEST(user_a, user_b)
WHERE user_a > user_b;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_user_a_lt_user_b;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_user_a_lt_user_b CHECK (user_a < user_b);

CREATE INDEX IF NOT EXISTS idx_match_swipes_swiper ON public.match_swipes (swiper_id);
CREATE INDEX IF NOT EXISTS idx_match_swipes_swipee ON public.match_swipes (swipee_id);
CREATE INDEX IF NOT EXISTS idx_match_swipes_swiper_swipee ON public.match_swipes (swiper_id, swipee_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_a ON public.matches (user_a);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON public.matches (user_b);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches (status);
CREATE INDEX IF NOT EXISTS idx_profiles_matching_enabled
  ON public.profiles (matching_enabled)
  WHERE matching_enabled = true;

-- Does viewer preference accept candidate gender?
CREATE OR REPLACE FUNCTION public.gender_matches_preference(
  p_preference TEXT,
  p_viewer_gender TEXT,
  p_candidate_gender TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_preference IS NULL OR p_preference = 'any' THEN
    RETURN TRUE;
  END IF;

  IF p_viewer_gender IS NULL OR p_candidate_gender IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_viewer_gender = 'prefer_not_to_say' OR p_candidate_gender = 'prefer_not_to_say' THEN
    RETURN FALSE;
  END IF;

  IF p_preference = 'same' THEN
    RETURN p_viewer_gender = p_candidate_gender;
  END IF;

  IF p_preference = 'opposite' THEN
    IF p_viewer_gender = 'female' AND p_candidate_gender = 'male' THEN
      RETURN TRUE;
    END IF;
    IF p_viewer_gender = 'male' AND p_candidate_gender = 'female' THEN
      RETURN TRUE;
    END IF;
    IF p_viewer_gender = 'non_binary' AND p_candidate_gender IN ('female', 'male') THEN
      RETURN TRUE;
    END IF;
    IF p_candidate_gender = 'non_binary' AND p_viewer_gender IN ('female', 'male') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Bidirectional gender / partner-preference compatibility.
CREATE OR REPLACE FUNCTION public.profiles_match_preferences(
  p_viewer_gender TEXT,
  p_viewer_preference TEXT,
  p_candidate_gender TEXT,
  p_candidate_preference TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.gender_matches_preference(
    p_viewer_preference,
    p_viewer_gender,
    p_candidate_gender
  )
  AND public.gender_matches_preference(
    p_candidate_preference,
    p_candidate_gender,
    p_viewer_gender
  );
END;
$$;

-- Deck of profiles the current user has not swiped on yet.
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
    cardinality(COALESCE(p.activities, '{}') & COALESCE(v_viewer.activities, '{}')) DESC,
    cardinality(COALESCE(p.fitness_goals, '{}') & COALESCE(v_viewer.fitness_goals, '{}')) DESC,
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

-- Record a swipe; create a matched row when both users swipe right.
CREATE OR REPLACE FUNCTION public.record_match_swipe(
  p_swipee_id UUID,
  p_direction TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swiper_id UUID := auth.uid();
  v_swiper public.profiles%ROWTYPE;
  v_swipee public.profiles%ROWTYPE;
  v_swipe public.match_swipes%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_user_a UUID;
  v_user_b UUID;
  v_is_mutual BOOLEAN := false;
  v_reciprocal_direction TEXT;
BEGIN
  IF v_swiper_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_swipee_id IS NULL OR p_swipee_id = v_swiper_id THEN
    RAISE EXCEPTION 'Invalid swipee';
  END IF;

  IF p_direction NOT IN ('left', 'right') THEN
    RAISE EXCEPTION 'Invalid swipe direction';
  END IF;

  SELECT * INTO v_swiper FROM public.profiles WHERE id = v_swiper_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF NOT COALESCE(v_swiper.matching_enabled, false) THEN
    RAISE EXCEPTION 'Matching is not enabled on your profile';
  END IF;

  IF COALESCE(v_swiper.is_banned, false) THEN
    RAISE EXCEPTION 'Your account cannot use matching';
  END IF;

  SELECT * INTO v_swipee FROM public.profiles WHERE id = p_swipee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF NOT COALESCE(v_swipee.matching_enabled, false) THEN
    RAISE EXCEPTION 'This user is not available for matching';
  END IF;

  IF COALESCE(v_swipee.is_banned, false) THEN
    RAISE EXCEPTION 'This user is not available for matching';
  END IF;

  IF public.users_are_blocked(v_swiper_id, p_swipee_id) THEN
    RAISE EXCEPTION 'Cannot swipe this user';
  END IF;

  IF NOT public.profiles_match_preferences(
    v_swiper.gender,
    v_swiper.match_preference,
    v_swipee.gender,
    v_swipee.match_preference
  ) THEN
    RAISE EXCEPTION 'User does not match your preferences';
  END IF;

  INSERT INTO public.match_swipes (swiper_id, swipee_id, direction)
  VALUES (v_swiper_id, p_swipee_id, p_direction)
  ON CONFLICT (swiper_id, swipee_id) DO UPDATE
  SET
    direction = EXCLUDED.direction,
    created_at = now()
  RETURNING * INTO v_swipe;

  v_user_a := LEAST(v_swiper_id, p_swipee_id);
  v_user_b := GREATEST(v_swiper_id, p_swipee_id);

  IF p_direction = 'right' THEN
    SELECT ms.direction INTO v_reciprocal_direction
    FROM public.match_swipes ms
    WHERE ms.swiper_id = p_swipee_id
      AND ms.swipee_id = v_swiper_id;

    IF v_reciprocal_direction = 'right' THEN
      v_is_mutual := true;

      INSERT INTO public.matches (user_a, user_b, status)
      VALUES (v_user_a, v_user_b, 'matched')
      ON CONFLICT (user_a, user_b) DO UPDATE
      SET status = 'matched'
      RETURNING * INTO v_match;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'swipe',
    jsonb_build_object(
      'swiper_id', v_swipe.swiper_id,
      'swipee_id', v_swipe.swipee_id,
      'direction', v_swipe.direction,
      'created_at', v_swipe.created_at
    ),
    'match',
    CASE
      WHEN v_match.id IS NOT NULL THEN to_jsonb(v_match)
      ELSE NULL
    END,
    'is_mutual', v_is_mutual
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gender_matches_preference(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profiles_match_preferences(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_match_candidates(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_match_swipe(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_match_candidates(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_match_swipe(UUID, TEXT) TO authenticated;
