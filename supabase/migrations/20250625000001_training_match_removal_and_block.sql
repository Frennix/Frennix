-- Phase 10: remove training match + block integration

CREATE OR REPLACE FUNCTION public.remove_training_match(p_match_id UUID)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.matches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training match not found';
  END IF;

  IF v_match.user_a != v_user_id AND v_match.user_b != v_user_id THEN
    RAISE EXCEPTION 'Not authorized to remove this training match';
  END IF;

  IF v_match.status != 'matched' THEN
    RAISE EXCEPTION 'This training match is no longer active';
  END IF;

  UPDATE public.matches
  SET status = 'unmatched'
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_training_matches()
RETURNS SETOF public.matches
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT m.*
  FROM public.matches m
  WHERE m.status = 'matched'
    AND (m.user_a = v_user_id OR m.user_b = v_user_id)
    AND NOT public.users_are_blocked(
      v_user_id,
      CASE WHEN m.user_a = v_user_id THEN m.user_b ELSE m.user_a END
    )
  ORDER BY m.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_block()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);

  UPDATE public.matches
  SET status = 'unmatched'
  WHERE status = 'matched'
    AND user_a = LEAST(NEW.blocker_id, NEW.blocked_id)
    AND user_b = GREATEST(NEW.blocker_id, NEW.blocked_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Only exclude active training matches from discovery (not historical unmatched rows).
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
        AND m.status = 'matched'
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

REVOKE ALL ON FUNCTION public.remove_training_match(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_training_matches() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_match_candidates(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.remove_training_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_training_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_candidates(INT) TO authenticated;
