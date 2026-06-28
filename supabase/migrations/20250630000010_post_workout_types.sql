-- Multi-select workout types on posts (backward compatible with workout_type TEXT).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS workout_types TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.posts
SET workout_types = ARRAY[workout_type]
WHERE workout_type IS NOT NULL
  AND btrim(workout_type) <> ''
  AND workout_types = '{}';

CREATE INDEX IF NOT EXISTS posts_workout_types_gin ON public.posts USING GIN (workout_types);

CREATE OR REPLACE FUNCTION public.sync_post_workout_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.workout_types IS NOT NULL AND array_length(NEW.workout_types, 1) > 0 THEN
    NEW.workout_type := NEW.workout_types[1];
    RETURN NEW;
  END IF;

  IF NEW.workout_type IS NOT NULL AND btrim(NEW.workout_type) <> '' THEN
    NEW.workout_types := ARRAY[NEW.workout_type];
    RETURN NEW;
  END IF;

  NEW.workout_type := NULL;
  NEW.workout_types := '{}';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_sync_workout_types ON public.posts;
CREATE TRIGGER posts_sync_workout_types
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_post_workout_types();

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
          AND (
            COALESCE(post.workout_type, '') ILIKE '%' || search_query || '%'
            OR EXISTS (
              SELECT 1 FROM unnest(post.workout_types) AS wt
              WHERE wt ILIKE '%' || search_query || '%'
                OR replace(wt, '_', ' ') ILIKE '%' || search_query || '%'
            )
          )
      )
    )
  ORDER BY p.display_name
  LIMIT GREATEST(result_limit, 1);
$$;
