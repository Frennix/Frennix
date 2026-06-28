-- Phase A: Training partner matching — profile dimensions + scoring architecture foundation.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_level text,
  ADD COLUMN IF NOT EXISTS training_schedules text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS home_gym text,
  ADD COLUMN IF NOT EXISTS training_environment text,
  ADD COLUMN IF NOT EXISTS discovery_radius_miles integer,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.profiles.skill_level IS 'beginner | intermediate | advanced';
COMMENT ON COLUMN public.profiles.training_schedules IS 'morning | afternoon | evening | weekend';
COMMENT ON COLUMN public.profiles.training_environment IS 'indoor | outdoor | both';
COMMENT ON COLUMN public.profiles.discovery_radius_miles IS 'Max distance for nearby matching when lat/lng set';

-- Workout streak for candidate cards (used by @frennix/matching scoring).
CREATE OR REPLACE FUNCTION public.profile_workout_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_dates timestamptz[];
  v_day date;
  v_prev date;
  v_streak integer := 0;
  v_today date := (timezone('utc', now()))::date;
  v_yesterday date := v_today - 1;
BEGIN
  SELECT array_agg(DISTINCT (created_at AT TIME ZONE 'UTC')::date ORDER BY (created_at AT TIME ZONE 'UTC')::date DESC)
  INTO v_dates
  FROM public.posts
  WHERE author_id = p_user_id
    AND post_type IN ('workout_update', 'photo', 'video');

  IF v_dates IS NULL OR array_length(v_dates, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF v_dates[1] IS DISTINCT FROM v_today AND v_dates[1] IS DISTINCT FROM v_yesterday THEN
    RETURN 0;
  END IF;

  v_streak := 1;
  v_prev := v_dates[1] - 1;

  FOR i IN 2 .. array_length(v_dates, 1) LOOP
    v_day := v_dates[i];
    IF v_day = v_prev THEN
      v_streak := v_streak + 1;
      v_prev := v_day - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_workout_streak(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_workout_streak(uuid) TO authenticated;

-- Batch streak lookup for scoring pipeline.
CREATE OR REPLACE FUNCTION public.profile_workout_streaks(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, streak integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT uid AS user_id, public.profile_workout_streak(uid) AS streak
  FROM unnest(p_user_ids) AS uid;
$$;

REVOKE ALL ON FUNCTION public.profile_workout_streaks(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_workout_streaks(uuid[]) TO authenticated;
