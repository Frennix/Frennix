-- Optional journey category for Frennix Reels.
-- Nullable and backward-compatible: existing video rows stay unchanged.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS journey_category TEXT;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_journey_category_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_journey_category_check
  CHECK (
    journey_category IS NULL
    OR journey_category IN (
      'starting_over',
      'mental_wellness',
      'weight_loss',
      'strength',
      'recovery',
      'confidence',
      'parenthood',
      'sobriety',
      'consistency'
    )
  );

COMMENT ON COLUMN public.posts.journey_category IS
  'Optional Frennix Reels journey category. Null for uncategorized and legacy posts.';
