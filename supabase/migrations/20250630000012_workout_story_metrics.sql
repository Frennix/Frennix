-- Fitness-first workout story metrics and milestone flags (future-ready JSONB).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS workout_metrics JSONB,
  ADD COLUMN IF NOT EXISTS story_milestones TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.posts.workout_metrics IS
  'Optional workout stats: duration_seconds, distance_meters, calories, extra (wearable-ready).';
COMMENT ON COLUMN public.posts.story_milestones IS
  'Story highlight flags: personal_record, goal_completed, etc.';
