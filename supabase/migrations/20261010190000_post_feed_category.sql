-- Home feed category: workout | nutrition | general.
-- Separate from workout_types (activity tags) and journey_category (Reels).
--
-- Additive and nullable so existing clients keep inserting and reading posts.
-- Existing likes, comments, reactions, and saves are untouched.
-- Existing row-level security policies stay in place; this column does not
-- change who can see a post.
--
-- Deploy this migration before shipping the app that filters on feed_category.
-- Until then, All still loads. Workouts and Nutrition queries need the column.
--
-- Run this whole script once in the Supabase SQL editor. BEGIN/COMMIT makes
-- the column, check, backfill, trigger restoration, and index one transaction.
-- An error before COMMIT leaves the database unchanged.

BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS feed_category TEXT;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_feed_category_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_feed_category_check
  CHECK (
    feed_category IS NULL
    OR feed_category IN ('workout', 'nutrition', 'general')
  );

COMMENT ON COLUMN public.posts.feed_category IS
  'Home feed category: workout, nutrition, or general. Null means uncategorized and still appears in All. Not a workout-type tag and not a Reels journey_category.';

-- Classify only rows that already identify a workout. Leave photos, videos,
-- and text posts alone when they have no workout type, tags, or stats.
--
-- posts_updated_at would stamp every backfilled row as edited.
-- posts_sync_workout_types runs BEFORE UPDATE and can rewrite workout_type
-- from workout_types. Both are disabled only while this backfill runs.
-- Each trigger is then returned to the enabled state it had at the start
-- of this transaction (origin, always, replica, or disabled).
-- Insert-only activity triggers are not fired by UPDATE.
-- Row security is unchanged: this column is not private, and policies stay
-- row-level (select/insert/update/delete), not column-level.
DO $$
DECLARE
  updated_at_state "char";
  sync_state "char";
BEGIN
  SELECT t.tgenabled
    INTO updated_at_state
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.posts'::regclass
    AND t.tgname = 'posts_updated_at'
    AND NOT t.tgisinternal;

  SELECT t.tgenabled
    INTO sync_state
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.posts'::regclass
    AND t.tgname = 'posts_sync_workout_types'
    AND NOT t.tgisinternal;

  IF updated_at_state IS NULL THEN
    RAISE EXCEPTION 'posts_updated_at trigger is missing on public.posts';
  END IF;
  IF sync_state IS NULL THEN
    RAISE EXCEPTION 'posts_sync_workout_types trigger is missing on public.posts';
  END IF;

  ALTER TABLE public.posts DISABLE TRIGGER posts_updated_at;
  ALTER TABLE public.posts DISABLE TRIGGER posts_sync_workout_types;

  UPDATE public.posts AS post
  SET feed_category = 'workout'
  WHERE post.feed_category IS NULL
    AND (
      post.post_type = 'workout_update'
      OR NULLIF(btrim(post.workout_type), '') IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(post.workout_types, '{}'::text[])) AS workout_tag
        WHERE NULLIF(btrim(workout_tag), '') IS NOT NULL
      )
      OR (
        post.workout_metrics IS NOT NULL
        AND jsonb_typeof(post.workout_metrics) = 'object'
        AND (
          CASE
            WHEN COALESCE(post.workout_metrics->>'duration_seconds', '') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (post.workout_metrics->>'duration_seconds')::numeric > 0
            ELSE false
          END
          OR CASE
            WHEN COALESCE(post.workout_metrics->>'distance_meters', '') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (post.workout_metrics->>'distance_meters')::numeric > 0
            ELSE false
          END
          OR CASE
            WHEN COALESCE(post.workout_metrics->>'calories', '') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (post.workout_metrics->>'calories')::numeric > 0
            ELSE false
          END
        )
      )
    );

  -- A share of an already-classified workout belongs with Workouts.
  UPDATE public.posts AS share
  SET feed_category = 'workout'
  FROM public.posts AS original
  WHERE share.feed_category IS NULL
    AND share.shared_post_id = original.id
    AND original.feed_category = 'workout';

  IF sync_state = 'D' THEN
    ALTER TABLE public.posts DISABLE TRIGGER posts_sync_workout_types;
  ELSIF sync_state = 'R' THEN
    ALTER TABLE public.posts ENABLE REPLICA TRIGGER posts_sync_workout_types;
  ELSIF sync_state = 'A' THEN
    ALTER TABLE public.posts ENABLE ALWAYS TRIGGER posts_sync_workout_types;
  ELSE
    ALTER TABLE public.posts ENABLE TRIGGER posts_sync_workout_types;
  END IF;

  IF updated_at_state = 'D' THEN
    ALTER TABLE public.posts DISABLE TRIGGER posts_updated_at;
  ELSIF updated_at_state = 'R' THEN
    ALTER TABLE public.posts ENABLE REPLICA TRIGGER posts_updated_at;
  ELSIF updated_at_state = 'A' THEN
    ALTER TABLE public.posts ENABLE ALWAYS TRIGGER posts_updated_at;
  ELSE
    ALTER TABLE public.posts ENABLE TRIGGER posts_updated_at;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS posts_feed_category_created_at_idx
  ON public.posts (feed_category, created_at DESC)
  WHERE feed_category IS NOT NULL;

COMMIT;
