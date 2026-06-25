-- Full-text style profile search across name, bio, interests, goals, and workout types

CREATE OR REPLACE FUNCTION public.search_profiles(search_query text, result_limit int DEFAULT 30)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.*
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

GRANT EXECUTE ON FUNCTION public.search_profiles(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_profiles(text, int) TO anon;
