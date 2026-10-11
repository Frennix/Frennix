-- Explicit Frennix Reels destination flag.
-- Additive and backward-compatible: existing posts stay is_reel=false
-- and remain on the normal Feed. No backfill of legacy videos.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_reel BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.posts.is_reel IS
  'True only for videos created through Share Your Journey. Existing and normal Feed posts stay false.';
